/**
 * Attendance risk engine (pure - no database, no network).
 *
 * It looks at the last N days of one employee's real attendance data and
 * returns the unusual patterns it found, a 0-100 risk score and a plain-English
 * explanation for HR. It never accuses anyone: every finding only says what the
 * data shows.
 *
 * This runs without any AI model. When an Ollama model is available it is only
 * used afterwards to re-word the explanation (see attendanceRisk.service.js);
 * the findings and the score always come from the rules below, so they are
 * repeatable and can be checked.
 *
 * Findings (types match the labels the dashboard already knows):
 *   repeated_late_arrivals            late on several days
 *   unusual_checkin_pattern           identical-to-the-minute or odd-hour check-ins
 *   unusual_overtime                  very long days / a lot of overtime
 *   impossible_gps_movement           locations too far apart for the time between them
 *   frequent_location_changes         many different places in one day
 *   multiple_employees_same_device    one phone used by several employees
 *   suspicious_attendance             repeated face-verification failures
 *   possible_attendance_manipulation  many manually added / edited punches
 */

const SEVERITY_POINTS = { low: 8, medium: 18, high: 32, critical: 50 };
const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const LEVEL_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

const T = {
  lateDaysLow: 3,
  lateDaysMedium: 5,
  lateDaysHigh: 8,

  sameMinuteSamples: 6,
  sameMinuteMaxStdDev: 1.5, // minutes
  offHoursBefore: 5, // check-in before 05:00 ...
  offHoursFrom: 23, // ... or from 23:00
  offHoursDays: 2,

  overtimeDayHours: 4,
  overtimeDays: 3,
  overtimeTotalHigh: 40,
  longDayHours: 16,

  impossibleSpeedKmh: 150,
  impossibleMinKm: 2,
  gpsMinGapSeconds: 30,
  gpsMaxGapHours: 6,

  clusterRadiusMeters: 150,
  manyPlacesPerDay: 8,
  manyPlacesDays: 2,

  faceFailuresMedium: 3,
  faceFailuresHigh: 6,

  manualPunchDays: 3,
  manualPunchDaysHigh: 6,
};

const round1 = (value) => Math.round(value * 10) / 10;

const levelFromScore = (score) => {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
};

const haversineKm = (aLat, aLng, bLat, bLng) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

// hour / minute of a moment in India time
const istClock = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value);

  return { hour, minute, minutes: hour * 60 + minute };
};

const clockText = (minutes) => {
  const total = Math.round(minutes);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const dateText = (value) => {
  const text = String(value).slice(0, 10);
  const date = new Date(`${text}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? text
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const worked = (record) =>
  ["present", "half-day", "late"].includes(String(record.status || "present"));

const validPoint = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  !(Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ----------------------------------------------------------------- rules

function ruleLateArrivals(profile, add) {
  const presentDays = profile.attendance.filter(worked);
  const lateDays = presentDays.filter(
    (record) => record.isLate || num(record.lateMinutes) > 0,
  );

  const n = lateDays.length;

  if (n < T.lateDaysLow) return;

  const minutes = lateDays.map((r) => num(r.lateMinutes)).filter((m) => m > 0);
  const average = minutes.length
    ? minutes.reduce((a, b) => a + b, 0) / minutes.length
    : 0;
  const worst = minutes.length ? Math.max(...minutes) : 0;

  const severity =
    n >= T.lateDaysHigh || n / Math.max(presentDays.length, 1) >= 0.5
      ? "high"
      : n >= T.lateDaysMedium
        ? "medium"
        : "low";

  add(
    "repeated_late_arrivals",
    severity,
    `Late on ${n} of ${presentDays.length} working days in the last ${profile.windowDays} days` +
      (average
        ? ` (about ${Math.round(average)} min late on average, worst ${worst} min).`
        : "."),
    { lateDays: n, workingDays: presentDays.length },
  );
}

function ruleCheckinPattern(profile, add) {
  const samples = [];
  const offHours = [];

  for (const record of profile.attendance) {
    const first = (record.punches || [])
      .filter((p) => p.type === "check_in" && !p.manual)
      .sort((a, b) => new Date(a.time) - new Date(b.time))[0];

    if (!first) continue;

    const clock = istClock(first.time);

    if (!clock) continue;

    samples.push(clock.minutes);

    if (clock.hour < T.offHoursBefore || clock.hour >= T.offHoursFrom) {
      offHours.push({ date: record.date, minutes: clock.minutes });
    }
  }

  if (samples.length >= T.sameMinuteSamples) {
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance =
      samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev <= T.sameMinuteMaxStdDev) {
      add(
        "unusual_checkin_pattern",
        "medium",
        `Check-in time was almost identical on ${samples.length} days (around ${clockText(mean)}, within ${round1(stdDev * 2)} min). Real arrival times normally vary more.`,
        { days: samples.length, averageTime: clockText(mean) },
      );
    }
  }

  if (offHours.length >= T.offHoursDays) {
    const example = offHours[0];

    add(
      "unusual_checkin_pattern",
      "medium",
      `${offHours.length} check-ins happened at odd hours (for example ${clockText(example.minutes)} on ${dateText(example.date)}).`,
      { days: offHours.length },
    );
  }
}

function ruleOvertime(profile, add) {
  const records = profile.attendance.filter(worked);

  const overtimeDays = records.filter(
    (r) => num(r.overtimeHours) >= T.overtimeDayHours,
  );
  const totalOvertime = records.reduce((s, r) => s + num(r.overtimeHours), 0);
  const longDays = records.filter(
    (r) => num(r.workingHours) >= T.longDayHours,
  );

  if (longDays.length) {
    const longest = longDays.sort(
      (a, b) => num(b.workingHours) - num(a.workingHours),
    )[0];

    add(
      "unusual_overtime",
      "high",
      `${longDays.length} day(s) with ${T.longDayHours} or more hours worked (longest ${round1(num(longest.workingHours))} h on ${dateText(longest.date)}). Please check the punches.`,
      { days: longDays.length },
    );
  }

  if (totalOvertime >= T.overtimeTotalHigh) {
    add(
      "unusual_overtime",
      "high",
      `${round1(totalOvertime)} overtime hours in the last ${profile.windowDays} days.`,
      { totalOvertime: round1(totalOvertime) },
    );
  } else if (overtimeDays.length >= T.overtimeDays) {
    add(
      "unusual_overtime",
      "medium",
      `${overtimeDays.length} days with ${T.overtimeDayHours}+ hours of overtime (${round1(totalOvertime)} h in total).`,
      { days: overtimeDays.length },
    );
  }
}

// Every position the app recorded for the employee, oldest first
function movementPoints(profile) {
  const points = [];

  for (const location of profile.locations || []) {
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);

    if (!validPoint(lat, lng)) continue;

    points.push({
      lat,
      lng,
      time: new Date(location.recordedAt).getTime(),
      accuracy: num(location.accuracy),
    });
  }

  for (const record of profile.attendance) {
    for (const punch of record.punches || []) {
      if (punch.manual) continue;

      const lat = Number(punch.latitude);
      const lng = Number(punch.longitude);

      if (!validPoint(lat, lng)) continue;

      points.push({
        lat,
        lng,
        time: new Date(punch.time).getTime(),
        accuracy: 0,
      });
    }
  }

  return points
    .filter((p) => Number.isFinite(p.time))
    .sort((a, b) => a.time - b.time);
}

function ruleImpossibleMovement(profile, add) {
  const points = movementPoints(profile);
  const events = [];

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const seconds = (b.time - a.time) / 1000;

    if (seconds < T.gpsMinGapSeconds || seconds > T.gpsMaxGapHours * 3600) {
      continue;
    }

    const distanceKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
    // GPS is not exact: forgive the reported accuracy of both readings
    const toleranceKm = Math.min((a.accuracy + b.accuracy) / 1000, 0.5);
    const effectiveKm = Math.max(distanceKm - toleranceKm, 0);

    if (effectiveKm < T.impossibleMinKm) continue;

    const speed = effectiveKm / (seconds / 3600);

    if (speed >= T.impossibleSpeedKmh) {
      events.push({ time: b.time, distanceKm, seconds, speed });
    }
  }

  if (!events.length) return;

  const worst = events.sort((x, y) => y.speed - x.speed)[0];
  const minutes = Math.max(1, Math.round(worst.seconds / 60));

  const severity =
    events.length >= 4 ? "critical" : events.length >= 2 ? "high" : "medium";

  add(
    "impossible_gps_movement",
    severity,
    `${events.length} location jump(s) too fast to be real travel - for example ${round1(worst.distanceKm)} km in ${minutes} min (about ${Math.round(worst.speed)} km/h) on ${dateText(new Date(worst.time).toISOString())}.`,
    { events: events.length },
  );
}

function ruleLocationChanges(profile, add) {
  const byDay = new Map();

  for (const location of profile.locations || []) {
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);

    if (!validPoint(lat, lng)) continue;

    const day = new Date(location.recordedAt)
      .toISOString()
      .slice(0, 10);

    if (!byDay.has(day)) byDay.set(day, []);

    byDay.get(day).push({
      lat,
      lng,
      time: new Date(location.recordedAt).getTime(),
    });
  }

  const busyDays = [];

  for (const [day, list] of byDay) {
    list.sort((a, b) => a.time - b.time);

    const clusters = [];

    for (const point of list) {
      const last = clusters[clusters.length - 1];

      if (
        last &&
        haversineKm(last.lat, last.lng, point.lat, point.lng) * 1000 <
          T.clusterRadiusMeters
      ) {
        continue;
      }

      clusters.push(point);
    }

    if (clusters.length >= T.manyPlacesPerDay) {
      busyDays.push({ day, places: clusters.length });
    }
  }

  if (busyDays.length < T.manyPlacesDays) return;

  const most = busyDays.sort((a, b) => b.places - a.places)[0];

  add(
    "frequent_location_changes",
    busyDays.length >= 4 ? "medium" : "low",
    `${busyDays.length} days with ${T.manyPlacesPerDay}+ different places in one day (most: ${most.places} places on ${dateText(most.day)}). This can be normal for field work.`,
    { days: busyDays.length },
  );
}

function ruleSharedDevices(profile, add) {
  const shared = profile.sharedDevices || [];

  if (!shared.length) return;

  const others = new Set();

  shared.forEach((device) =>
    (device.otherEmployees || []).forEach((name) => others.add(name)),
  );

  if (!others.size) return;

  const names = [...others].slice(0, 3).join(", ");
  const extra = others.size > 3 ? ` and ${others.size - 3} more` : "";

  add(
    "multiple_employees_same_device",
    others.size >= 3 ? "critical" : "high",
    `The same phone is also used by ${others.size} other employee(s): ${names}${extra}.`,
    { employees: others.size },
  );
}

function ruleFaceChecks(profile, add) {
  const punches = profile.attendance
    .flatMap((r) => r.punches || [])
    .filter((p) => !p.manual && !p.autoCheckout);

  const verified = punches.filter((p) => p.faceVerified).length;
  const failed = punches.filter((p) => !p.faceVerified).length;

  // only meaningful when face verification is actually in use for this employee
  if (!verified || failed < T.faceFailuresMedium) return;

  add(
    "suspicious_attendance",
    failed >= T.faceFailuresHigh ? "high" : "medium",
    `${failed} punch(es) failed face verification (${verified} passed) in the last ${profile.windowDays} days.`,
    { failed, verified },
  );
}

function ruleManualEdits(profile, add) {
  const manualDays = profile.attendance.filter((r) =>
    (r.punches || []).some((p) => p.manual),
  );

  if (manualDays.length >= T.manualPunchDays) {
    add(
      "possible_attendance_manipulation",
      manualDays.length >= T.manualPunchDaysHigh ? "high" : "medium",
      `${manualDays.length} days contain manually added or edited punches instead of live check-ins.`,
      { days: manualDays.length },
    );
  }

  const noLocation = profile.attendance
    .flatMap((r) => r.punches || [])
    .filter(
      (p) =>
        !p.manual &&
        !p.autoCheckout &&
        !validPoint(Number(p.latitude), Number(p.longitude)),
    );

  if (noLocation.length >= 5) {
    add(
      "possible_attendance_manipulation",
      "low",
      `${noLocation.length} live punches have no GPS location attached.`,
      { punches: noLocation.length },
    );
  }
}

// -------------------------------------------------------------- evaluate

const ACTIONS = {
  low: "No action needed. Keep monitoring.",
  medium:
    "Review the flagged days with the employee's manager and confirm they are expected.",
  high: "HR should review the flagged records and speak with the employee.",
  critical:
    "Urgent HR review: verify the flagged punches, locations and devices before payroll is processed.",
};

/**
 * @param {object} profile  see employeeProfile.service.js
 * @returns {{riskScore:number, riskLevel:string, findings:object[],
 *            explanation:string, recommendedAction:string, stats:object}}
 */
function evaluateAttendanceRisk(profile) {
  const safe = {
    windowDays: 30,
    attendance: [],
    locations: [],
    sharedDevices: [],
    ...profile,
  };

  const findings = [];

  const add = (type, severity, explanation, evidence = {}) =>
    findings.push({ type, severity, explanation, evidence });

  ruleLateArrivals(safe, add);
  ruleCheckinPattern(safe, add);
  ruleOvertime(safe, add);
  ruleImpossibleMovement(safe, add);
  ruleLocationChanges(safe, add);
  ruleSharedDevices(safe, add);
  ruleFaceChecks(safe, add);
  ruleManualEdits(safe, add);

  // most serious first
  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  let score = findings.reduce((sum, f) => sum + SEVERITY_POINTS[f.severity], 0);

  if (findings.length >= 3) score += 10; // several different signals together

  score = Math.min(100, score);

  const riskLevel = levelFromScore(score);
  const name = safe.employee?.name || "This employee";

  const explanation = findings.length
    ? `${name}: ${findings.length} pattern(s) worth a look in the last ${safe.windowDays} days. ` +
      findings.map((f) => f.explanation).join(" ") +
      " These are patterns in the data for HR to review, not proof of wrongdoing."
    : `${name}: no unusual attendance patterns in the last ${safe.windowDays} days.`;

  return {
    riskScore: score,
    riskLevel,
    findings,
    explanation,
    recommendedAction: ACTIONS[riskLevel],
    stats: {
      daysAnalyzed: safe.attendance.length,
      locationPoints: (safe.locations || []).length,
    },
  };
}

// same findings => same signature (used to avoid duplicate alerts)
const findingSignature = (findings = []) =>
  [...new Set((findings || []).map((f) => (typeof f === "string" ? f : f.type)))]
    .sort()
    .join("|");

module.exports = {
  evaluateAttendanceRisk,
  findingSignature,
  levelFromScore,
  LEVEL_RANK,
  THRESHOLDS: T,
};
/**
 * AI attendance risk tests (no database, no Ollama needed).
 *
 *   node src/scripts/test-attendance-risk.js
 */

const {
  evaluateAttendanceRisk,
  findingSignature,
  levelFromScore,
} = require("../services/ai/attendanceRiskEngine.service");

let passed = 0;
let failed = 0;

const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : `  (expected ${expected})`}`);
};

const section = (t) => console.log(`\n${t}`);

// ---------------------------------------------------------------- helpers
const day = (n) => `2026-10-${String(n).padStart(2, "0")}`;
// local India time -> ISO
const ist = (date, hhmm) => new Date(`${date}T${hhmm}:00+05:30`).toISOString();

const record = (n, over = {}) => ({
  id: n,
  date: day(n),
  status: "present",
  isLate: false,
  lateMinutes: 0,
  workingHours: 8,
  overtimeHours: 0,
  punches: [
    { type: "check_in", time: ist(day(n), `09:${String(10 + (n * 7) % 40).padStart(2, "0")}`), latitude: 22.745, longitude: 75.8968, faceVerified: true, manual: false, autoCheckout: false },
    { type: "check_out", time: ist(day(n), "18:05"), latitude: 22.745, longitude: 75.8968, faceVerified: true, manual: false, autoCheckout: false },
  ],
  ...over,
});

const normalMonth = () => Array.from({ length: 20 }, (_, i) => record(i + 1));

const profile = (over = {}) => ({
  windowDays: 30,
  employee: { id: 1, name: "Peter" },
  attendance: normalMonth(),
  locations: [],
  sharedDevices: [],
  ...over,
});

const types = (r) => r.findings.map((f) => f.type).join(",");

// -------------------------------------------------------------- scenarios
section("1. A normal employee raises nothing");
{
  const r = evaluateAttendanceRisk(profile());
  check("no findings", r.findings.length, 0);
  check("score", r.riskScore, 0);
  check("level", r.riskLevel, "low");
  check("explanation says all is normal", /no unusual attendance patterns/.test(r.explanation), true);
}

section("2. Repeated late arrivals");
{
  const lateDays = (count) =>
    normalMonth().map((rec, i) => (i < count ? { ...rec, isLate: true, lateMinutes: 25 + i } : rec));

  check("2 late days -> nothing", evaluateAttendanceRisk(profile({ attendance: lateDays(2) })).findings.length, 0);

  const three = evaluateAttendanceRisk(profile({ attendance: lateDays(3) }));
  check("3 late days -> low finding", `${three.findings[0].type}/${three.findings[0].severity}`, "repeated_late_arrivals/low");

  const six = evaluateAttendanceRisk(profile({ attendance: lateDays(6) }));
  check("6 late days -> medium", six.findings[0].severity, "medium");

  const nine = evaluateAttendanceRisk(profile({ attendance: lateDays(9) }));
  check("9 late days -> high", nine.findings[0].severity, "high");
  check("explanation mentions the numbers", /Late on 9 of 20 working days/.test(nine.findings[0].explanation), true);

  // absent days are not "late"
  const withAbsent = normalMonth().map((rec, i) => (i < 5 ? { ...rec, status: "absent", isLate: true, lateMinutes: 30 } : rec));
  check("absent days are ignored", evaluateAttendanceRisk(profile({ attendance: withAbsent })).findings.length, 0);
}

section("3. Check-in pattern");
{
  // identical to the minute on 8 days
  const robotic = normalMonth().map((rec) => ({
    ...rec,
    punches: [{ ...rec.punches[0], time: ist(rec.date, "09:00") }, rec.punches[1]],
  }));
  const a = evaluateAttendanceRisk(profile({ attendance: robotic }));
  check("identical check-in minute -> flagged", types(a), "unusual_checkin_pattern");
  check("says 09:00", /around 09:00/.test(a.findings[0].explanation), true);

  // odd hours
  const odd = normalMonth().map((rec, i) =>
    i < 3 ? { ...rec, punches: [{ ...rec.punches[0], time: ist(rec.date, "02:30") }, rec.punches[1]] } : rec,
  );
  const b = evaluateAttendanceRisk(profile({ attendance: odd }));
  check("odd-hour check-ins flagged", types(b), "unusual_checkin_pattern");

  // manually typed punches are not evidence of a pattern
  const manual = robotic.map((rec) => ({ ...rec, punches: rec.punches.map((p) => ({ ...p, manual: true })) }));
  check("manual punches are excluded from the pattern rule", evaluateAttendanceRisk(profile({ attendance: manual })).findings.some((f) => f.type === "unusual_checkin_pattern"), false);
}

section("4. Overtime");
{
  const heavy = normalMonth().map((rec, i) => (i < 4 ? { ...rec, overtimeHours: 5 } : rec));
  const a = evaluateAttendanceRisk(profile({ attendance: heavy }));
  check("4 days of 5h overtime -> medium", `${a.findings[0].type}/${a.findings[0].severity}`, "unusual_overtime/medium");

  const huge = normalMonth().map((rec) => ({ ...rec, overtimeHours: 2.5 })); // 50 h total
  const b = evaluateAttendanceRisk(profile({ attendance: huge }));
  check("50h overtime in total -> high", b.findings[0].severity, "high");

  const long = normalMonth().map((rec, i) => (i === 3 ? { ...rec, workingHours: 18.5 } : rec));
  const c = evaluateAttendanceRisk(profile({ attendance: long }));
  check("an 18.5h day -> high", `${c.findings[0].type}/${c.findings[0].severity}`, "unusual_overtime/high");
}

section("5. Impossible GPS movement");
{
  const at = (lat, lng, time, accuracy = 20) => ({ latitude: lat, longitude: lng, recordedAt: time, accuracy });

  // Indore -> Bhopal (~190 km) in 5 minutes
  const jump = evaluateAttendanceRisk(
    profile({
      locations: [
        at(22.7196, 75.8577, ist(day(5), "11:00")),
        at(23.2599, 77.4126, ist(day(5), "11:05")),
      ],
    }),
  );
  check("190 km in 5 min flagged", `${jump.findings[0].type}/${jump.findings[0].severity}`, "impossible_gps_movement/medium");
  check("mentions the distance", /km in 5 min/.test(jump.findings[0].explanation), true);

  // the same distance over 4 hours is a normal drive
  const drive = evaluateAttendanceRisk(
    profile({
      locations: [
        at(22.7196, 75.8577, ist(day(5), "08:00")),
        at(23.2599, 77.4126, ist(day(5), "12:00")),
      ],
    }),
  );
  check("190 km in 4 h is fine", drive.findings.length, 0);

  // ordinary GPS jitter (100 m jumps) never counts
  const jitter = [];
  for (let i = 0; i < 20; i += 1) jitter.push(at(22.745 + (i % 2) * 0.0009, 75.8968, ist(day(6), `10:${String(i).padStart(2, "0")}`), 80));
  check("GPS jitter ignored", evaluateAttendanceRisk(profile({ locations: jitter })).findings.length, 0);

  // 4 impossible jumps -> critical
  const many = [];
  for (let i = 0; i < 5; i += 1) many.push(at(i % 2 ? 22.7196 : 23.2599, i % 2 ? 75.8577 : 77.4126, ist(day(7), `1${i}:00`)));
  // spaced one hour apart is only 190 km/h -> still impossible for a walker/phone? (190 > 150)
  const crit = evaluateAttendanceRisk(profile({ locations: many }));
  check("several jumps escalate", ["high", "critical"].includes(crit.findings[0].severity), true);

  // (0,0) coordinates are ignored
  const zero = evaluateAttendanceRisk(
    profile({ locations: [at(0, 0, ist(day(8), "10:00")), at(22.745, 75.8968, ist(day(8), "10:02"))] }),
  );
  check("0,0 placeholder coordinates ignored", zero.findings.length, 0);
}

section("6. Frequent location changes");
{
  const busyDay = (d) => {
    const list = [];
    for (let i = 0; i < 10; i += 1) {
      // 10 places ~ 500 m apart, slow enough to be possible
      list.push({ latitude: 22.745 + i * 0.005, longitude: 75.8968, recordedAt: ist(day(d), `${String(9 + i).padStart(2, "0")}:00`), accuracy: 20 });
    }
    return list;
  };
  const a = evaluateAttendanceRisk(profile({ locations: [...busyDay(5), ...busyDay(6)] }));
  check("2 busy days -> low", `${a.findings[0].type}/${a.findings[0].severity}`, "frequent_location_changes/low");
  const b = evaluateAttendanceRisk(profile({ locations: [...busyDay(5)] }));
  check("1 busy day is normal", b.findings.length, 0);
}

section("7. Shared devices");
{
  const one = evaluateAttendanceRisk(profile({ sharedDevices: [{ deviceId: "d1", otherEmployees: ["Asha"] }] }));
  check("one other user -> high", `${one.findings[0].type}/${one.findings[0].severity}`, "multiple_employees_same_device/high");
  const three = evaluateAttendanceRisk(profile({ sharedDevices: [{ deviceId: "d1", otherEmployees: ["A", "B", "C", "D"] }] }));
  check("3+ other users -> critical", three.findings[0].severity, "critical");
  check("no shared device -> nothing", evaluateAttendanceRisk(profile({ sharedDevices: [] })).findings.length, 0);
}

section("8. Face verification failures");
{
  const failing = normalMonth().map((rec, i) =>
    i < 4 ? { ...rec, punches: rec.punches.map((p) => ({ ...p, faceVerified: false })) } : rec,
  ); // 8 failed punches, 32 verified
  const a = evaluateAttendanceRisk(profile({ attendance: failing }));
  check("8 failures while face check is in use -> high", `${a.findings[0].type}/${a.findings[0].severity}`, "suspicious_attendance/high");

  // a company that does not use face verification at all must not be flagged
  const none = normalMonth().map((rec) => ({ ...rec, punches: rec.punches.map((p) => ({ ...p, faceVerified: false })) }));
  check("no verified punches at all -> not flagged", evaluateAttendanceRisk(profile({ attendance: none })).findings.length, 0);

  // manual punches and auto check-outs never count as failures
  const excluded = normalMonth().map((rec, i) =>
    i < 6 ? { ...rec, punches: rec.punches.map((p) => ({ ...p, faceVerified: false, manual: true })) } : rec,
  );
  check("manual punches are not face failures", evaluateAttendanceRisk(profile({ attendance: excluded })).findings.some((f) => f.type === "suspicious_attendance"), false);
}

section("9. Manual edits");
{
  const edited = (count) =>
    normalMonth().map((rec, i) =>
      i < count ? { ...rec, punches: rec.punches.map((p) => ({ ...p, manual: true })) } : rec,
    );
  check("2 manual days -> nothing", evaluateAttendanceRisk(profile({ attendance: edited(2) })).findings.length, 0);
  const a = evaluateAttendanceRisk(profile({ attendance: edited(4) }));
  check("4 manual days -> medium", `${a.findings[0].type}/${a.findings[0].severity}`, "possible_attendance_manipulation/medium");
  const b = evaluateAttendanceRisk(profile({ attendance: edited(7) }));
  check("7 manual days -> high", b.findings[0].severity, "high");
}

section("10. Score, level and ordering");
{
  check("0 -> low", levelFromScore(0), "low");
  check("29 -> low", levelFromScore(29), "low");
  check("30 -> medium", levelFromScore(30), "medium");
  check("59 -> medium", levelFromScore(59), "medium");
  check("60 -> high", levelFromScore(60), "high");
  check("80 -> critical", levelFromScore(80), "critical");

  const bad = evaluateAttendanceRisk(
    profile({
      attendance: normalMonth().map((rec, i) => ({
        ...rec,
        isLate: i < 9,
        lateMinutes: i < 9 ? 40 : 0,
        overtimeHours: i < 4 ? 5 : 0,
      })),
      sharedDevices: [{ deviceId: "d1", otherEmployees: ["Asha", "Ravi"] }],
    }),
  );
  check("several problems add up (late high 32 + device high 32 + overtime medium 18 + 10 = 92)", bad.riskScore, 92);
  check("level for that score", bad.riskLevel, "critical");
  check("most serious finding first", ["high", "critical"].includes(bad.findings[0].severity), true);
  check("score never exceeds 100", evaluateAttendanceRisk(profile({
    attendance: normalMonth().map((rec) => ({ ...rec, isLate: true, lateMinutes: 50, overtimeHours: 3, workingHours: 17 })),
    sharedDevices: [{ deviceId: "d", otherEmployees: ["a", "b", "c", "d"] }],
  })).riskScore <= 100, true);
  check("critical gets an urgent action", /Urgent HR review/.test(bad.recommendedAction), true);
}

section("11. Finding signature (used to avoid duplicate alerts)");
{
  check("order does not matter", findingSignature([{ type: "b" }, { type: "a" }]), findingSignature([{ type: "a" }, { type: "b" }]));
  check("duplicates collapse", findingSignature([{ type: "a" }, { type: "a" }]), "a");
  check("works with plain strings (old records)", findingSignature(["a", "b"]), "a|b");
  check("empty", findingSignature([]), "");
}

section("12. Robustness");
{
  const r = evaluateAttendanceRisk({});
  check("empty profile does not crash", r.findings.length, 0);
  const odd = evaluateAttendanceRisk({
    attendance: [{ date: "bad", status: null, punches: [{ type: "check_in", time: "not a date" }] }],
    locations: [{ latitude: "x", longitude: null, recordedAt: "nope" }],
  });
  check("garbage values do not crash", odd.findings.length, 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
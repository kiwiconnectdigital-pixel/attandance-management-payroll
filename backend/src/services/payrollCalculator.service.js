/**
 * Payroll calculator (pure - no database access).
 *
 * Both "Process payroll" and the live "Salary preview" use this one function,
 * so the number you preview is the number that is generated.
 *
 * RULES
 * -----
 * Working day   = any day that is not a weekly off (company setting) and not a
 *                 holiday. Holidays are paid: they are simply not counted as
 *                 working days, so a full month always pays the full salary.
 * Present       -> 1 payable day
 * Half day      -> 0.5 payable day (other half is loss of pay)
 * Paid leave    -> 1 payable day. Approved CL / SL / PL leaves, or an
 *                  attendance record marked "on-leave".
 * Half-day leave (HD) -> 0.5 paid. Together with a half-day attendance it
 *                  makes a full day; on its own the other half is loss of pay.
 * Absent / no record on a past working day -> loss of pay (LOP).
 * Upcoming day  = a future working day (or today with no punch yet). It is
 *                 neither absent nor payable, so a month that is still running
 *                 is not charged LOP for days that have not happened.
 * Overtime      = overtime hours of present / half-day records, paid at
 *                 (basic / working days / standard hours) x multiplier.
 *
 * AMOUNTS
 * -------
 * earnings.*        prorated salary components (earned part of the salary)
 * grossSalary       earned salary + overtime + bonus  (= everything in the
 *                   earnings column of the payslip)
 * totalDeductions   PF + ESIC + PT + TDS + advance + other
 *                   (LOP is NOT here: it is already missing from the earnings)
 * netSalary         grossSalary - totalDeductions
 */

const moment = require("moment");

const DEFAULT_POLICY = {
  standardHoursPerDay: 9,
  overtimeMultiplier: 2,
  pfRate: 0.12,
  esicRate: 0.0075,
  esicWageCeiling: 21000,
  professionalTax: 200,
  halfDayFactor: 0.5,
  paidLeaveTypes: ["CL", "SL", "PL"],
};

const WEEK_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ymd = (value) => moment(value).format("YYYY-MM-DD");

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

const attendanceCredit = (status) => {
  switch (status) {
    case "present":
      return 1;
    case "half-day":
    case "halfday":
      return 0.5;
    case "on-leave":
    case "leave":
      return 1;
    default:
      return 0;
  }
};

function computePayroll(input) {
  const {
    year,
    month,
    joiningDate = null,
    weekOffDays = ["sunday"],
    holidays = [],
    attendances = [],
    leaves = [],
    salary = {},
    bonus = 0,
    advance = 0,
    otherDeductions = 0,
    today = moment().format("YYYY-MM-DD"),
  } = input;

  const policy = { ...DEFAULT_POLICY, ...(input.policy || {}) };

  const monthStart = moment(
    `${year}-${String(month).padStart(2, "0")}-01`,
  ).startOf("day");
  const monthEnd = monthStart.clone().endOf("month").startOf("day");
  const calendarDays = monthStart.daysInMonth();

  let payrollStart = monthStart.clone();

  if (joiningDate) {
    const joined = moment(joiningDate).startOf("day");
    if (joined.isAfter(payrollStart, "day")) payrollStart = joined;
  }

  if (payrollStart.isAfter(monthEnd, "day")) {
    throw new Error("Employee had not joined during this payroll month");
  }

  const startDate = payrollStart.format("YYYY-MM-DD");
  const endDate = monthEnd.format("YYYY-MM-DD");

  const weekOffSet = new Set(
    (weekOffDays || []).map((day) => String(day).trim().toLowerCase()),
  );

  // ---------------- holidays (paid, not counted as working days) -------------
  const holidayMap = new Map();

  for (const holiday of holidays) {
    if (!holiday || !holiday.date) continue;
    if (normalizeStatus(holiday.type) === "optional") continue; // choose-your-own holiday

    const key = ymd(holiday.date);

    if (key < startDate || key > endDate) continue;

    holidayMap.set(key, holiday.name || "Holiday");
  }

  // ---------------- attendance by date ----------------
  const attendanceMap = new Map();

  for (const record of attendances) {
    if (!record || !record.date) continue;

    const key = ymd(record.date);
    const status = normalizeStatus(record.status);
    const existing = attendanceMap.get(key);

    // if a date somehow has two records, keep the one that earns more
    if (
      !existing ||
      attendanceCredit(status) > attendanceCredit(existing.status)
    ) {
      attendanceMap.set(key, { ...record, status });
    }
  }

  // ---------------- approved leaves by date ----------------
  const leaveFactorByDate = new Map();

  for (const leave of leaves) {
    if (!leave) continue;
    if (leave.status && normalizeStatus(leave.status) !== "approved") continue;

    const type = String(leave.leave_type || "").toUpperCase();
    const factor =
      type === "HD"
        ? policy.halfDayFactor
        : policy.paidLeaveTypes.includes(type)
          ? 1
          : 0;

    if (!factor) continue;

    const from = moment.max(moment(leave.start_date).startOf("day"), payrollStart);
    const to = moment.min(
      moment(leave.end_date || leave.start_date).startOf("day"),
      monthEnd,
    );

    for (const cursor = from.clone(); cursor.isSameOrBefore(to, "day"); cursor.add(1, "day")) {
      const key = cursor.format("YYYY-MM-DD");
      leaveFactorByDate.set(
        key,
        Math.min(1, (leaveFactorByDate.get(key) || 0) + factor),
      );
    }
  }

  // ---------------- walk every day of the payroll period ----------------
  let workingDays = 0;
  let holidayCount = 0;
  let weekOffCount = 0;
  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let absentDays = 0;
  let upcomingDays = 0;
  let lopDays = 0;
  let overtimeHours = 0;

  const days = [];
  const holidayList = [];

  for (
    const cursor = payrollStart.clone();
    cursor.isSameOrBefore(monthEnd, "day");
    cursor.add(1, "day")
  ) {
    const date = cursor.format("YYYY-MM-DD");
    const dayName = WEEK_DAYS[cursor.day()];

    if (weekOffSet.has(dayName)) {
      weekOffCount += 1;
      days.push({ date, type: "week-off" });
      continue;
    }

    if (holidayMap.has(date)) {
      holidayCount += 1;
      holidayList.push({ date, name: holidayMap.get(date) });
      days.push({ date, type: "holiday", name: holidayMap.get(date) });
      continue;
    }

    const record = attendanceMap.get(date);

    // attendance rows that mark the day itself as a non-working day
    if (record && record.status === "holiday") {
      holidayCount += 1;
      holidayList.push({ date, name: "Holiday" });
      days.push({ date, type: "holiday", name: "Holiday" });
      continue;
    }

    if (record && record.status === "weekend") {
      weekOffCount += 1;
      days.push({ date, type: "week-off" });
      continue;
    }

    workingDays += 1;

    const status = record ? record.status : null;
    const leaveFactor = leaveFactorByDate.get(date) || 0;
    const credit = status ? attendanceCredit(status) : 0;
    const isUpcoming = date > today || (date === today && !record);

    let outcome;
    let dayCredit;

    if (status === "on-leave" || status === "leave") {
      // marked on leave by the admin
      paidLeaveDays += 1;
      dayCredit = 1;
      outcome = "paid-leave";
    } else if (credit >= 1) {
      presentDays += 1;
      dayCredit = 1;
      outcome = "present";
    } else {
      dayCredit = Math.min(1, credit + leaveFactor);

      if (dayCredit >= 1) {
        // half-day attendance + half-day leave, or a full paid leave
        if (credit > 0) {
          presentDays += 1;
          outcome = "present";
        } else {
          paidLeaveDays += 1;
          outcome = "paid-leave";
        }
      } else if (dayCredit > 0) {
        halfDays += 1;
        outcome = credit > 0 ? "half-day" : "half-day-leave";
      } else if (isUpcoming) {
        upcomingDays += 1;
        outcome = "upcoming";
      } else {
        absentDays += 1;
        outcome = "absent";
      }
    }

    // loss of pay for the part of a past day that is not covered
    if (!isUpcoming && dayCredit < 1) {
      lopDays += 1 - dayCredit;
    }

    if (record && (status === "present" || status === "half-day")) {
      overtimeHours += num(record.overtime_hours);
    }

    days.push({ date, type: "working", outcome, credit: dayCredit });
  }

  overtimeHours = round2(overtimeHours);

  const totalWorkingDays = workingDays;
  const rawPayable = presentDays + halfDays * 0.5 + paidLeaveDays;
  const payableDays = round2(Math.min(rawPayable, totalWorkingDays));

  // ---------------- salary ----------------
  const fullBasic = num(salary.basic);
  const fullHra = num(salary.hra);
  const fullDa = num(salary.da);
  const fullTa = num(salary.ta);
  const fullOther = num(salary.other);
  const fullGross = round2(fullBasic + fullHra + fullDa + fullTa + fullOther);

  const ratio = totalWorkingDays > 0 ? payableDays / totalWorkingDays : 0;

  const basic = round2(fullBasic * ratio);
  const hra = round2(fullHra * ratio);
  const da = round2(fullDa * ratio);
  const ta = round2(fullTa * ratio);
  const other = round2(fullOther * ratio);

  const earnedSalary = round2(basic + hra + da + ta + other);

  const dailyRate = totalWorkingDays > 0 ? fullGross / totalWorkingDays : 0;
  const lop = round2(lopDays * dailyRate);
  const pendingAccrual = round2(upcomingDays * dailyRate);

  // ---------------- overtime ----------------
  const hourlyRate =
    totalWorkingDays > 0
      ? fullBasic / totalWorkingDays / policy.standardHoursPerDay
      : 0;

  const overtimePay = round2(
    overtimeHours * hourlyRate * policy.overtimeMultiplier,
  );

  // ---------------- deductions ----------------
  const bonusAmount = round2(num(bonus));
  const advanceAmount = round2(num(advance));
  const otherDeductionAmount = round2(num(otherDeductions));

  const pf = round2(basic * policy.pfRate);

  const esic =
    earnedSalary > 0 && fullGross <= policy.esicWageCeiling
      ? round2(earnedSalary * policy.esicRate)
      : 0;

  const pt = earnedSalary > 0 ? policy.professionalTax : 0;

  const totalDeductions = round2(
    pf + esic + pt + advanceAmount + otherDeductionAmount,
  );

  // ---------------- totals ----------------
  const grossSalary = round2(earnedSalary + overtimePay + bonusAmount);
  const netSalary = round2(grossSalary - totalDeductions);

  return {
    period: {
      startDate,
      endDate,
      calendarDays,
      isPartialMonth: upcomingDays > 0,
    },

    counts: {
      calendarDays,
      workingDays: totalWorkingDays,
      workingDaysBeforeHolidays: totalWorkingDays + holidayCount,
      holidays: holidayCount,
      weekOffs: weekOffCount,
      present: presentDays,
      halfDays,
      paidLeave: paidLeaveDays,
      absent: absentDays,
      upcoming: upcomingDays,
      lopDays: round2(lopDays),
      payableDays,
      overtimeHours,
    },

    earnings: {
      basic,
      hra,
      da,
      ta,
      overtime: overtimePay,
      bonus: bonusAmount,
      other,
    },

    deductions: {
      pf,
      esic,
      pt,
      tds: 0,
      advance: advanceAmount,
      lop, // information only - not part of totalDeductions
      other: otherDeductionAmount,
    },

    full: {
      basic: fullBasic,
      hra: fullHra,
      da: fullDa,
      ta: fullTa,
      other: fullOther,
      gross: fullGross,
    },

    earnedSalary,
    grossSalary,
    totalDeductions,
    netSalary,
    pendingAccrual,

    rates: {
      dailyRate: round2(dailyRate),
      hourlyRate: round2(hourlyRate),
      overtimeMultiplier: policy.overtimeMultiplier,
      standardHoursPerDay: policy.standardHoursPerDay,
    },

    holidayList,
    days,
  };
}

module.exports = { computePayroll, DEFAULT_POLICY, round2 };
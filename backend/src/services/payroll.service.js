function getProfessionalTax(monthlyGross) {
  if (monthlyGross > 15000) return 200;
  if (monthlyGross > 10000) return 150;
  if (monthlyGross > 7500) return 100;
  if (monthlyGross > 5000) return 50;
  return 0;
}

/**
 * @param {Object}  params
 * @param {Object}  params.employee          Mongoose Employee doc with salary sub-doc
 * @param {number}  params.presentDays       Full present days
 * @param {number}  params.halfDays          Half-day count
 * @param {number}  params.absentDays        Absent days (informational only)
 * @param {number}  params.payableDays       presentDays + halfDays×0.5 + leaveDays
 * @param {number}  params.totalWorkingDays  Weekdays in month (LOP denominator)
 * @param {number}  params.overtimeHours     Total overtime hours in month
 * @param {number}  params.bonus             One-time bonus / incentive (not pro-rated)
 * @param {number}  params.advance           Advance recovery amount
 * @param {number}  params.otherDeductions   Any other deductions
 */
function calculatePayroll({
  employee,
  presentDays = 0,
  halfDays = 0,
  absentDays = 0,
  payableDays,
  totalWorkingDays,
  overtimeHours = 0,
  bonus = 0,
  advance = 0,
  otherDeductions = 0,
}) {
  const s = employee.salary || {};

  const monthlyBasic = Number(s.basic || 0);
  const monthlyDA = Number(s.da || 0);
  const monthlyHRA = Number(s.hra || 0);
  const monthlyTA = Number(s.ta || 0);
  const monthlyOther = Number(s.other || 0);

  const denom = totalWorkingDays > 0 ? totalWorkingDays : 1;

  const clampedPayableDays = Math.min(Math.max(0, payableDays), denom);

  const dailyBasicRate = monthlyBasic / denom;
  const hourlyRate = dailyBasicRate / 8;
  const overtimePay = Math.round(hourlyRate * 1.5 * overtimeHours);

  const earnings = {
    basic: monthlyBasic,
    da: monthlyDA,
    hra: monthlyHRA,
    ta: monthlyTA,
    overtime: overtimePay,
    bonus: Math.round(bonus),
    other: monthlyOther,
  };

  const grossSalary = Object.values(earnings).reduce((sum, v) => sum + v, 0);

  const lopDays = Math.max(0, denom - clampedPayableDays);
  const monthlyTotal =
    monthlyBasic + monthlyDA + monthlyHRA + monthlyTA + monthlyOther;
  const dailyRate = monthlyTotal / denom;
  const lopAmount = Math.round(lopDays * dailyRate);

  const grossAfterLop = grossSalary - lopAmount;
  const esicDeduction =
    grossAfterLop <= 21000 ? Math.round(grossAfterLop * 0.0075) : 0;

  const advanceDeduction = Math.round(advance);
  const otherDed = Math.round(otherDeductions);

  const deductions = {
    // pf:      pfDeduction,
    esic: esicDeduction,
    advance: advanceDeduction,
    // pt:      ptDeduction,
    tds: 0,
    lop: lopAmount,
    other: otherDed,
  };

  const totalDeductions = Object.values(deductions).reduce(
    (sum, v) => sum + v,
    0,
  );
  const netSalary = grossSalary - totalDeductions;

  return {
    earnings,
    deductions,
    grossSalary,
    totalDeductions,
    netSalary,
  };
}

module.exports = { calculatePayroll };

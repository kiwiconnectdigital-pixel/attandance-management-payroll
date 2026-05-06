/**
 * payroll.service.js
 * Core salary calculation logic — weekday-based pro-rata.
 *
 * Pro-rata formula:
 *   earned = (componentMonthlySalary / weekdaysInMonth) × payableDays
 *
 * payableDays = presentDays + (halfDays × 0.5) + leaveDays
 * absentDays  = weekdaysInMonth − payableDays  (LOP applies here)
 *
 * Earnings on payslip:
 *   Basic & DA  = basic + da  (pro-rated together)
 *   HRA         = pro-rated
 *   Conveyance  = ta (pro-rated)
 *   Incentive   = bonus (fixed, not pro-rated) + overtime pay
 *
 * Deductions:
 *   PF          = 12% of monthly basic (not pro-rated basic), capped ₹1,800
 *   ESIC        = 0.75% of gross earned (if gross ≤ ₹21,000)
 *   Advance     = passed in directly
 *   Prof. Tax   = slab on gross earned
 *   LOP         = (dailyRate × absentDays) — already reflected via pro-rata
 */

function getProfessionalTax(monthlyGross) {
  if (monthlyGross > 15000) return 200;
  if (monthlyGross > 10000) return 150;
  if (monthlyGross >  7500) return 100;
  if (monthlyGross >  5000) return  50;
  return 0;
}

/**
 * @param {Object}  params
 * @param {Object}  params.employee          Mongoose Employee doc with salary sub-doc
 * @param {number}  params.presentDays       Full present days
 * @param {number}  params.halfDays          Half-day count
 * @param {number}  params.absentDays        Absent (LOP) days
 * @param {number}  params.payableDays       presentDays + halfDays×0.5 + leaveDays
 * @param {number}  params.totalWorkingDays  Weekdays in month (pro-rata denominator)
 * @param {number}  params.overtimeHours
 * @param {number}  params.bonus             One-time bonus / incentive
 * @param {number}  params.advance           Advance recovery
 * @param {number}  params.otherDeductions
 */
function calculatePayroll({
  employee,
  presentDays,      // ← add this param
  halfDays = 0,     // ← add this param
  payableDays,
  totalWorkingDays,
  overtimeHours = 0,
  bonus = 0,
  advance = 0,
  otherDeductions = 0,
}) {
  const s = employee.salary || {};

  const monthlyBasic = Number(s.basic || 0);
  const monthlyDA    = Number(s.da    || 0);
  const monthlyHRA   = Number(s.hra   || 0);
  const monthlyTA    = Number(s.ta    || 0);
  const monthlyOther = Number(s.other || 0);

  const denom = totalWorkingDays > 0 ? totalWorkingDays : 1;
  const ratio  = payableDays / denom;

  // ── Pro-rated earnings ────────────────────────────────────────────────────
  const basicEarned = Math.round(monthlyBasic * ratio);
  const daEarned    = Math.round(monthlyDA    * ratio);
  const hraEarned   = Math.round(monthlyHRA   * ratio);
  const taEarned    = Math.round(monthlyTA    * ratio);
  const otherEarned = Math.round(monthlyOther * ratio);

  const dailyBasicRate = monthlyBasic / denom;
  const hourlyRate     = dailyBasicRate / 8;
  const overtimePay    = Math.round(hourlyRate * 1.5 * overtimeHours);

  const earnings = {
    basic:    basicEarned,
    da:       daEarned,
    hra:      hraEarned,
    ta:       taEarned,
    overtime: overtimePay,
    bonus:    Math.round(bonus),
    other:    otherEarned,
  };

  const grossSalary = Object.values(earnings).reduce((s, v) => s + v, 0);

  // ── LOP: visible on payslip as a deduction line ───────────────────────────
  // lopDays = absent days + half-day shortfall (each half-day = 0.5 LOP day)
  const lopDays   = (totalWorkingDays - payableDays);          // e.g. 2.5 days
  const monthlyTotal = monthlyBasic + monthlyDA + monthlyHRA + monthlyTA + monthlyOther;
  const dailyRate    = monthlyTotal / denom;
  const lopAmount    = Math.round(lopDays * dailyRate);        // visible deduction

  // ── Deductions ────────────────────────────────────────────────────────────
  const pfDeduction   = Math.min(Math.round(monthlyBasic * 0.12), 1800);
  const esicDeduction = grossSalary <= 21000
    ? Math.round(grossSalary * 0.0075)
    : 0;
  const ptDeduction      = getProfessionalTax(grossSalary);
  const advanceDeduction = Math.round(advance);
  const otherDed         = Math.round(otherDeductions);

  const deductions = {
    pf:      pfDeduction,
    esic:    esicDeduction,
    advance: advanceDeduction,
    pt:      ptDeduction,
    tds:     0,
    lop:     lopAmount,   // ← now populated!
    other:   otherDed,
  };

  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0);
  const netSalary       = grossSalary - totalDeductions;

  return { earnings, deductions, grossSalary, totalDeductions, netSalary };
}

module.exports = { calculatePayroll };
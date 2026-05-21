/**
 * payroll.service.js
 * Core salary calculation logic — LOP-based deduction (no pro-rata double-count).
 *
 * Strategy (Option B — industry standard):
 *   • Gross always = configured monthly salary + bonus + overtime
 *   • LOP deduction = dailyRate × absentDays  (single deduction, clearly visible)
 *   • No pro-rata ratio applied to earnings — avoids double-counting
 *
 * Earnings on payslip:
 *   Basic & DA  = full monthly basic + da
 *   HRA         = full monthly hra
 *   Conveyance  = full monthly ta
 *   Incentive   = bonus (one-time) + overtime pay
 *
 * Deductions:
 *   PF          = 12% of monthly basic, capped ₹1,800
 *   ESIC        = 0.75% of gross (if gross ≤ ₹21,000)
 *   Advance     = passed in directly
 *   Prof. Tax   = slab on gross
 *   LOP         = dailyRate × max(0, totalWorkingDays − payableDays)
 *
 * payableDays = presentDays + (halfDays × 0.5) + leaveDays
 *             — clamped to totalWorkingDays (can never exceed it)
 */

/**
 * Professional Tax slab (MP / general Indian slab).
 * Adjust slabs per your state if needed.
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
  presentDays   = 0,
  halfDays      = 0,
  absentDays    = 0,
  payableDays,
  totalWorkingDays,
  overtimeHours    = 0,
  bonus            = 0,
  advance          = 0,
  otherDeductions  = 0,
}) {
  const s = employee.salary || {};

  // ── Monthly salary components (configured on employee) ───────────────────
  const monthlyBasic = Number(s.basic || 0);
  const monthlyDA    = Number(s.da    || 0);
  const monthlyHRA   = Number(s.hra   || 0);
  const monthlyTA    = Number(s.ta    || 0);
  const monthlyOther = Number(s.other || 0);

  const denom = totalWorkingDays > 0 ? totalWorkingDays : 1;

  // ── Clamp payableDays — can never exceed totalWorkingDays ────────────────
  // Prevents negative LOP when leaveDays + presentDays > totalWorkingDays
  const clampedPayableDays = Math.min(
    Math.max(0, payableDays),
    denom
  );

  // ── Overtime pay (based on daily basic rate) ──────────────────────────────
  const dailyBasicRate = monthlyBasic / denom;
  const hourlyRate     = dailyBasicRate / 8;
  const overtimePay    = Math.round(hourlyRate * 1.5 * overtimeHours);

  // ── Earnings: always full monthly amounts + bonus + overtime ─────────────
  // LOP is handled as an explicit deduction below — NOT via pro-rata here.
  // This avoids double-counting and keeps gross salary clean & readable.
  const earnings = {
    basic:    monthlyBasic,
    da:       monthlyDA,
    hra:      monthlyHRA,
    ta:       monthlyTA,
    overtime: overtimePay,
    bonus:    Math.round(bonus),
    other:    monthlyOther,
  };

  const grossSalary = Object.values(earnings).reduce((sum, v) => sum + v, 0);

  // ── LOP calculation ───────────────────────────────────────────────────────
  // lopDays = working days not covered by present / leave
  // Math.max(0, ...) ensures LOP is never negative
  const lopDays      = Math.max(0, denom - clampedPayableDays);
  const monthlyTotal = monthlyBasic + monthlyDA + monthlyHRA + monthlyTA + monthlyOther;
  const dailyRate    = monthlyTotal / denom;
  const lopAmount    = Math.round(lopDays * dailyRate);

  // ── Deductions ────────────────────────────────────────────────────────────
  // PF: 12% of full monthly basic, capped at ₹1,800
  // const pfDeduction = Math.min(Math.round(monthlyBasic * 0.12), 1800);

  // ESIC: 0.75% of gross earned (net of LOP), only if gross ≤ ₹21,000
  const grossAfterLop  = grossSalary - lopAmount;
  const esicDeduction  = grossAfterLop <= 21000
    ? Math.round(grossAfterLop * 0.0075)
    : 0;

  // Professional Tax: slab on gross after LOP
  // const ptDeduction = getProfessionalTax(grossAfterLop);

  const advanceDeduction = Math.round(advance);
  const otherDed         = Math.round(otherDeductions);

  const deductions = {
    // pf:      pfDeduction,
    esic:    esicDeduction,
    advance: advanceDeduction,
    // pt:      ptDeduction,
    tds:     0,
    lop:     lopAmount,
    other:   otherDed,
  };

  const totalDeductions = Object.values(deductions).reduce((sum, v) => sum + v, 0);
  const netSalary       = grossSalary - totalDeductions;

  return {
    earnings,
    deductions,
    grossSalary,
    totalDeductions,
    netSalary,
  };
}

module.exports = { calculatePayroll };
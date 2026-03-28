/**
 * Core payroll calculation engine
 * Handles PF, ESIC, PT, TDS, overtime, and LOP
 */
const calculatePayroll = ({
  employee,
  presentDays,
  absentDays,
  totalWorkingDays,
  overtimeHours,
  bonus = 0,
  otherDeductions = 0,
}) => {
  const { basic, hra, da, ta, other } = employee.salary;
  const grossMonthlySalary = basic + hra + da + ta + other;
  
  // Per-day salary
  const perDaySalary = grossMonthlySalary / totalWorkingDays;
  
  // Loss of pay (LOP) for absent days
  const lop = parseFloat((perDaySalary * absentDays).toFixed(2));
  
  // Overtime pay: 2x hourly rate for overtime hours
  const hourlyRate = grossMonthlySalary / (totalWorkingDays * 9);
  const overtimePay = parseFloat((hourlyRate * overtimeHours * 2).toFixed(2));
  
  // Actual gross (proportional to attendance)
  const attendanceGross = parseFloat((perDaySalary * presentDays + overtimePay + bonus).toFixed(2));
  
  // Statutory deductions
  const pfDeduction = parseFloat((basic * (parseFloat(process.env.PF_RATE) || 0.12)).toFixed(2));
  const esicDeduction = attendanceGross <= 21000
    ? parseFloat((attendanceGross * (parseFloat(process.env.ESIC_RATE) || 0.0075)).toFixed(2))
    : 0;
  const ptDeduction = getProfessionalTax(attendanceGross);
  const tdsDeduction = parseFloat((attendanceGross * (parseFloat(process.env.TDS_RATE) || 0.1) / 12).toFixed(2));
  
  const totalDeductions = pfDeduction + esicDeduction + ptDeduction + tdsDeduction + lop + otherDeductions;
  const netSalary = parseFloat((attendanceGross - totalDeductions).toFixed(2));
  
  return {
    earnings: {
      basic: parseFloat((basic * presentDays / totalWorkingDays).toFixed(2)),
      hra: parseFloat((hra * presentDays / totalWorkingDays).toFixed(2)),
      da: parseFloat((da * presentDays / totalWorkingDays).toFixed(2)),
      ta: parseFloat((ta * presentDays / totalWorkingDays).toFixed(2)),
      overtime: overtimePay,
      bonus,
      other: parseFloat((other * presentDays / totalWorkingDays).toFixed(2)),
    },
    deductions: {
      pf: pfDeduction,
      esic: esicDeduction,
      pt: ptDeduction,
      tds: tdsDeduction,
      lop,
      other: otherDeductions,
    },
    grossSalary: attendanceGross,
    totalDeductions,
    netSalary,
  };
};

/**
 * Professional Tax slab (varies by state; Maharashtra example)
 */
const getProfessionalTax = (grossSalary) => {
  if (grossSalary <= 7500) return 0;
  if (grossSalary <= 10000) return 175;
  return 200;
};

module.exports = { calculatePayroll };
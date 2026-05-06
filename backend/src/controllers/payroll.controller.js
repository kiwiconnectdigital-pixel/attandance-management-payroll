const Payroll = require('../models/Payroll.model');
const Employee = require('../models/Employee.model');
const Attendance = require('../models/Attendance.model');
const { calculatePayroll } = require('../services/payroll.service');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const moment = require('moment');

/**
 * Count weekdays (Mon–Fri) in a given month.
 * This is the correct denominator for pro-rata salary — NOT calendar days.
 */
function countWeekdaysInMonth(year, month) {
  const start = moment(`${year}-${String(month).padStart(2,'0')}-01`).startOf('month');
  const end   = start.clone().endOf('month');
  let count = 0;
  const cursor = start.clone();
  while (cursor.isSameOrBefore(end, 'day')) {
    const dow = cursor.day(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) count++;
    cursor.add(1, 'day');
  }
  return count; // e.g. 23 for May 2026
}

module.exports = {
  // @route POST /api/v1/payroll/process
  processPayroll: async (req, res, next) => {
    try {
      const {
        month,
        year,
        employeeId,
        bonus           = 0,
        advance         = 0,
        otherDeductions = 0,
      } = req.body;

      const employee = await Employee.findById(employeeId).populate('branch');
      if (!employee) throw new ApiError(404, 'Employee not found');

      const startDate = moment(`${year}-${month}-01`).startOf('month').toDate();
      const endDate   = moment(`${year}-${month}-01`).endOf('month').toDate();

      const attendanceRecords = await Attendance.find({
        employee: employeeId,
        date: { $gte: startDate, $lte: endDate },
      });

      // ── "No. of days in Month" — calendar days (shown on payslip) ────────
      const calendarDays = moment(`${year}-${month}-01`).daysInMonth(); // 31 for May

      // ── "Total Working Days" — weekdays only, correct pro-rata base ───────
      const weekdaysInMonth = countWeekdaysInMonth(year, month); // 23 for May 2026

      // ── Attendance breakdown (only weekday records) ───────────────────────
      const presentDays = attendanceRecords.filter((a) => a.status === 'present').length;
      const halfDays    = attendanceRecords.filter((a) => a.status === 'half-day').length;
      const leaveDays   = attendanceRecords.filter((a) => a.status === 'on-leave').length;
      const absentDays  = attendanceRecords.filter((a) => a.status === 'absent').length;

      const totalOvertimeHours = attendanceRecords.reduce(
        (sum, a) => sum + (a.overtimeHours || 0), 0
      );

      // payable days = present + half-days (×0.5) + leave days (paid leave)
      const payableDays = presentDays + (halfDays * 0.5) + leaveDays;

      const payrollData = calculatePayroll({
        employee,
        presentDays,
        halfDays,
        absentDays,
        payableDays,
        totalWorkingDays: weekdaysInMonth, // ← weekdays, not calendar days
        overtimeHours:    totalOvertimeHours,
        bonus:            parseFloat(bonus),
        advance:          parseFloat(advance),
        otherDeductions:  parseFloat(otherDeductions),
      });

      const payroll = await Payroll.findOneAndUpdate(
        { employee: employeeId, month, year },
        {
          ...payrollData,
          month, year,
          employee: employeeId,
          attendanceSummary: {
            calendarDays,                      // 31 — "No. of days in Month"
            totalWorkingDays: weekdaysInMonth, // 23 — "Total Working Days" (pro-rata base)
            presentDays,
            halfDays,
            absentDays,
            leaveDays,
            payableDays,
            overtimeHours: totalOvertimeHours,
          },
          status:      'processed',
          processedBy: req.user._id,
          processedOn: new Date(),
        },
        { upsert: true, new: true }
      );

      res.json(new ApiResponse(200, payroll, 'Payroll processed successfully'));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/payroll
  getPayrolls: async (req, res, next) => {
    try {
      const { month, year, employeeId, status } = req.query;
      const filter = {};

      if (month)  filter.month  = parseInt(month);
      if (year)   filter.year   = parseInt(year);
      if (status) filter.status = status;

      if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ user: req.user._id });
        if (emp) filter.employee = emp._id;
      } else if (employeeId) {
        filter.employee = employeeId;
      }

      const payrolls = await Payroll.find(filter)
        .populate('employee', 'name employeeCode department branch')
        .populate('processedBy', 'name')
        .sort({ year: -1, month: -1 });

      res.json(new ApiResponse(200, payrolls));
    } catch (error) {
      next(error);
    }
  },

  // @route PUT /api/v1/payroll/:id/mark-paid
  markPaid: async (req, res, next) => {
    try {
      const payroll = await Payroll.findByIdAndUpdate(
        req.params.id,
        { status: 'paid', paidOn: new Date() },
        { new: true }
      );
      if (!payroll) throw new ApiError(404, 'Payroll not found');
      res.json(new ApiResponse(200, payroll, 'Marked as paid'));
    } catch (error) {
      next(error);
    }
  },
};
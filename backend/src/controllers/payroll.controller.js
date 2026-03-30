const Payroll = require('../models/Payroll.model');
const Employee = require('../models/Employee.model');
const Attendance = require('../models/Attendance.model');
const { calculatePayroll } = require('../services/payroll.service');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const moment = require('moment');

module.exports = {
// @route POST /api/v1/payroll/process
 processPayroll : async (req, res, next) => {
  try {
    const { month, year, employeeId, bonus = 0, incentive = 0, otherDeductions = 0 } = req.body;
    
    const employee = await Employee.findById(employeeId).populate('branch');
    if (!employee) throw new ApiError(404, 'Employee not found');
    
    // Get attendance data for the month
    const startDate = moment(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = moment(`${year}-${month}-01`).endOf('month').toDate();
    
    const attendanceRecords = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate },
    });
    
    const totalWorkingDays = moment(endDate).diff(moment(startDate), 'days') + 1;
    const presentDays = attendanceRecords.filter((a) => a.status === 'present').length;
    const leaveDays = attendanceRecords.filter((a) => a.status === 'on-leave').length;
    const absentDays = totalWorkingDays - presentDays - leaveDays;
    const totalOvertimeHours = attendanceRecords.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
    
    // Calculate payroll using service
    const payrollData = calculatePayroll({
      employee,
      presentDays,
      absentDays,
      totalWorkingDays,
      overtimeHours: totalOvertimeHours,
      bonus: parseFloat(bonus),
      otherDeductions: parseFloat(otherDeductions),
    });
    
    const payroll = await Payroll.findOneAndUpdate(
      { employee: employeeId, month, year },
      {
        ...payrollData,
        month, year,
        employee: employeeId,
        attendanceSummary: { totalWorkingDays, presentDays, absentDays, leaveDays, overtimeHours: totalOvertimeHours },
        status: 'processed',
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
 getPayrolls : async (req, res, next) => {
  try {
    const { month, year, employeeId, status } = req.query;
    const filter = {};
    
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
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
 markPaid : async (req, res, next) => {
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
}
}



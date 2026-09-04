const Leave = require('../models/Leave.model');
const Employee = require('../models/Employee.model');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const moment = require('moment');

module.exports = {
  // @route POST /api/v1/leaves/apply
 // Update the applyLeave method in your leave.controller.js

applyLeave: async (req, res, next) => {
  try {
    const { leaveType, startDate, endDate, reason, halfDayOption } = req.body;
    
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) throw new ApiError(404, 'Employee record not found');
    
    let totalDays;
    let adjustedStartDate = new Date(startDate);
    let adjustedEndDate = new Date(endDate || startDate);
    
    // Handle half-day leave
    if (leaveType === 'HD') {
      totalDays = 0.5;
      // For half-day, start and end date are the same
      adjustedEndDate = new Date(startDate);
    } else {
      totalDays = moment(endDate).diff(moment(startDate), 'days') + 1;
    }
    
    // Check leave balance
    if (employee.leaveBalance[leaveType] < totalDays) {
      throw new ApiError(400, `Insufficient ${leaveType} balance. Available: ${employee.leaveBalance[leaveType]} days`);
    }
    
    // Check for overlapping leaves
    const overlap = await Leave.findOne({
      employee: employee._id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: adjustedEndDate }, endDate: { $gte: adjustedStartDate } },
      ],
    });
    if (overlap) throw new ApiError(400, 'Leave overlaps with an existing application');
    
   const leaveData = {
  employee: employee._id,
  leaveType,
  startDate: adjustedStartDate,
  endDate: adjustedEndDate,
  totalDays,
  reason,
};

// only add for half day
if (leaveType === 'HD') {
  leaveData.halfDayOption = halfDayOption;
}

const leave = await Leave.create(leaveData);
    
    res.status(201).json(new ApiResponse(201, leave, 'Leave applied successfully'));
  } catch (error) {
    next(error);
  }
},

// @route PUT /api/v1/leaves/:id/review (admin/hr)
 reviewLeave : async (req, res, next) => {
  try {
    const { status, reviewRemarks } = req.body;
    const leave = await Leave.findById(req.params.id).populate('employee');
    
    if (!leave) throw new ApiError(404, 'Leave not found');
    if (leave.status !== 'pending') throw new ApiError(400, 'Leave already reviewed');
    
    leave.status = status;
    leave.reviewRemarks = reviewRemarks;
    leave.reviewedBy = req.user._id;
    leave.reviewedOn = new Date();
    await leave.save();
    
    // If approved, deduct from leave balance
    if (status === 'approved') {
      const employee = await Employee.findById(leave.employee._id);
      employee.leaveBalance[leave.leaveType] -= leave.totalDays;
      await employee.save();
    }
    
    res.json(new ApiResponse(200, leave, `Leave ${status}`));
  } catch (error) {
    next(error);
  }
},

// @route GET /api/v1/leaves
 getLeaves : async (req, res, next) => {
  try {
    const filter = {};
    
    if (req.user.role === 'employee') {
      const emp = await Employee.findOne({ user: req.user._id });
      if (emp) filter.employee = emp._id;
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.employeeId) filter.employee = req.query.employeeId;
    
    const leaves = await Leave.find(filter)
      .populate('employee', 'name employeeCode department')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json(new ApiResponse(200, leaves));
  } catch (error) {
    next(error);
  }
}
}

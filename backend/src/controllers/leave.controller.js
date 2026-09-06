// controllers/leave.controller.js - Sequelize Version
const { Leave, Employee, User } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const moment = require('moment');
const { Op } = require('sequelize');

module.exports = {
  // @route POST /api/v1/leaves/apply
  applyLeave: async (req, res, next) => {
    try {
      const { leaveType, startDate, endDate, reason, halfDayOption } = req.body;

      // Get employee
      const employee = await Employee.findOne({
        where: { user_id: req.user.id, is_active: true }
      });
      if (!employee) {
        throw new ApiError(404, 'Employee record not found');
      }

      // Calculate total days
      let totalDays;
      let adjustedStartDate = new Date(startDate);
      let adjustedEndDate = new Date(endDate || startDate);

      if (leaveType === 'HD') {
        totalDays = 0.5;
        adjustedEndDate = new Date(startDate);
      } else {
        totalDays = moment(endDate).diff(moment(startDate), 'days') + 1;
      }

      // Check leave balance
      let balanceField;
      switch (leaveType) {
        case 'CL': balanceField = 'leave_balance_cl'; break;
        case 'SL': balanceField = 'leave_balance_sl'; break;
        case 'PL': balanceField = 'leave_balance_pl'; break;
        default: throw new ApiError(400, 'Invalid leave type');
      }

      if (employee[balanceField] < totalDays) {
        throw new ApiError(400, `Insufficient ${leaveType} balance. Available: ${employee[balanceField]} days`);
      }

      // Check for overlapping leaves
      const overlaps = await Leave.findAll({
        where: {
          employee_id: employee.id,
          status: { [Op.in]: ['pending', 'approved'] },
          [Op.or]: [
            {
              start_date: { [Op.lte]: adjustedEndDate },
              end_date: { [Op.gte]: adjustedStartDate }
            }
          ]
        }
      });

      if (overlaps.length > 0) {
        throw new ApiError(400, 'Leave overlaps with an existing application');
      }

      // Create leave
      const leave = await Leave.create({
        employee_id: employee.id,
        leave_type: leaveType,
        start_date: adjustedStartDate,
        end_date: adjustedEndDate,
        total_days: totalDays,
        reason,
        half_day_option: leaveType === 'HD' ? halfDayOption : null,
        status: 'pending',
        applied_on: new Date()
      });

      const created = await Leave.findByPk(leave.id, {
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'name', 'employee_code']
          }
        ]
      });

      res.status(201).json(new ApiResponse(201, created, 'Leave applied successfully'));
    } catch (error) {
      next(error);
    }
  },

  // @route PUT /api/v1/leaves/:id/review (admin/hr)
  reviewLeave: async (req, res, next) => {
    try {
      const { status, reviewRemarks } = req.body;
      const { id } = req.params;

      // Get leave with employee
      const leave = await Leave.findByPk(id, {
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'leave_balance_cl', 'leave_balance_sl', 'leave_balance_pl']
          }
        ]
      });

      if (!leave) {
        throw new ApiError(404, 'Leave not found');
      }

      if (leave.status !== 'pending') {
        throw new ApiError(400, 'Leave already reviewed');
      }

      // Update leave
      await leave.update({
        status: status,
        review_remarks: reviewRemarks || null,
        reviewed_by: req.user.id,
        reviewed_on: new Date()
      });

      // If approved, deduct from leave balance
      if (status === 'approved') {
        let balanceField;
        switch (leave.leave_type) {
          case 'CL': balanceField = 'leave_balance_cl'; break;
          case 'SL': balanceField = 'leave_balance_sl'; break;
          case 'PL': balanceField = 'leave_balance_pl'; break;
          default: throw new ApiError(400, 'Invalid leave type');
        }

        const employee = leave.employee;
        const currentBalance = employee[balanceField];
        await employee.update({
          [balanceField]: currentBalance - leave.total_days
        });
      }

      const updated = await Leave.findByPk(id, {
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'name', 'employee_code']
          },
          {
            model: User,
            as: 'reviewer',
            attributes: ['id', 'name']
          }
        ]
      });

      res.json(new ApiResponse(200, updated, `Leave ${status}`));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/leaves
  getLeaves: async (req, res, next) => {
    try {
      const { status, employeeId } = req.query;

      const where = {};
      const include = [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'employee_code', 'department']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'name']
        }
      ];

      if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ where: { user_id: req.user.id } });
        if (emp) {
          where.employee_id = emp.id;
        }
      } else if (req.user.role === 'company_admin' || req.user.role === 'hr') {
        include[0].where = { company_id: req.user.company_id };
      }

      if (status) {
        where.status = status;
      }
      if (employeeId) {
        where.employee_id = employeeId;
      }

      const leaves = await Leave.findAll({
        where,
        include,
        order: [['created_at', 'DESC']]
      });

      res.json(new ApiResponse(200, leaves));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/leaves/balance
  getLeaveBalance: async (req, res, next) => {
    try {
      const employee = await Employee.findOne({
        where: { user_id: req.user.id },
        attributes: ['id', 'leave_balance_cl', 'leave_balance_sl', 'leave_balance_pl']
      });

      if (!employee) {
        throw new ApiError(404, 'Employee not found');
      }

      res.json(new ApiResponse(200, {
        CL: employee.leave_balance_cl || 12,
        SL: employee.leave_balance_sl || 12,
        PL: employee.leave_balance_pl || 15
      }));
    } catch (error) {
      next(error);
    }
  }
};
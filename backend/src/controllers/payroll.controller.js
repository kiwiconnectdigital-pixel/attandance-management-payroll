// controllers/payroll.controller.js - Sequelize Version
const { Payroll, Employee, Branch, Company, User, Attendance, Holiday, sequelize } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const moment = require('moment');
const { Op } = require('sequelize');

// Helper function: Count weekdays (Mon-Fri) in a month
function countWorkingDays(year, month) {
  const start = moment(`${year}-${String(month).padStart(2, '0')}-01`);
  const end = start.clone().endOf('month');
  let count = 0;
  const cursor = start.clone();

  while (cursor.isSameOrBefore(end, 'day')) {
    if (cursor.day() !== 0 && cursor.day() !== 6) {
      count++;
    }
    cursor.add(1, 'day');
  }
  return count;
}

module.exports = {
  // @route POST /api/v1/payroll/process
  processPayroll: async (req, res, next) => {
    try {
      const {
        month,
        year,
        employeeId,
        bonus = 0,
        advance = 0,
        otherDeductions = 0,
      } = req.body;

      // Get employee with branch
      const employee = await Employee.findByPk(employeeId, {
        include: [
          { model: Branch, as: 'branch' },
          { model: Company, as: 'company' }
        ]
      });

      if (!employee) {
        throw new ApiError(404, 'Employee not found');
      }

      // Get attendance for the month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = moment(startDate).endOf('month').format('YYYY-MM-DD');

      const attendances = await Attendance.findAll({
        where: {
          employee_id: employeeId,
          date: {
            [Op.between]: [startDate, endDate]
          }
        }
      });

      // Calculate working days
      const calendarDays = moment(startDate).daysInMonth();
      const weekdaysInMonth = countWorkingDays(year, month);
      
      const holidayCount = await Holiday.count({
        where: {
          company_id: employee.company_id,
          year: year,
          month: month,
          is_weekday: true,
          [Op.or]: [
            { branch_id: employee.branch_id },
            { branch_id: null }
          ]
        }
      });

      const totalWorkingDays = weekdaysInMonth - holidayCount;

      // Attendance breakdown
      const presentDays = attendances.filter(a => a.status === 'present').length;
      const halfDays = attendances.filter(a => a.status === 'half-day').length;
      const leaveDays = attendances.filter(a => a.status === 'on-leave').length;
      const absentDays = attendances.filter(a => a.status === 'absent').length;
      const totalOvertimeHours = attendances.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);

      // Calculate payable days
      const rawPayableDays = presentDays + halfDays * 0.5 + leaveDays;
      const payableDays = Math.min(rawPayableDays, totalWorkingDays);

      // Calculate salary components
      const basic = employee.salary_basic || 0;
      const hra = employee.salary_hra || 0;
      const da = employee.salary_da || 0;
      const ta = employee.salary_ta || 0;
      const grossSalary = basic + hra + da + ta;

      // Calculate LOP (Loss of Pay)
      const dailyRate = totalWorkingDays > 0 ? grossSalary / totalWorkingDays : 0;
      const lop = (absentDays / totalWorkingDays) * grossSalary || 0;

      // Calculate ESIC (0.75% of gross)
      const esic = grossSalary * 0.0075;

      // Professional Tax (fixed)
      const pt = 200;

      // Bonus/Overtime
      const overtimeBonus = totalWorkingDays > 0 
        ? (totalOvertimeHours / (totalWorkingDays * 9)) * grossSalary * 0.5 
        : 0;

      // Total deductions
      const totalDeductions = esic + pt + lop + parseFloat(advance) + parseFloat(otherDeductions);

      // Net salary
      const netSalary = grossSalary - totalDeductions + parseFloat(bonus) + overtimeBonus;

      // Upsert payroll
      const [payroll, created] = await Payroll.upsert({
        employee_id: employeeId,
        month: month,
        year: year,
        earning_basic: basic,
        earning_hra: hra,
        earning_da: da,
        earning_ta: ta,
        earning_overtime: 0,
        earning_bonus: parseFloat(bonus),
        earning_other: 0,
        deduction_esic: esic,
        deduction_advance: parseFloat(advance),
        deduction_pt: pt,
        deduction_tds: 0,
        deduction_lop: lop,
        deduction_other: parseFloat(otherDeductions),
        gross_salary: grossSalary,
        total_deductions: totalDeductions,
        net_salary: netSalary,
        att_total_working_days: totalWorkingDays,
        att_present_days: presentDays,
        att_absent_days: absentDays,
        att_leave_days: leaveDays,
        att_overtime_hours: totalOvertimeHours,
        att_calendar_days: calendarDays,
        att_weekdays_in_month: weekdaysInMonth,
        att_holiday_count: holidayCount,
        att_payable_days: payableDays,
        att_half_days: halfDays,
        status: 'processed',
        processed_by: req.user.id,
        processed_on: new Date()
      });

      const result = await Payroll.findByPk(payroll.id, {
        include: [
          { model: Employee, as: 'employee' }
        ]
      });

      res.json(new ApiResponse(200, result, 'Payroll processed successfully'));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/payroll
  getPayrolls: async (req, res, next) => {
    try {
      const { month, year, employeeId, status } = req.query;

      const where = {};
      const include = [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'employee_code', 'department'],
          include: [
            { model: Branch, as: 'branch', attributes: ['id', 'name'] }
          ]
        },
        {
          model: User,
          as: 'processor',
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
      } else if (employeeId) {
        where.employee_id = employeeId;
      }

      if (month) {
        where.month = parseInt(month);
      }
      if (year) {
        where.year = parseInt(year);
      }
      if (status) {
        where.status = status;
      }

      const payrolls = await Payroll.findAll({
        where,
        include,
        order: [['year', 'DESC'], ['month', 'DESC']]
      });

      res.json(new ApiResponse(200, payrolls));
    } catch (error) {
      next(error);
    }
  },

  // @route PUT /api/v1/payroll/:id/mark-paid
  markPaid: async (req, res, next) => {
    try {
      const payroll = await Payroll.findByPk(req.params.id);
      if (!payroll) {
        throw new ApiError(404, 'Payroll not found');
      }

      await payroll.update({
        status: 'paid',
        paid_on: new Date()
      });

      const updated = await Payroll.findByPk(req.params.id, {
        include: [
          { model: Employee, as: 'employee' }
        ]
      });

      res.json(new ApiResponse(200, updated, 'Marked as paid'));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/payroll/employee/:id
  getEmployeePayrolls: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { year } = req.query;

      const where = { employee_id: id };
      if (year) {
        where.year = parseInt(year);
      }

      const payrolls = await Payroll.findAll({
        where,
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'name', 'employee_code']
          }
        ],
        order: [['year', 'DESC'], ['month', 'DESC']]
      });

      res.json(new ApiResponse(200, payrolls));
    } catch (error) {
      next(error);
    }
  }
};
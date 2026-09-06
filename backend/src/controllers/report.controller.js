// controllers/report.controller.js - Sequelize Version
const { generateAttendancePDF, generateAttendanceExcel, generatePayrollPDF } = require('../services/report.service');
const { Attendance, Employee, Branch, Payroll, Company, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { Op } = require('sequelize');

module.exports = {
  // @route GET /api/v1/reports/attendance/pdf
  attendanceReportPDF: async (req, res, next) => {
    try {
      const { month, year, branchId } = req.query;
      if (!month || !year) throw new ApiError(400, 'month and year are required');

      const companyId = req.user.company_id;

      const where = {
        company_id: companyId
      };

      if (branchId) {
        where.branch_id = branchId;
      }

      const employees = await Employee.findAll({
        where,
        attributes: ['id', 'employee_code', 'name', 'department', 'designation'],
        include: [
          { model: Branch, as: 'branch', attributes: ['name'] },
          {
            model: Attendance,
            as: 'attendances',
            where: {
              date: {
                [Op.gte]: `${year}-${String(month).padStart(2, '0')}-01`,
                [Op.lte]: `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
              }
            },
            required: false,
            attributes: ['date', 'status', 'working_hours', 'overtime_hours', 'is_late', 'late_by_minutes']
          }
        ],
        order: [['name', 'ASC']]
      });

      const data = [];
      for (const emp of employees) {
        for (const att of emp.attendances || []) {
          data.push({
            employee_code: emp.employee_code,
            name: emp.name,
            department: emp.department,
            designation: emp.designation,
            branch_name: emp.branch?.name || null,
            date: att.date,
            status: att.status,
            working_hours: att.working_hours,
            overtime_hours: att.overtime_hours,
            is_late: att.is_late,
            late_by_minutes: att.late_by_minutes
          });
        }
      }

      const buffer = await generateAttendancePDF(data, { month, year, companyId });
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="attendance_${year}_${month}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/reports/attendance/excel
  attendanceReportExcel: async (req, res, next) => {
    try {
      const { month, year, branchId } = req.query;
      if (!month || !year) throw new ApiError(400, 'month and year are required');

      const companyId = req.user.company_id;

      const where = {
        company_id: companyId
      };

      if (branchId) {
        where.branch_id = branchId;
      }

      const employees = await Employee.findAll({
        where,
        attributes: ['id', 'employee_code', 'name', 'department', 'designation'],
        include: [
          { model: Branch, as: 'branch', attributes: ['name'] },
          {
            model: Attendance,
            as: 'attendances',
            where: {
              date: {
                [Op.gte]: `${year}-${String(month).padStart(2, '0')}-01`,
                [Op.lte]: `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
              }
            },
            required: false,
            attributes: ['date', 'status', 'working_hours', 'overtime_hours', 'is_late', 'late_by_minutes']
          }
        ],
        order: [['name', 'ASC']]
      });

      const data = [];
      for (const emp of employees) {
        for (const att of emp.attendances || []) {
          data.push({
            employee_code: emp.employee_code,
            name: emp.name,
            department: emp.department,
            designation: emp.designation,
            branch_name: emp.branch?.name || null,
            date: att.date,
            status: att.status,
            working_hours: att.working_hours,
            overtime_hours: att.overtime_hours,
            is_late: att.is_late,
            late_by_minutes: att.late_by_minutes
          });
        }
      }

      const buffer = await generateAttendanceExcel(data, { month, year });
      
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="attendance_${year}_${month}.xlsx"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/reports/payroll/pdf
  payrollReportPDF: async (req, res, next) => {
    try {
      const { month, year, branchId } = req.query;
      if (!month || !year) throw new ApiError(400, 'month and year are required');

      const companyId = req.user.company_id;

      const where = {
        company_id: companyId
      };

      if (branchId) {
        where.branch_id = branchId;
      }

      const payrolls = await Payroll.findAll({
        where: {
          month: parseInt(month),
          year: parseInt(year)
        },
        include: [
          {
            model: Employee,
            as: 'employee',
            where,
            attributes: ['id', 'employee_code', 'name', 'department', 'designation'],
            include: [
              { model: Branch, as: 'branch', attributes: ['name'] }
            ]
          }
        ],
        order: [[{ model: Employee, as: 'employee' }, 'name', 'ASC']]
      });

      const data = payrolls.map(p => ({
        employee_code: p.employee.employee_code,
        name: p.employee.name,
        department: p.employee.department,
        designation: p.employee.designation,
        branch_name: p.employee.branch?.name || null,
        gross_salary: p.gross_salary,
        total_deductions: p.total_deductions,
        net_salary: p.net_salary,
        earning_basic: p.earning_basic,
        earning_hra: p.earning_hra,
        earning_da: p.earning_da,
        earning_ta: p.earning_ta,
        earning_bonus: p.earning_bonus,
        deduction_esic: p.deduction_esic,
        deduction_pt: p.deduction_pt,
        deduction_lop: p.deduction_lop,
        deduction_advance: p.deduction_advance,
        status: p.status
      }));

      const buffer = await generatePayrollPDF(data, { month, year });
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="payroll_${year}_${month}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/reports/summary
  getSummaryReport: async (req, res, next) => {
    try {
      const { month, year } = req.query;
      const companyId = req.user.company_id;

      if (!month || !year) {
        throw new ApiError(400, 'month and year are required');
      }

      // Get employee count
      const totalEmployees = await Employee.count({
        where: { company_id: companyId, is_active: true }
      });

      // Get attendance summary
      const attendanceSummary = await Attendance.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "present" THEN 1 END')), 'present'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "absent" THEN 1 END')), 'absent'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "half-day" THEN 1 END')), 'halfDay'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "on-leave" THEN 1 END')), 'onLeave'],
          [sequelize.fn('SUM', sequelize.col('working_hours')), 'totalWorkingHours'],
          [sequelize.fn('SUM', sequelize.col('overtime_hours')), 'totalOvertimeHours']
        ],
        where: {
          date: {
            [Op.gte]: `${year}-${String(month).padStart(2, '0')}-01`,
            [Op.lte]: `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
          },
          '$employee.company_id$': companyId
        },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: []
          }
        ],
        raw: true
      });

      // Get leave summary
      const leaveSummary = await sequelize.query(
        `SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
         FROM leaves l
         JOIN employees e ON l.employee_id = e.id
         WHERE e.company_id = ? AND MONTH(l.created_at) = ? AND YEAR(l.created_at) = ?`,
        {
          replacements: [companyId, parseInt(month), parseInt(year)],
          type: sequelize.QueryTypes.SELECT
        }
      );

      // Get payroll summary
      const payrollSummary = await Payroll.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalProcessed'],
          [sequelize.fn('SUM', sequelize.col('gross_salary')), 'totalGrossSalary'],
          [sequelize.fn('SUM', sequelize.col('total_deductions')), 'totalDeductions'],
          [sequelize.fn('SUM', sequelize.col('net_salary')), 'totalNetSalary']
        ],
        where: {
          month: parseInt(month),
          year: parseInt(year),
          '$employee.company_id$': companyId
        },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: []
          }
        ],
        raw: true
      });

      // Get branch-wise attendance
      const branchWise = await Branch.findAll({
        where: {
          company_id: companyId,
          is_active: true
        },
        attributes: ['id', 'name'],
        include: [
          {
            model: Employee,
            as: 'employees',
            attributes: [],
            include: [
              {
                model: Attendance,
                as: 'attendances',
                attributes: [],
                where: {
                  date: {
                    [Op.gte]: `${year}-${String(month).padStart(2, '0')}-01`,
                    [Op.lte]: `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
                  }
                },
                required: false
              }
            ]
          }
        ]
      });

      const branchWiseData = branchWise.map(b => {
        const employees = b.employees || [];
        return {
          id: b.id,
          branch_name: b.name,
          totalEmployees: employees.length,
          presentDays: employees.reduce((sum, e) => {
            return sum + (e.attendances || []).filter(a => a.status === 'present').length;
          }, 0)
        };
      });

      res.json(new ApiResponse(200, {
        totalEmployees,
        attendance: attendanceSummary[0] || { present: 0, absent: 0, halfDay: 0, onLeave: 0 },
        leaves: leaveSummary[0] || { pending: 0, approved: 0, rejected: 0 },
        payroll: payrollSummary[0] || { totalProcessed: 0, totalGrossSalary: 0, totalDeductions: 0, totalNetSalary: 0 },
        branchWise: branchWiseData
      }));
    } catch (error) {
      next(error);
    }
  }
};
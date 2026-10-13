const {
  Payroll,
  Employee,
  Branch,
  Company,
  User,
  Attendance,
  Holiday,
  Leave,
  CompanySetting,
  sequelize,
} = require("../models");

const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

const moment = require("moment");
const { Op } = require("sequelize");

const { computePayroll } = require("../services/payrollCalculator.service");

function countWorkingDays(year, month) {
  const start = moment(`${year}-${String(month).padStart(2, "0")}-01`);

  const end = start.clone().endOf("month");

  let count = 0;

  const cursor = start.clone();

  while (cursor.isSameOrBefore(end, "day")) {
    const day = cursor.day();

    if (day !== 0 && day !== 6) {
      count++;
    }

    cursor.add(1, "day");
  }

  return count;
}

const safeParseFloat = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = parseFloat(value);

  return Number.isNaN(parsed) ? 0 : parsed;
};

const safeParseInt = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = parseInt(value, 10);

  return Number.isNaN(parsed) ? 0 : parsed;
};

const round2 = (number) => {
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

const ESIC_WAGE_CEILING = 21000;

const todayInIndia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );

/**
 * Optional per-company payroll policy.
 * Add rows to the company_settings table to override the defaults:
 *   payroll_standard_hours_per_day   (default 9)
 *   payroll_overtime_multiplier      (default 2)
 *   payroll_professional_tax         (default 200, rupees per month)
 *   payroll_pf_percent               (default 12, % of earned basic)
 */
async function loadPayrollPolicy(companyId) {
  const policy = {};

  try {
    const rows = await CompanySetting.findAll({
      where: {
        company_id: companyId,
        is_deleted: false,
        setting_key: {
          [Op.in]: [
            "payroll_standard_hours_per_day",
            "payroll_overtime_multiplier",
            "payroll_professional_tax",
            "payroll_pf_percent",
          ],
        },
      },
    });

    for (const row of rows) {
      const value = parseFloat(row.setting_value);

      if (!Number.isFinite(value) || value < 0) continue;

      if (row.setting_key === "payroll_standard_hours_per_day" && value > 0) {
        policy.standardHoursPerDay = value;
      } else if (
        row.setting_key === "payroll_overtime_multiplier" &&
        value > 0
      ) {
        policy.overtimeMultiplier = value;
      } else if (row.setting_key === "payroll_professional_tax") {
        policy.professionalTax = value;
      } else if (row.setting_key === "payroll_pf_percent" && value <= 100) {
        policy.pfRate = value / 100;
      }
    }
  } catch (error) {
    console.warn("Payroll policy settings could not be loaded:", error.message);
  }

  return policy;
}

/**
 * Loads everything needed for one employee/month and runs the calculator.
 * Used by both processPayroll (saves the result) and previewPayroll (does not).
 */
async function preparePayroll(body) {
  const {
    month,
    year,
    employeeId,
    bonus = 0,
    advance = 0,
    otherDeductions = 0,
  } = body;

  const parsedMonth = safeParseInt(month);
  const parsedYear = safeParseInt(year);
  const parsedEmployeeId = safeParseInt(employeeId);

  if (!parsedMonth || parsedMonth < 1 || parsedMonth > 12) {
    throw new ApiError(400, "Valid month is required (1-12)");
  }

  if (!parsedYear || parsedYear < 2000) {
    throw new ApiError(400, "Valid year is required");
  }

  if (!parsedEmployeeId) {
    throw new ApiError(400, "Employee ID is required");
  }

  const employee = await Employee.findByPk(parsedEmployeeId, {
    include: [
      { model: Branch, as: "branch" },
      { model: Company, as: "company" },
    ],
  });

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  if (!employee.company) {
    throw new ApiError(400, "Company information not found for this employee");
  }

  const company = employee.company;

  // ---------------- company working-day configuration ----------------
  const workingDaysPerWeek = safeParseInt(company.working_days_per_week) || 6;

  let weekOffDays = company.week_off_days;

  if (typeof weekOffDays === "string") {
    try {
      weekOffDays = JSON.parse(weekOffDays);
    } catch (error) {
      weekOffDays = ["sunday"];
    }
  }

  if (!Array.isArray(weekOffDays)) {
    weekOffDays = ["sunday"];
  }

  weekOffDays = weekOffDays.map((day) => String(day).trim().toLowerCase());

  if (workingDaysPerWeek < 1 || workingDaysPerWeek > 7) {
    throw new ApiError(400, "Company working days configuration is invalid");
  }

  if (7 - weekOffDays.length !== workingDaysPerWeek) {
    throw new ApiError(
      400,
      `Invalid company configuration. Working days per week is ${workingDaysPerWeek}, but week-off days are ${weekOffDays.length}`,
    );
  }

  // ---------------- existing payroll ----------------
  const existing = await Payroll.findOne({
    where: {
      employee_id: parsedEmployeeId,
      month: parsedMonth,
      year: parsedYear,
    },
  });

  // ---------------- period ----------------
  const monthStart = moment(
    `${parsedYear}-${String(parsedMonth).padStart(2, "0")}-01`,
  ).startOf("day");

  const monthEnd = monthStart.clone().endOf("month").startOf("day");

  let payrollStartDate = monthStart.clone();

  if (employee.date_of_joining) {
    const joiningDate = moment(employee.date_of_joining).startOf("day");

    if (joiningDate.isAfter(payrollStartDate, "day")) {
      payrollStartDate = joiningDate.clone();
    }
  }

  if (payrollStartDate.isAfter(monthEnd, "day")) {
    throw new ApiError(
      400,
      "Employee had not joined the company during this payroll month",
    );
  }

  const startDate = payrollStartDate.format("YYYY-MM-DD");
  const endDate = monthEnd.format("YYYY-MM-DD");

  // ---------------- data for the month ----------------
  const [holidays, attendances, leaves, policy] = await Promise.all([
    // company-wide and branch holidays that are not deleted
    Holiday.findAll({
      where: {
        company_id: employee.company_id,
        is_deleted: false,
        date: { [Op.between]: [startDate, endDate] },
        [Op.or]: [{ branch_id: employee.branch_id }, { branch_id: null }],
      },
    }),

    Attendance.findAll({
      where: {
        employee_id: parsedEmployeeId,
        is_deleted: false,
        date: { [Op.between]: [startDate, endDate] },
      },
      order: [["date", "ASC"]],
    }),

    // approved leaves touching this period
    Leave.findAll({
      where: {
        employee_id: parsedEmployeeId,
        status: "approved",
        is_deleted: false,
        start_date: { [Op.lte]: endDate },
        end_date: { [Op.gte]: startDate },
      },
    }),

    loadPayrollPolicy(employee.company_id),
  ]);

  const calc = computePayroll({
    year: parsedYear,
    month: parsedMonth,
    joiningDate: employee.date_of_joining,
    weekOffDays,
    holidays: holidays.map((holiday) => ({
      date: holiday.date,
      name: holiday.name,
      type: holiday.type,
    })),
    attendances: attendances.map((record) => ({
      date: record.date,
      status: record.status,
      overtime_hours: record.overtime_hours,
    })),
    leaves: leaves.map((leave) => ({
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      half_day_option: leave.half_day_option,
      status: leave.status,
    })),
    salary: {
      basic: safeParseFloat(employee.salary_basic),
      hra: safeParseFloat(employee.salary_hra),
      da: safeParseFloat(employee.salary_da),
      ta: safeParseFloat(employee.salary_ta),
      other: safeParseFloat(employee.salary_other),
    },
    bonus: safeParseFloat(bonus),
    advance: safeParseFloat(advance),
    otherDeductions: safeParseFloat(otherDeductions),
    today: todayInIndia(),
    policy,
  });

  return {
    employee,
    existing,
    calc,
    month: parsedMonth,
    year: parsedYear,
    employeeId: parsedEmployeeId,
    startDate,
    endDate,
    configuration: { workingDaysPerWeek, weekOffDays },
  };
}

const buildAttendanceSummary = (ctx) => {
  const { calc } = ctx;

  return {
    payrollStartDate: ctx.startDate,
    payrollEndDate: ctx.endDate,
    calendarDays: calc.counts.calendarDays,
    workingDays: calc.counts.workingDays,
    workingDaysBeforeHolidays: calc.counts.workingDaysBeforeHolidays,
    holidays: calc.counts.holidays,
    present: calc.counts.present,
    halfDays: calc.counts.halfDays,
    leave: calc.counts.paidLeave,
    paidLeave: calc.counts.paidLeave,
    absent: calc.counts.absent,
    upcoming: calc.counts.upcoming,
    lopDays: calc.counts.lopDays,
    payableDays: calc.counts.payableDays,
    overtimeHours: calc.counts.overtimeHours,
    isPartialMonth: calc.period.isPartialMonth,
  };
};

const buildSalarySummary = (ctx) => {
  const { calc } = ctx;

  return {
    fullBasicSalary: calc.full.basic,
    fullHraSalary: calc.full.hra,
    fullDaSalary: calc.full.da,
    fullTaSalary: calc.full.ta,
    fullOtherSalary: calc.full.other,
    fullGrossSalary: calc.full.gross,

    earnedBasicSalary: calc.earnings.basic,
    earnedHraSalary: calc.earnings.hra,
    earnedDaSalary: calc.earnings.da,
    earnedTaSalary: calc.earnings.ta,
    earnedOtherSalary: calc.earnings.other,
    earnedGrossSalary: calc.earnedSalary,

    // everything in the earnings column (earned salary + overtime + bonus)
    grossSalary: calc.grossSalary,

    lop: calc.deductions.lop,
    pf: calc.deductions.pf,
    esic: calc.deductions.esic,
    professionalTax: calc.deductions.pt,
    overtime: calc.earnings.overtime,
    bonus: calc.earnings.bonus,
    advance: calc.deductions.advance,
    otherDeductions: calc.deductions.other,
    totalDeductions: calc.totalDeductions,
    netSalary: calc.netSalary,
  };
};

module.exports = {
  processPayroll: async (req, res, next) => {
    try {
      const ctx = await preparePayroll(req.body);
      const { calc, existing } = ctx;

      if (existing && existing.status === "paid") {
        throw new ApiError(
          400,
          "Payroll already paid for this period and cannot be reprocessed",
        );
      }

      const payrollData = {
        employee_id: ctx.employeeId,
        month: ctx.month,
        year: ctx.year,

        earning_basic: calc.earnings.basic,
        earning_hra: calc.earnings.hra,
        earning_da: calc.earnings.da,
        earning_ta: calc.earnings.ta,
        earning_overtime: calc.earnings.overtime,
        earning_bonus: calc.earnings.bonus,
        earning_other: calc.earnings.other,

        deduction_pf: calc.deductions.pf,
        deduction_esic: calc.deductions.esic,
        deduction_advance: calc.deductions.advance,
        deduction_pt: calc.deductions.pt,
        deduction_tds: calc.deductions.tds,
        deduction_lop: calc.deductions.lop,
        deduction_other: calc.deductions.other,

        // gross = the total of the earnings column, so
        // gross - total deductions = net on every screen, report and payslip
        gross_salary: calc.grossSalary,
        total_deductions: calc.totalDeductions,
        net_salary: calc.netSalary,

        att_total_working_days: calc.counts.workingDays,
        att_present_days: calc.counts.present,
        att_absent_days: calc.counts.absent,
        att_leave_days: calc.counts.paidLeave,
        att_overtime_hours: calc.counts.overtimeHours,
        att_calendar_days: calc.counts.calendarDays,
        att_weekdays_in_month: calc.counts.workingDaysBeforeHolidays,
        att_holiday_count: calc.counts.holidays,
        att_payable_days: calc.counts.payableDays,
        att_half_days: calc.counts.halfDays,

        status: "processed",
        processed_by: req.user?.id || null,
        processed_on: new Date(),
      };

      let payroll;

      if (existing) {
        await existing.update(payrollData);
        payroll = existing;
      } else {
        payroll = await Payroll.create(payrollData);
      }

      const result = await Payroll.findByPk(payroll.id, {
        include: [{ model: Employee, as: "employee" }],
      });

      return res.json(
        new ApiResponse(
          200,
          {
            payroll: result,
            payrollConfiguration: ctx.configuration,
            attendanceSummary: buildAttendanceSummary(ctx),
            salarySummary: buildSalarySummary(ctx),
            holidays: calc.holidayList,
          },
          "Payroll processed successfully",
        ),
      );
    } catch (error) {
      console.error("❌ Payroll processing error:", error);

      next(error);
    }
  },

  /**
   * Same calculation as processPayroll, but nothing is saved.
   * The payroll screen calls this so the preview always matches the result.
   */
  previewPayroll: async (req, res, next) => {
    try {
      const ctx = await preparePayroll(req.body);
      const { calc, existing } = ctx;

      return res.json(
        new ApiResponse(
          200,
          {
            alreadyPaid: Boolean(existing && existing.status === "paid"),
            alreadyProcessed: Boolean(existing),
            period: calc.period,
            counts: calc.counts,
            earnings: calc.earnings,
            deductions: calc.deductions,
            full: calc.full,
            earnedSalary: calc.earnedSalary,
            grossSalary: calc.grossSalary,
            totalDeductions: calc.totalDeductions,
            netSalary: calc.netSalary,
            pendingAccrual: calc.pendingAccrual,
            rates: calc.rates,
            holidays: calc.holidayList,
          },
          "Payroll preview calculated",
        ),
      );
    } catch (error) {
      next(error);
    }
  },

  getPayrolls: async (req, res, next) => {
    try {
      const { month, year, employeeId, status } = req.query;

      const where = {
        is_deleted: false,
      };

      const include = [
        {
          model: Employee,

          as: "employee",

          attributes: ["id", "name", "employee_code", "department", "email"],

          include: [
            {
              model: Branch,
              as: "branch",

              attributes: ["id", "name"],
            },
          ],
        },

        {
          model: User,

          as: "processor",

          attributes: ["id", "name"],
        },
      ];

      if (req.user && req.user.role === "employee") {
        const emp = await Employee.findOne({
          where: {
            user_id: req.user.id,

            is_deleted: false,
          },
        });

        if (emp) {
          where.employee_id = emp.id;
        } else {
          throw new ApiError(404, "Employee profile not found");
        }
      } else if (
        req.user &&
        (req.user.role === "company_admin" || req.user.role === "hr")
      ) {
        include[0].where = {
          company_id: req.user.company_id,
        };
      } else if (employeeId) {
        where.employee_id = safeParseInt(employeeId);
      }

      if (month) {
        const parsedMonth = safeParseInt(month);

        if (parsedMonth < 1 || parsedMonth > 12) {
          throw new ApiError(400, "Month must be between 1 and 12");
        }

        where.month = parsedMonth;
      }

      if (year) {
        where.year = safeParseInt(year);
      }

      if (status) {
        if (!["draft", "processed", "paid"].includes(status)) {
          throw new ApiError(400, "Invalid payroll status");
        }

        where.status = status;
      }

      const payrolls = await Payroll.findAll({
        where,

        include,

        order: [
          ["year", "DESC"],
          ["month", "DESC"],
        ],
      });

      return res.json(
        new ApiResponse(200, payrolls, "Payrolls fetched successfully"),
      );
    } catch (error) {
      next(error);
    }
  },

  markPaid: async (req, res, next) => {
    try {
      const payroll = await Payroll.findOne({
        where: {
          id: req.params.id,
          is_deleted: false,
        },
      });

      if (!payroll) {
        throw new ApiError(404, "Payroll not found");
      }

      if (payroll.status === "paid") {
        throw new ApiError(400, "Payroll is already marked as paid");
      }

      await payroll.update({
        status: "paid",

        paid_on: new Date(),

        updated_by: req.user?.id || null,
      });

      const updated = await Payroll.findByPk(payroll.id, {
        include: [
          {
            model: Employee,
            as: "employee",
          },
        ],
      });

      return res.json(new ApiResponse(200, updated, "Payroll marked as paid"));
    } catch (error) {
      next(error);
    }
  },

  getEmployeePayrolls: async (req, res, next) => {
    try {
      const { id } = req.params;

      const { year } = req.query;

      const employeeId = safeParseInt(id);

      if (!employeeId) {
        throw new ApiError(400, "Invalid employee ID");
      }

      const employee = await Employee.findByPk(employeeId);

      if (!employee) {
        throw new ApiError(404, "Employee not found");
      }

      const where = {
        employee_id: employeeId,

        is_deleted: false,
      };

      if (year) {
        where.year = safeParseInt(year);
      }

      const payrolls = await Payroll.findAll({
        where,

        include: [
          {
            model: Employee,

            as: "employee",

            attributes: ["id", "name", "employee_code", "department"],
          },
        ],

        order: [
          ["year", "DESC"],
          ["month", "DESC"],
        ],
      });

      return res.json(
        new ApiResponse(
          200,
          payrolls,
          "Employee payrolls fetched successfully",
        ),
      );
    } catch (error) {
      next(error);
    }
  },
};
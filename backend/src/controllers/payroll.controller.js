const {
  Payroll,
  Employee,
  Branch,
  Company,
  User,
  Attendance,
  Holiday,
  sequelize,
} = require("../models");

const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

const moment = require("moment");
const { Op } = require("sequelize");

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

module.exports = {
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

    const parsedMonth = safeParseInt(month);
    const parsedYear = safeParseInt(year);
    const parsedEmployeeId = safeParseInt(employeeId);

    const parsedBonus = safeParseFloat(bonus);
    const parsedAdvance = safeParseFloat(advance);
    const parsedOtherDeductions = safeParseFloat(otherDeductions);

    if (!parsedMonth || parsedMonth < 1 || parsedMonth > 12) {
      throw new ApiError(400, "Valid month is required (1-12)");
    }

    if (!parsedYear || parsedYear < 2000) {
      throw new ApiError(400, "Valid year is required");
    }

    if (!parsedEmployeeId) {
      throw new ApiError(400, "Employee ID is required");
    }

    // ============================================================
    // 1. GET EMPLOYEE
    // ============================================================

    const employee = await Employee.findByPk(parsedEmployeeId, {
      include: [
        {
          model: Branch,
          as: "branch",
        },
        {
          model: Company,
          as: "company",
        },
      ],
    });

    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    if (!employee.company) {
      throw new ApiError(
        400,
        "Company information not found for this employee"
      );
    }

    const company = employee.company;

    // ============================================================
    // 2. COMPANY WORKING-DAY CONFIGURATION
    // ============================================================

    const workingDaysPerWeek =
      safeParseInt(company.working_days_per_week) || 6;

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

    weekOffDays = weekOffDays.map((day) =>
      String(day).trim().toLowerCase()
    );

    if (workingDaysPerWeek < 1 || workingDaysPerWeek > 7) {
      throw new ApiError(
        400,
        "Company working days configuration is invalid"
      );
    }

    if (7 - weekOffDays.length !== workingDaysPerWeek) {
      throw new ApiError(
        400,
        `Invalid company configuration. Working days per week is ${workingDaysPerWeek}, but week-off days are ${weekOffDays.length}`
      );
    }

    // ============================================================
    // 3. CHECK EXISTING PAYROLL
    // ============================================================

    const existing = await Payroll.findOne({
      where: {
        employee_id: parsedEmployeeId,
        month: parsedMonth,
        year: parsedYear,
      },
    });

    if (existing && existing.status === "paid") {
      throw new ApiError(
        400,
        "Payroll already paid for this period and cannot be reprocessed"
      );
    }

    // ============================================================
    // 4. MONTH DATES
    // ============================================================

    const monthStart = moment(
      `${parsedYear}-${String(parsedMonth).padStart(2, "0")}-01`
    ).startOf("day");

    const monthEnd = monthStart.clone().endOf("month").startOf("day");

    let payrollStartDate = monthStart.clone();

    // Employee joining date
    if (employee.date_of_joining) {
      const joiningDate = moment(employee.date_of_joining).startOf("day");

      if (joiningDate.isAfter(payrollStartDate, "day")) {
        payrollStartDate = joiningDate.clone();
      }
    }

    if (payrollStartDate.isAfter(monthEnd, "day")) {
      throw new ApiError(
        400,
        "Employee had not joined the company during this payroll month"
      );
    }

    const startDate = payrollStartDate.format("YYYY-MM-DD");
    const endDate = monthEnd.format("YYYY-MM-DD");

    const calendarDays = monthStart.daysInMonth();

    // ============================================================
    // 5. GET HOLIDAYS
    // ============================================================

    const holidays = await Holiday.findAll({
      where: {
        company_id: employee.company_id,
        year: parsedYear,
        month: parsedMonth,
        is_weekday: true,
        [Op.or]: [
          {
            branch_id: employee.branch_id,
          },
          {
            branch_id: null,
          },
        ],
      },
    });

    const holidayDates = new Set();

    for (const holiday of holidays) {
      if (!holiday.date) {
        continue;
      }

      const holidayDate = moment(holiday.date).startOf("day");

      if (
        holidayDate.isBefore(payrollStartDate, "day") ||
        holidayDate.isAfter(monthEnd, "day")
      ) {
        continue;
      }

      const dateKey = holidayDate.format("YYYY-MM-DD");

      holidayDates.add(dateKey);
    }

    // ============================================================
    // 6. CREATE ACTUAL WORKING-DAY LIST
    //
    // THIS IS THE IMPORTANT FIX.
    //
    // Every expected working day is created here.
    // If there is no attendance record for that day,
    // it will automatically become ABSENT.
    // ============================================================

    const weekDayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    const weekOffSet = new Set(weekOffDays);

    const workingDateList = [];

    let cursor = payrollStartDate.clone();

    while (cursor.isSameOrBefore(monthEnd, "day")) {
      const dateKey = cursor.format("YYYY-MM-DD");
      const dayName = weekDayNames[cursor.day()];

      const isWeekOff = weekOffSet.has(dayName);
      const isHoliday = holidayDates.has(dateKey);

      if (!isWeekOff && !isHoliday) {
        workingDateList.push(dateKey);
      }

      cursor.add(1, "day");
    }

    const totalWorkingDays = workingDateList.length;

    const holidayCount = holidayDates.size;

    const workingDaysBeforeHolidays =
      totalWorkingDays + holidayCount;

    // ============================================================
    // 7. GET ATTENDANCE
    // ============================================================

    const attendances = await Attendance.findAll({
      where: {
        employee_id: parsedEmployeeId,
        date: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [["date", "ASC"]],
    });

    // ============================================================
    // 8. CREATE ATTENDANCE MAP
    // ============================================================

    const attendanceMap = new Map();

    for (const attendance of attendances) {
      const attendanceDate = moment(attendance.date).format(
        "YYYY-MM-DD"
      );

      // Only attendance on actual working days counts
      if (!workingDateList.includes(attendanceDate)) {
        continue;
      }

      attendanceMap.set(attendanceDate, attendance);
    }

    // ============================================================
    // 9. CALCULATE ATTENDANCE
    //
    // Missing attendance = ABSENT
    // ============================================================

    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let totalOvertimeHours = 0;

    for (const workingDate of workingDateList) {
      const attendance = attendanceMap.get(workingDate);

      // ----------------------------------------------------------
      // NO ATTENDANCE RECORD
      // ----------------------------------------------------------

      if (!attendance) {
        absentDays++;
        continue;
      }

      const status = String(attendance.status || "")
        .trim()
        .toLowerCase();

      // ----------------------------------------------------------
      // PRESENT
      // ----------------------------------------------------------

      if (status === "present") {
        presentDays++;
      }

      // ----------------------------------------------------------
      // HALF DAY
      // ----------------------------------------------------------

      else if (
        status === "half-day" ||
        status === "half_day" ||
        status === "halfday"
      ) {
        halfDays++;
      }

      // ----------------------------------------------------------
      // LEAVE
      // ----------------------------------------------------------

      else if (
        status === "on-leave" ||
        status === "on_leave" ||
        status === "leave"
      ) {
        leaveDays++;
      }

      // ----------------------------------------------------------
      // ABSENT
      // ----------------------------------------------------------

      else if (status === "absent") {
        absentDays++;
      }

      // ----------------------------------------------------------
      // UNKNOWN / EMPTY STATUS
      // Treat as absent
      // ----------------------------------------------------------

      else {
        absentDays++;
      }

      totalOvertimeHours += safeParseFloat(
        attendance.overtime_hours
      );
    }

    totalOvertimeHours = round2(totalOvertimeHours);

    // ============================================================
    // 10. PAYABLE DAYS
    // ============================================================

    const rawPayableDays =
      presentDays +
      halfDays * 0.5 +
      leaveDays;

    const payableDays = round2(
      Math.min(rawPayableDays, totalWorkingDays)
    );

    // ============================================================
    // 11. FULL SALARY
    // ============================================================

    const fullBasic = safeParseFloat(employee.salary_basic);
    const fullHra = safeParseFloat(employee.salary_hra);
    const fullDa = safeParseFloat(employee.salary_da);
    const fullTa = safeParseFloat(employee.salary_ta);
    const fullOther = safeParseFloat(employee.salary_other);

    const fullGross = round2(
      fullBasic +
      fullHra +
      fullDa +
      fullTa +
      fullOther
    );

    // ============================================================
    // 12. SALARY PRORATION
    // ============================================================

    const payableRatio =
      totalWorkingDays > 0
        ? payableDays / totalWorkingDays
        : 0;

    const basic = round2(fullBasic * payableRatio);

    const hra = round2(fullHra * payableRatio);

    const da = round2(fullDa * payableRatio);

    const ta = round2(fullTa * payableRatio);

    const other = round2(fullOther * payableRatio);

    // ============================================================
    // 13. GROSS EARNED SALARY
    // ============================================================

    const grossSalary = round2(
      basic +
      hra +
      da +
      ta +
      other
    );

    // ============================================================
    // 14. LOSS OF PAY
    //
    // IMPORTANT:
    // LOP = salary that was not earned.
    //
    // Do NOT add LOP again to total deductions because
    // grossSalary has already been prorated.
    // ============================================================

    const lop = round2(
      Math.max(0, fullGross - grossSalary)
    );

    // ============================================================
    // 15. PF
    // ============================================================

    const pf = round2(
      basic * 0.12
    );

    // ============================================================
    // 16. ESIC
    // ============================================================

    let esic = 0;

    if (grossSalary > 0 && fullGross <= ESIC_WAGE_CEILING) {
      esic = round2(
        grossSalary * 0.0075
      );
    }

    // ============================================================
    // 17. PROFESSIONAL TAX
    //
    // Do NOT deduct PT when there is no earned salary.
    // ============================================================

    let pt = 0;

    if (grossSalary > 0) {
      pt = 200;
    }

    // ============================================================
    // 18. OVERTIME
    // ============================================================

    const standardHoursPerDay = 9;

    let hourlyRate = 0;

    if (totalWorkingDays > 0) {
      hourlyRate =
        fullBasic /
        totalWorkingDays /
        standardHoursPerDay;
    }

    const overtimeBonus = round2(
      totalOvertimeHours *
      hourlyRate *
      2
    );

    // ============================================================
    // 19. TOTAL DEDUCTIONS
    //
    // LOP is NOT included here because salary is already prorated.
    // ============================================================

    const totalDeductions = round2(
      pf +
      esic +
      pt +
      parsedAdvance +
      parsedOtherDeductions
    );

    // ============================================================
    // 20. NET SALARY
    // ============================================================

    const netSalary = round2(
      grossSalary -
      totalDeductions +
      parsedBonus +
      overtimeBonus
    );

    // ============================================================
    // 21. PAYROLL DATA
    // ============================================================

    const payrollData = {
      employee_id: parsedEmployeeId,

      month: parsedMonth,

      year: parsedYear,

      earning_basic: basic,

      earning_hra: hra,

      earning_da: da,

      earning_ta: ta,

      earning_overtime: overtimeBonus,

      earning_bonus: parsedBonus,

      earning_other: other,

      deduction_pf: pf,

      deduction_esic: esic,

      deduction_advance: parsedAdvance,

      deduction_pt: pt,

      deduction_tds: 0,

      deduction_lop: lop,

      deduction_other: parsedOtherDeductions,

      gross_salary: grossSalary,

      total_deductions: totalDeductions,

      net_salary: netSalary,

      att_total_working_days: totalWorkingDays,

      att_present_days: presentDays,

      att_absent_days: absentDays,

      att_leave_days: leaveDays,

      att_overtime_hours: totalOvertimeHours,

      att_calendar_days: calendarDays,

      att_weekdays_in_month: workingDaysBeforeHolidays,

      att_holiday_count: holidayCount,

      att_payable_days: payableDays,

      att_half_days: halfDays,

      status: "processed",

      processed_by: req.user?.id || null,

      processed_on: new Date(),
    };

    // ============================================================
    // 22. CREATE / UPDATE PAYROLL
    // ============================================================

    let payroll;

    if (existing) {
      await existing.update(payrollData);
      payroll = existing;
    } else {
      payroll = await Payroll.create(payrollData);
    }

    // ============================================================
    // 23. FETCH FINAL PAYROLL
    // ============================================================

    const result = await Payroll.findByPk(payroll.id, {
      include: [
        {
          model: Employee,
          as: "employee",
        },
      ],
    });

    // ============================================================
    // 24. RESPONSE
    // ============================================================

    return res.json(
      new ApiResponse(
        200,
        {
          payroll: result,

          payrollConfiguration: {
            workingDaysPerWeek,
            weekOffDays,
          },

          attendanceSummary: {
            payrollStartDate: startDate,

            payrollEndDate: endDate,

            calendarDays,

            workingDays: totalWorkingDays,

            workingDaysBeforeHolidays,

            holidays: holidayCount,

            present: presentDays,

            halfDays,

            leave: leaveDays,

            absent: absentDays,

            payableDays,

            overtimeHours: totalOvertimeHours,
          },

          salarySummary: {
            fullBasicSalary: fullBasic,

            fullHraSalary: fullHra,

            fullDaSalary: fullDa,

            fullTaSalary: fullTa,

            fullOtherSalary: fullOther,

            fullGrossSalary: fullGross,

            earnedBasicSalary: basic,

            earnedHraSalary: hra,

            earnedDaSalary: da,

            earnedTaSalary: ta,

            earnedOtherSalary: other,

            earnedGrossSalary: grossSalary,

            lop,

            pf,

            esic,

            professionalTax: pt,

            overtime: overtimeBonus,

            bonus: parsedBonus,

            advance: parsedAdvance,

            otherDeductions: parsedOtherDeductions,

            totalDeductions,

            netSalary,
          },
        },
        "Payroll processed successfully"
      )
    );
  } catch (error) {
    console.error("❌ Payroll processing error:", error);

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

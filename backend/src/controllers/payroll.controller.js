// controllers/payroll.controller.js

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

// =====================================================
// HELPERS
// =====================================================

function countWorkingDays(year, month) {
  const start = moment(
    `${year}-${String(month).padStart(2, "0")}-01`
  );

  const end = start.clone().endOf("month");

  let count = 0;

  const cursor = start.clone();

  while (cursor.isSameOrBefore(end, "day")) {
    const day = cursor.day();

    // Sunday = 0
    // Saturday = 6
    if (day !== 0 && day !== 6) {
      count++;
    }

    cursor.add(1, "day");
  }

  return count;
}

// =====================================================
// SAFE NUMBER HELPERS
// =====================================================

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

// =====================================================
// ROUND TO 2 DECIMAL
// =====================================================

const round2 = (number) => {
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

// =====================================================
// ESIC LIMIT
// =====================================================

const ESIC_WAGE_CEILING = 21000;

// =====================================================
// CONTROLLER
// =====================================================

module.exports = {

  // ===================================================
  // PROCESS PAYROLL
  // POST /api/v1/payroll/process
  // ===================================================

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

    // =====================================================
    // 1. PARSE INPUT
    // =====================================================

    const parsedMonth = safeParseInt(month);
    const parsedYear = safeParseInt(year);
    const parsedEmployeeId = safeParseInt(employeeId);

    const parsedBonus = safeParseFloat(bonus);
    const parsedAdvance = safeParseFloat(advance);
    const parsedOtherDeductions =
      safeParseFloat(otherDeductions);

    // =====================================================
    // 2. VALIDATE INPUT
    // =====================================================

    if (
      !parsedMonth ||
      parsedMonth < 1 ||
      parsedMonth > 12
    ) {
      throw new ApiError(
        400,
        "Valid month is required (1-12)"
      );
    }

    if (!parsedYear || parsedYear < 2000) {
      throw new ApiError(
        400,
        "Valid year is required"
      );
    }

    if (!parsedEmployeeId) {
      throw new ApiError(
        400,
        "Employee ID is required"
      );
    }

    // =====================================================
    // 3. GET EMPLOYEE + BRANCH + COMPANY
    // =====================================================

    const employee = await Employee.findByPk(
      parsedEmployeeId,
      {
        include: [
          {
            model: Branch,
            as: "branch"
          },
          {
            model: Company,
            as: "company"
          }
        ]
      }
    );

    if (!employee) {
      throw new ApiError(
        404,
        "Employee not found"
      );
    }

    if (!employee.company) {
      throw new ApiError(
        400,
        "Company information not found for this employee"
      );
    }

    // =====================================================
    // 4. COMPANY WORKING DAY CONFIGURATION
    // =====================================================

    const company =
      employee.company;

    const workingDaysPerWeek =
      safeParseInt(
        company.working_days_per_week
      ) || 6;

    let weekOffDays =
      company.week_off_days;

    // JSON column may already return array.
    // Sometimes it can return a string depending on setup.
    if (typeof weekOffDays === "string") {
      try {
        weekOffDays =
          JSON.parse(weekOffDays);
      } catch (error) {
        weekOffDays = ["sunday"];
      }
    }

    if (!Array.isArray(weekOffDays)) {
      weekOffDays = ["sunday"];
    }

    weekOffDays = weekOffDays.map(
      (day) =>
        String(day)
          .trim()
          .toLowerCase()
    );

    // =====================================================
    // 5. VALIDATE COMPANY WORKING DAY CONFIGURATION
    // =====================================================

    if (
      workingDaysPerWeek < 1 ||
      workingDaysPerWeek > 7
    ) {
      throw new ApiError(
        400,
        "Company working days configuration is invalid"
      );
    }

    if (
      7 - weekOffDays.length !==
      workingDaysPerWeek
    ) {
      throw new ApiError(
        400,
        "Company working days and week off configuration do not match"
      );
    }

    // =====================================================
    // 6. CHECK EXISTING PAYROLL
    // =====================================================

    const existing =
      await Payroll.findOne({
        where: {
          employee_id:
            parsedEmployeeId,

          month:
            parsedMonth,

          year:
            parsedYear
        }
      });

    // Do not allow paid payroll to be reprocessed
    if (
      existing &&
      existing.status === "paid"
    ) {
      throw new ApiError(
        400,
        "Payroll already paid for this period and cannot be reprocessed"
      );
    }

    // =====================================================
    // 7. MONTH DATE RANGE
    // =====================================================

    const monthStart = moment(
      `${parsedYear}-${String(
        parsedMonth
      ).padStart(2, "0")}-01`
    );

    const monthEnd =
      monthStart.clone().endOf("month");

    // =====================================================
    // 8. EMPLOYEE JOINING DATE
    // =====================================================

    let payrollStartDate =
      monthStart.clone();

    if (employee.date_of_joining) {
      const joiningDate =
        moment(
          employee.date_of_joining
        ).startOf("day");

      // If employee joined before this month,
      // payroll starts from month beginning.
      //
      // If employee joined during this month,
      // payroll starts from joining date.

      if (
        joiningDate.isAfter(
          payrollStartDate,
          "day"
        )
      ) {
        payrollStartDate =
          joiningDate.clone();
      }
    }

    // =====================================================
    // 9. EMPLOYEE JOINED AFTER MONTH END
    // =====================================================

    if (
      payrollStartDate.isAfter(
        monthEnd,
        "day"
      )
    ) {
      throw new ApiError(
        400,
        "Employee had not joined the company during this payroll month"
      );
    }

    // =====================================================
    // 10. DATE STRINGS
    // =====================================================

    const startDate =
      payrollStartDate.format(
        "YYYY-MM-DD"
      );

    const endDate =
      monthEnd.format(
        "YYYY-MM-DD"
      );

    // =====================================================
    // 11. GET ATTENDANCE
    // =====================================================

    const attendances =
      await Attendance.findAll({
        where: {
          employee_id:
            parsedEmployeeId,

          date: {
            [Op.between]: [
              startDate,
              endDate
            ]
          }
        },

        order: [
          ["date", "ASC"]
        ]
      });

    // =====================================================
    // 12. CREATE WEEK OFF DAY SET
    // =====================================================

    const weekDayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday"
    ];

    const weekOffSet =
      new Set(
        weekOffDays
      );

    // =====================================================
    // 13. CALCULATE CALENDAR DAYS
    // =====================================================

    const calendarDays =
      monthStart.daysInMonth();

    // =====================================================
    // 14. CALCULATE WORKING DAYS
    //     BASED ON COMPANY CONFIGURATION
    // =====================================================

    let workingDaysBeforeHolidays = 0;

    let cursor =
      payrollStartDate.clone();

    while (
      cursor.isSameOrBefore(
        monthEnd,
        "day"
      )
    ) {
      const dayName =
        weekDayNames[
          cursor.day()
        ];

      if (
        !weekOffSet.has(dayName)
      ) {
        workingDaysBeforeHolidays++;
      }

      cursor.add(1, "day");
    }

    // =====================================================
    // 15. GET HOLIDAYS
    // =====================================================

    const holidays =
      await Holiday.findAll({
        where: {
          company_id:
            employee.company_id,

          year:
            parsedYear,

          month:
            parsedMonth,

          is_weekday: true,

          [Op.or]: [
            {
              branch_id:
                employee.branch_id
            },
            {
              branch_id: null
            }
          ]
        }
      });

    // =====================================================
    // 16. COUNT ONLY HOLIDAYS THAT FALL ON
    //     ACTUAL WORKING DAYS
    // =====================================================

    let holidayCount = 0;

    const holidayDates =
      new Set();

    for (const holiday of holidays) {

      // Your existing Holiday model uses its date
      // field. If your field is named differently,
      // change holiday.date below.
      if (!holiday.date) {
        continue;
      }

      const holidayDate =
        moment(holiday.date);

      // Holiday must be inside employee payroll period
      if (
        holidayDate.isBefore(
          payrollStartDate,
          "day"
        ) ||
        holidayDate.isAfter(
          monthEnd,
          "day"
        )
      ) {
        continue;
      }

      const dayName =
        weekDayNames[
          holidayDate.day()
        ];

      // If holiday falls on a weekly off,
      // don't deduct it again.
      if (
        weekOffSet.has(dayName)
      ) {
        continue;
      }

      const dateKey =
        holidayDate.format(
          "YYYY-MM-DD"
        );

      // Prevent duplicate holiday counting
      if (
        !holidayDates.has(
          dateKey
        )
      ) {
        holidayDates.add(
          dateKey
        );

        holidayCount++;
      }
    }

    // =====================================================
    // 17. TOTAL WORKING DAYS
    // =====================================================

    const totalWorkingDays =
      Math.max(
        0,
        workingDaysBeforeHolidays -
          holidayCount
      );

    // =====================================================
    // 18. ATTENDANCE BREAKDOWN
    // =====================================================

    const presentDays =
      attendances.filter(
        (attendance) =>
          attendance.status ===
          "present"
      ).length;

    const halfDays =
      attendances.filter(
        (attendance) =>
          attendance.status ===
          "half-day"
      ).length;

    const leaveDays =
      attendances.filter(
        (attendance) =>
          attendance.status ===
          "on-leave"
      ).length;

    const absentDays =
      attendances.filter(
        (attendance) =>
          attendance.status ===
          "absent"
      ).length;

    // =====================================================
    // 19. OVERTIME
    // =====================================================

    const totalOvertimeHours =
      attendances.reduce(
        (sum, attendance) =>
          sum +
          safeParseFloat(
            attendance.overtime_hours
          ),

        0
      );

    // =====================================================
    // 20. PAYABLE DAYS
    // =====================================================

    /*
      Present      = 1 day
      Half-day     = 0.5 day
      Leave        = 1 day

      IMPORTANT:
      Weekly offs and holidays are NOT treated as
      absent days because they are already excluded
      from totalWorkingDays.
    */

    const rawPayableDays =
      presentDays +
      halfDays * 0.5 +
      leaveDays;

    const payableDays =
      Math.min(
        rawPayableDays,
        totalWorkingDays
      );

    // =====================================================
    // 21. PAYABLE RATIO
    // =====================================================

    const payableRatio =
      totalWorkingDays > 0
        ? payableDays /
          totalWorkingDays
        : 0;

    // =====================================================
    // 22. FULL SALARY COMPONENTS
    // =====================================================

    const fullBasic =
      safeParseFloat(
        employee.salary_basic
      );

    const fullHra =
      safeParseFloat(
        employee.salary_hra
      );

    const fullDa =
      safeParseFloat(
        employee.salary_da
      );

    const fullTa =
      safeParseFloat(
        employee.salary_ta
      );

    const fullOther =
      safeParseFloat(
        employee.salary_other
      );

    // =====================================================
    // 23. FULL GROSS SALARY
    // =====================================================

    const fullGross =
      round2(
        fullBasic +
        fullHra +
        fullDa +
        fullTa +
        fullOther
      );

    // =====================================================
    // 24. EARNED SALARY
    // =====================================================

    const basic =
      round2(
        fullBasic *
          payableRatio
      );

    const hra =
      round2(
        fullHra *
          payableRatio
      );

    const da =
      round2(
        fullDa *
          payableRatio
      );

    const ta =
      round2(
        fullTa *
          payableRatio
      );

    const other =
      round2(
        fullOther *
          payableRatio
      );

    // =====================================================
    // 25. GROSS EARNED SALARY
    // =====================================================

    const grossSalary =
      round2(
        basic +
        hra +
        da +
        ta +
        other
      );

    // =====================================================
    // 26. LOP
    // =====================================================

    const lop =
      round2(
        fullGross -
        grossSalary
      );

    // =====================================================
    // 27. PF
    // =====================================================

    /*
      Employee PF contribution:
      12% of earned basic
    */

    const pf =
      round2(
        basic * 0.12
      );

    // =====================================================
    // 28. ESIC
    // =====================================================

    /*
      ESIC employee contribution:
      0.75%

      Eligibility is checked against the
      contracted monthly gross salary.
    */

    const esic =
      fullGross <=
      ESIC_WAGE_CEILING
        ? round2(
            grossSalary *
              0.0075
          )
        : 0;

    // =====================================================
    // 29. PROFESSIONAL TAX
    // =====================================================

    const pt = 200;

    // =====================================================
    // 30. OVERTIME CALCULATION
    // =====================================================

    const standardHoursPerDay = 9;

    let hourlyRate = 0;

    if (
      totalWorkingDays > 0
    ) {
      hourlyRate =
        basic /
        (
          totalWorkingDays *
          standardHoursPerDay
        );
    }

    const overtimeBonus =
      round2(
        totalOvertimeHours *
          hourlyRate *
          2
      );

    // =====================================================
    // 31. TOTAL DEDUCTIONS
    // =====================================================

    const totalDeductions =
      round2(
        pf +
        esic +
        pt +
        parsedAdvance +
        parsedOtherDeductions
      );

    // =====================================================
    // 32. NET SALARY
    // =====================================================

    const netSalary =
      round2(
        grossSalary -
        totalDeductions +
        parsedBonus +
        overtimeBonus
      );

    // =====================================================
    // 33. PAYROLL DATA
    // =====================================================

    const payrollData = {

      employee_id:
        parsedEmployeeId,

      month:
        parsedMonth,

      year:
        parsedYear,

      // =================================================
      // EARNINGS
      // =================================================

      earning_basic:
        basic,

      earning_hra:
        hra,

      earning_da:
        da,

      earning_ta:
        ta,

      earning_overtime:
        overtimeBonus,

      earning_bonus:
        parsedBonus,

      earning_other:
        other,

      // =================================================
      // DEDUCTIONS
      // =================================================

      deduction_pf:
        pf,

      deduction_esic:
        esic,

      deduction_advance:
        parsedAdvance,

      deduction_pt:
        pt,

      deduction_tds:
        0,

      deduction_lop:
        lop,

      deduction_other:
        parsedOtherDeductions,

      // =================================================
      // TOTALS
      // =================================================

      gross_salary:
        grossSalary,

      total_deductions:
        totalDeductions,

      net_salary:
        netSalary,

      // =================================================
      // ATTENDANCE
      // =================================================

      att_total_working_days:
        totalWorkingDays,

      att_present_days:
        presentDays,

      att_absent_days:
        absentDays,

      att_leave_days:
        leaveDays,

      att_overtime_hours:
        totalOvertimeHours,

      att_calendar_days:
        calendarDays,

      att_weekdays_in_month:
        workingDaysBeforeHolidays,

      att_holiday_count:
        holidayCount,

      att_payable_days:
        payableDays,

      att_half_days:
        halfDays,

      // =================================================
      // STATUS
      // =================================================

      status:
        "processed",

      processed_by:
        req.user.id,

      processed_on:
        new Date()
    };

    // =====================================================
    // 34. CREATE OR UPDATE PAYROLL
    // =====================================================

    let payroll;

    if (existing) {

      await existing.update(
        payrollData
      );

      payroll = existing;

    } else {

      payroll =
        await Payroll.create(
          payrollData
        );
    }

    // =====================================================
    // 35. GET FINAL PAYROLL
    // =====================================================

    const result =
      await Payroll.findByPk(
        payroll.id,
        {
          include: [
            {
              model: Employee,
              as: "employee"
            }
          ]
        }
      );

    // =====================================================
    // 36. RESPONSE
    // =====================================================

    res.json(
      new ApiResponse(
        200,
        {
          payroll: result,

          payrollConfiguration: {
            workingDaysPerWeek:
              workingDaysPerWeek,

            weekOffDays:
              weekOffDays
          },

          attendanceSummary: {
            payrollStartDate:
              startDate,

            payrollEndDate:
              endDate,

            calendarDays:
              calendarDays,

            workingDays:
              totalWorkingDays,

            workingDaysBeforeHolidays:
              workingDaysBeforeHolidays,

            holidays:
              holidayCount,

            present:
              presentDays,

            halfDays:
              halfDays,

            leave:
              leaveDays,

            absent:
              absentDays,

            payableDays:
              payableDays,

            overtimeHours:
              totalOvertimeHours
          },

          salarySummary: {
            fullGrossSalary:
              fullGross,

            earnedGrossSalary:
              grossSalary,

            lop:
              lop,

            pf:
              pf,

            esic:
              esic,

            professionalTax:
              pt,

            overtime:
              overtimeBonus,

            bonus:
              parsedBonus,

            advance:
              parsedAdvance,

            otherDeductions:
              parsedOtherDeductions,

            totalDeductions:
              totalDeductions,

            netSalary:
              netSalary
          }
        },
        "Payroll processed successfully"
      )
    );

  } catch (error) {

    console.error(
      "❌ Payroll processing error:",
      error
    );

    next(error);
  }
},

  // ===================================================
  // GET ALL PAYROLLS
  // GET /api/v1/payroll
  // ===================================================

  getPayrolls: async (req, res, next) => {

    try {

      const {
        month,
        year,
        employeeId,
        status,
      } = req.query;

      const where = {
        is_deleted: false,
      };

      const include = [

        {
          model: Employee,

          as: "employee",

          attributes: [
            "id",
            "name",
            "employee_code",
            "department",
            "email",
          ],

          include: [

            {
              model: Branch,
              as: "branch",

              attributes: [
                "id",
                "name",
              ],
            },

          ],
        },

        {
          model: User,

          as: "processor",

          attributes: [
            "id",
            "name",
          ],
        },

      ];

      // =================================================
      // EMPLOYEE LOGIN
      // =================================================

      if (
        req.user &&
        req.user.role === "employee"
      ) {

        const emp =
          await Employee.findOne({
            where: {
              user_id:
                req.user.id,

              is_deleted:
                false,
            },
          });

        if (emp) {
          where.employee_id =
            emp.id;
        } else {

          throw new ApiError(
            404,
            "Employee profile not found"
          );

        }

      }

      // =================================================
      // COMPANY ADMIN / HR
      // =================================================

      else if (
        req.user &&
        (
          req.user.role ===
            "company_admin" ||

          req.user.role ===
            "hr"
        )
      ) {

        include[0].where = {
          company_id:
            req.user.company_id,
        };

      }

      // =================================================
      // SPECIFIC EMPLOYEE
      // =================================================

      else if (employeeId) {

        where.employee_id =
          safeParseInt(
            employeeId
          );

      }

      // =================================================
      // MONTH
      // =================================================

      if (month) {

        const parsedMonth =
          safeParseInt(month);

        if (
          parsedMonth < 1 ||
          parsedMonth > 12
        ) {

          throw new ApiError(
            400,
            "Month must be between 1 and 12"
          );

        }

        where.month =
          parsedMonth;
      }

      // =================================================
      // YEAR
      // =================================================

      if (year) {

        where.year =
          safeParseInt(year);

      }

      // =================================================
      // STATUS
      // =================================================

      if (status) {

        if (
          ![
            "draft",
            "processed",
            "paid",
          ].includes(status)
        ) {

          throw new ApiError(
            400,
            "Invalid payroll status"
          );

        }

        where.status =
          status;

      }

      // =================================================
      // GET PAYROLLS
      // =================================================

      const payrolls =
        await Payroll.findAll({

          where,

          include,

          order: [
            ["year", "DESC"],
            ["month", "DESC"],
          ],

        });

      return res.json(
        new ApiResponse(
          200,
          payrolls,
          "Payrolls fetched successfully"
        )
      );

    } catch (error) {

      next(error);

    }

  },

  // ===================================================
  // MARK PAYROLL AS PAID
  // PUT /api/v1/payroll/:id/mark-paid
  // ===================================================

  markPaid: async (
    req,
    res,
    next
  ) => {

    try {

      const payroll =
        await Payroll.findOne({

          where: {
            id: req.params.id,
            is_deleted: false,
          },

        });

      if (!payroll) {

        throw new ApiError(
          404,
          "Payroll not found"
        );

      }

      // ------------------------------------------------
      // Already paid
      // ------------------------------------------------

      if (
        payroll.status === "paid"
      ) {

        throw new ApiError(
          400,
          "Payroll is already marked as paid"
        );

      }

      // ------------------------------------------------
      // Update
      // ------------------------------------------------

      await payroll.update({

        status: "paid",

        paid_on:
          new Date(),

        updated_by:
          req.user?.id || null,

      });

      // ------------------------------------------------
      // Get updated payroll
      // ------------------------------------------------

      const updated =
        await Payroll.findByPk(
          payroll.id,
          {
            include: [
              {
                model: Employee,
                as: "employee",
              },
            ],
          }
        );

      return res.json(
        new ApiResponse(
          200,
          updated,
          "Payroll marked as paid"
        )
      );

    } catch (error) {

      next(error);

    }

  },

  // ===================================================
  // GET EMPLOYEE PAYROLL HISTORY
  // GET /api/v1/payroll/employee/:id
  // ===================================================

  getEmployeePayrolls: async (
    req,
    res,
    next
  ) => {

    try {

      const {
        id,
      } = req.params;

      const {
        year,
      } = req.query;

      const employeeId =
        safeParseInt(id);

      if (!employeeId) {

        throw new ApiError(
          400,
          "Invalid employee ID"
        );

      }

      // =================================================
      // CHECK EMPLOYEE
      // =================================================

      const employee =
        await Employee.findByPk(
          employeeId
        );

      if (!employee) {

        throw new ApiError(
          404,
          "Employee not found"
        );

      }

      // =================================================
      // WHERE
      // =================================================

      const where = {

        employee_id:
          employeeId,

        is_deleted:
          false,

      };

      if (year) {

        where.year =
          safeParseInt(year);

      }

      // =================================================
      // GET PAYROLLS
      // =================================================

      const payrolls =
        await Payroll.findAll({

          where,

          include: [

            {
              model: Employee,

              as: "employee",

              attributes: [
                "id",
                "name",
                "employee_code",
                "department",
              ],

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
          "Employee payrolls fetched successfully"
        )
      );

    } catch (error) {

      next(error);

    }

  },

};
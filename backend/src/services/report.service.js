const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const moment = require("moment-timezone");
const { Op } = require("sequelize");

const {
  Attendance,
  Employee,
  Payroll,
  Punch,
  Branch,
} = require("../models");

const TIMEZONE = "Asia/Kolkata";

/* =========================================================
   HELPERS
========================================================= */

const money = (value) => {
  const number = Number(value || 0);

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const number = (value) => {
  return Number(value || 0);
};

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
};

const formatDate = (date) => {
  if (!date) {
    return "";
  }

  return moment(date).tz(TIMEZONE).format("DD-MM-YYYY");
};

const formatTime = (value) => {
  if (!value) {
    return "";
  }

  try {
    return moment(value).tz(TIMEZONE).format("hh:mm A");
  } catch (error) {
    return safeString(value);
  }
};

/**
 * Get first and last date of selected month
 */
const getMonthRange = (month, year) => {
  const m = Number(month);
  const y = Number(year);

  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error(
      "Invalid month. Month must be between 1 and 12."
    );
  }

  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    throw new Error("Invalid year.");
  }

  const monthString = String(m).padStart(2, "0");

  const start = moment.tz(
    `${y}-${monthString}-01`,
    "YYYY-MM-DD",
    TIMEZONE
  );

  const end = start.clone().endOf("month");

  return {
    startDate: start.format("YYYY-MM-DD"),
    endDate: end.format("YYYY-MM-DD"),
    start,
    end,
  };
};

/* =========================================================
   PUNCH HELPERS
========================================================= */

/**
 * Get possible punch time from different schema versions
 */
const getPunchTime = (punch) => {
  if (!punch) {
    return null;
  }

  return (
    punch.punch_time ||
    punch.time ||
    punch.punched_at ||
    punch.check_in_time ||
    punch.check_out_time ||
    punch.createdAt ||
    punch.created_at ||
    null
  );
};

/**
 * Get punch type
 */
const getPunchType = (punch) => {
  if (!punch) {
    return "";
  }

  return String(
    punch.type ||
      punch.punch_type ||
      punch.attendance_type ||
      ""
  ).toLowerCase();
};

/**
 * Determine check-in punch
 */
const isCheckInPunch = (punch) => {
  const type = getPunchType(punch);

  return (
    type === "in" ||
    type === "checkin" ||
    type === "check-in" ||
    type === "check_in" ||
    type === "login"
  );
};

/**
 * Determine check-out punch
 */
const isCheckOutPunch = (punch) => {
  const type = getPunchType(punch);

  return (
    type === "out" ||
    type === "checkout" ||
    type === "check-out" ||
    type === "check_out" ||
    type === "logout"
  );
};

/**
 * Get first check-in
 */
const getCheckIn = (punches = []) => {
  if (!Array.isArray(punches) || punches.length === 0) {
    return null;
  }

  const checkIns = punches
    .filter(isCheckInPunch)
    .sort((a, b) => {
      return (
        new Date(getPunchTime(a) || 0) -
        new Date(getPunchTime(b) || 0)
      );
    });

  if (checkIns.length > 0) {
    return checkIns[0];
  }

  // Fallback:
  // If no punch type exists, use first punch.
  const sorted = [...punches].sort((a, b) => {
    return (
      new Date(getPunchTime(a) || 0) -
      new Date(getPunchTime(b) || 0)
    );
  });

  return sorted[0] || null;
};

/**
 * Get last check-out
 */
const getCheckOut = (punches = []) => {
  if (!Array.isArray(punches) || punches.length === 0) {
    return null;
  }

  const checkOuts = punches
    .filter(isCheckOutPunch)
    .sort((a, b) => {
      return (
        new Date(getPunchTime(b) || 0) -
        new Date(getPunchTime(a) || 0)
      );
    });

  if (checkOuts.length > 0) {
    return checkOuts[0];
  }

  // Fallback:
  // If no punch type exists, use last punch.
  const sorted = [...punches].sort((a, b) => {
    return (
      new Date(getPunchTime(b) || 0) -
      new Date(getPunchTime(a) || 0)
    );
  });

  return sorted[0] || null;
};

/* =========================================================
   ATTENDANCE DATA
========================================================= */

const getMonthlyAttendance = async ({
  month,
  year,
}) => {
  const {
    startDate,
    endDate,
  } = getMonthRange(month, year);

  const records = await Attendance.findAll({
    where: {
      date: {
        [Op.between]: [
          startDate,
          endDate,
        ],
      },

      is_deleted: false,
    },

    include: [
      {
        model: Employee,

        as: "employee",

        attributes: [
          "id",
          "name",
          "employee_code",
          "department",
          "designation",
          "branch_id",
        ],

        required: true,

        include: [
          {
            model: Branch,

            as: "branch",

            attributes: [
              "id",
              "name",
              "code",
              "city",
              "state",
            ],

            required: false,
          },
        ],
      },

      {
        model: Punch,

        as: "punches",

        required: false,

        include: [
          {
            model: Branch,

            as: "branch",

            attributes: [
              "id",
              "name",
              "code",
              "city",
              "state",
            ],

            required: false,
          },
        ],
      },
    ],

    order: [
      ["date", "ASC"],
      ["employee_id", "ASC"],
    ],
  });

  return records;
};

/* =========================================================
   ATTENDANCE SUMMARY
========================================================= */

const buildAttendanceSummary = (records = []) => {
  const summary = {
    total: records.length,
    present: 0,
    absent: 0,
    halfDay: 0,
    leave: 0,
    holiday: 0,
    weekend: 0,
    workingHours: 0,
    overtimeHours: 0,
    lateCount: 0,
  };

  records.forEach((record) => {
    const status = String(
      record.status || ""
    ).toLowerCase();

    switch (status) {
      case "present":
        summary.present++;
        break;

      case "absent":
        summary.absent++;
        break;

      case "half-day":
      case "half_day":
      case "halfday":
        summary.halfDay++;
        break;

      case "on-leave":
      case "leave":
      case "on_leave":
        summary.leave++;
        break;

      case "holiday":
        summary.holiday++;
        break;

      case "weekend":
        summary.weekend++;
        break;

      default:
        break;
    }

    summary.workingHours += number(
      record.working_hours
    );

    summary.overtimeHours += number(
      record.overtime_hours
    );

    if (record.is_late) {
      summary.lateCount++;
    }
  });

  return summary;
};

/* =========================================================
   ATTENDANCE PDF
========================================================= */

const generateAttendancePDF = async ({
  month,
  year,
}) => {
  const records = await getMonthlyAttendance({
    month,
    year,
  });

  const summary = buildAttendanceSummary(records);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 30,
        bufferPages: true,
      });

      const chunks = [];

      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", reject);

      /* =========================
         HEADER
      ========================= */

      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("Workforce Attendance Report", {
          align: "center",
        });

      doc.moveDown(0.3);

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `${moment()
            .month(Number(month) - 1)
            .format("MMMM")} ${year}`,
          {
            align: "center",
          }
        );

      doc.moveDown();

      /* =========================
         SUMMARY
      ========================= */

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Summary");

      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(9)
        .text(
          `Total Records: ${summary.total}    ` +
            `Present: ${summary.present}    ` +
            `Absent: ${summary.absent}    ` +
            `Half Day: ${summary.halfDay}    ` +
            `Leave: ${summary.leave}    ` +
            `Holiday: ${summary.holiday}    ` +
            `Weekend: ${summary.weekend}    ` +
            `Late: ${summary.lateCount}`
        );

      doc.moveDown(0.3);

      doc.text(
        `Working Hours: ${summary.workingHours.toFixed(2)}    ` +
          `Overtime Hours: ${summary.overtimeHours.toFixed(2)}`
      );

      doc.moveDown();

      /* =========================
         TABLE
      ========================= */

      const columns = [
        {
          title: "Date",
          width: 60,
        },
        {
          title: "Employee",
          width: 110,
        },
        {
          title: "Code",
          width: 65,
        },
        {
          title: "Department",
          width: 85,
        },
        {
          title: "Status",
          width: 65,
        },
        {
          title: "In",
          width: 60,
        },
        {
          title: "Out",
          width: 60,
        },
        {
          title: "Working",
          width: 60,
        },
        {
          title: "OT",
          width: 50,
        },
        {
          title: "Late",
          width: 55,
        },
        {
          title: "Branch",
          width: 95,
        },
      ];

      const tableX = 30;

      let y = doc.y;

      const drawHeader = () => {
        let x = tableX;

        doc
          .font("Helvetica-Bold")
          .fontSize(7);

        columns.forEach((column) => {
          doc
            .rect(
              x,
              y,
              column.width,
              22
            )
            .stroke();

          doc.text(
            column.title,
            x + 3,
            y + 7,
            {
              width: column.width - 6,
              align: "center",
            }
          );

          x += column.width;
        });

        y += 22;
      };

      const drawRow = (record) => {
        const employee =
          record.employee || {};

        const branch =
          employee.branch || {};

        const punches =
          Array.isArray(record.punches)
            ? record.punches
            : [];

        const checkIn =
          getCheckIn(punches);

        const checkOut =
          getCheckOut(punches);

        const row = [
          formatDate(record.date),

          safeString(
            employee.name,
            "-"
          ),

          safeString(
            employee.employee_code,
            "-"
          ),

          safeString(
            employee.department,
            "-"
          ),

          safeString(
            record.status,
            "-"
          ),

          formatTime(
            getPunchTime(checkIn)
          ),

          formatTime(
            getPunchTime(checkOut)
          ),

          number(
            record.working_hours
          ).toFixed(2),

          number(
            record.overtime_hours
          ).toFixed(2),

          record.is_late
            ? `${number(
                record.late_by_minutes
              )}m`
            : "No",

          safeString(
            branch.name,
            "-"
          ),
        ];

        const rowHeight = 20;

        if (
          y + rowHeight >
          doc.page.height - 35
        ) {
          doc.addPage();

          y = 30;

          drawHeader();
        }

        let x = tableX;

        doc
          .font("Helvetica")
          .fontSize(6.5);

        columns.forEach(
          (column, index) => {
            doc
              .rect(
                x,
                y,
                column.width,
                rowHeight
              )
              .stroke();

            doc.text(
              row[index],
              x + 3,
              y + 6,
              {
                width:
                  column.width - 6,
                height:
                  rowHeight - 4,
                ellipsis: true,
                align:
                  index === 0 ||
                  index === 5 ||
                  index === 6 ||
                  index === 7 ||
                  index === 8 ||
                  index === 9
                    ? "center"
                    : "left",
              }
            );

            x += column.width;
          });

        y += rowHeight;
      };

      drawHeader();

      records.forEach(drawRow);

      /* =========================
         FOOTER
      ========================= */

      const range = doc.bufferedPageRange();

      for (
        let i = range.start;
        i < range.start + range.count;
        i++
      ) {
        doc.switchToPage(i);

        doc
          .fontSize(7)
          .font("Helvetica")
          .text(
            `Generated on ${moment()
              .tz(TIMEZONE)
              .format(
                "DD-MM-YYYY hh:mm A"
              )}`,
            30,
            doc.page.height - 25,
            {
              align: "left",
            }
          );

        doc.text(
          `Page ${i + 1} of ${
            range.count
          }`,
          0,
          doc.page.height - 25,
          {
            align: "right",
          }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/* =========================================================
   ATTENDANCE EXCEL
========================================================= */

const generateAttendanceExcel = async ({
  month,
  year,
}) => {
  const records = await getMonthlyAttendance({
    month,
    year,
  });

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Attendance Payroll System";

  workbook.created =
    new Date();

  const worksheet =
    workbook.addWorksheet(
      "Attendance"
    );

  /* =========================
     TITLE
  ========================= */

  worksheet.mergeCells(
    "A1:O1"
  );

  worksheet.getCell("A1").value =
    "Workforce Attendance Report";

  worksheet.getCell("A1").font = {
    bold: true,
    size: 16,
  };

  worksheet.getCell(
    "A1"
  ).alignment = {
    horizontal: "center",
  };

  worksheet.mergeCells(
    "A2:O2"
  );

  worksheet.getCell("A2").value =
    `${moment()
      .month(Number(month) - 1)
      .format("MMMM")} ${year}`;

  worksheet.getCell(
    "A2"
  ).alignment = {
    horizontal: "center",
  };

  worksheet.getCell("A2").font = {
    bold: true,
  };

  /* =========================
     SUMMARY
  ========================= */

  const summary =
    buildAttendanceSummary(records);

  worksheet.addRow([]);

  worksheet.addRow([
    "Total Records",
    summary.total,
    "Present",
    summary.present,
    "Absent",
    summary.absent,
    "Half Day",
    summary.halfDay,
    "Leave",
    summary.leave,
    "Late",
    summary.lateCount,
  ]);

  worksheet.addRow([
    "Working Hours",
    summary.workingHours,
    "Overtime Hours",
    summary.overtimeHours,
  ]);

  worksheet.addRow([]);

  /* =========================
     TABLE HEADER
  ========================= */

  const headerRow =
    worksheet.addRow([
      "Date",
      "Employee",
      "Employee Code",
      "Department",
      "Designation",
      "Branch",
      "Branch Code",
      "Status",
      "Check In",
      "Check Out",
      "Working Hours",
      "Overtime Hours",
      "Late",
      "Late Minutes",
      "Remarks",
    ]);

  headerRow.font = {
    bold: true,
  };

  headerRow.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  headerRow.height = 25;

  /* =========================
     DATA
  ========================= */

  records.forEach((record) => {
    const employee =
      record.employee || {};

    const branch =
      employee.branch || {};

    const punches =
      Array.isArray(record.punches)
        ? record.punches
        : [];

    const checkIn =
      getCheckIn(punches);

    const checkOut =
      getCheckOut(punches);

    worksheet.addRow([
      formatDate(record.date),

      safeString(
        employee.name,
        "-"
      ),

      safeString(
        employee.employee_code,
        "-"
      ),

      safeString(
        employee.department,
        "-"
      ),

      safeString(
        employee.designation,
        "-"
      ),

      safeString(
        branch.name,
        "-"
      ),

      safeString(
        branch.code,
        "-"
      ),

      safeString(
        record.status,
        "-"
      ),

      formatTime(
        getPunchTime(checkIn)
      ),

      formatTime(
        getPunchTime(checkOut)
      ),

      number(
        record.working_hours
      ),

      number(
        record.overtime_hours
      ),

      record.is_late
        ? "Yes"
        : "No",

      number(
        record.late_by_minutes
      ),

      safeString(
        record.remarks,
        ""
      ),
    ]);
  });

  /* =========================
     FORMATTING
  ========================= */

  const widths = [
    14,
    25,
    18,
    18,
    20,
    20,
    15,
    15,
    14,
    14,
    16,
    17,
    10,
    15,
    35,
  ];

  widths.forEach(
    (width, index) => {
      worksheet.getColumn(
        index + 1
      ).width = width;
    }
  );

  worksheet.views = [
    {
      state: "frozen",
      ySplit: 7,
    },
  ];

  worksheet.autoFilter = {
    from: "A6",
    to: `O${worksheet.rowCount}`,
  };

  worksheet.eachRow(
    (row, rowNumber) => {
      if (rowNumber >= 6) {
        row.alignment = {
          vertical: "middle",
        };
      }
    }
  );

  /* =========================
     RETURN BUFFER
  ========================= */

  return workbook.xlsx.writeBuffer();
};

/* =========================================================
   PAYROLL DATA
========================================================= */

const getMonthlyPayroll = async ({
  month,
  year,
}) => {
  const payrolls =
    await Payroll.findAll({
      where: {
        month: Number(month),
        year: Number(year),
        is_deleted: false,
      },

      include: [
        {
          model: Employee,

          as: "employee",

          attributes: [
            "id",
            "name",
            "employee_code",
            "department",
            "designation",
            "branch_id",
          ],

          required: true,

          include: [
            {
              model: Branch,

              as: "branch",

              attributes: [
                "id",
                "name",
                "code",
                "city",
                "state",
              ],

              required: false,
            },
          ],
        },
      ],

      order: [
        ["createdAt", "ASC"],
      ],
    });

  return payrolls;
};

/* =========================================================
   PAYROLL PDF
========================================================= */

const generatePayrollPDF = async ({
  month,
  year,
}) => {
  const payrolls =
    await getMonthlyPayroll({
      month,
      year,
    });

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 30,
        bufferPages: true,
      });

      const chunks = [];

      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", reject);

      /* =========================
         HEADER
      ========================= */

      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("Payroll Report", {
          align: "center",
        });

      doc.moveDown(0.3);

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `${moment()
            .month(Number(month) - 1)
            .format("MMMM")} ${year}`,
          {
            align: "center",
          }
        );

      doc.moveDown();

      /* =========================
         TOTALS
      ========================= */

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      payrolls.forEach(
        (payroll) => {
          totalGross += number(
            payroll.gross_salary
          );

          totalDeductions += number(
            payroll.total_deductions
          );

          totalNet += number(
            payroll.net_salary
          );
        }
      );

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(
          `Employees: ${payrolls.length}    ` +
            `Gross Salary: ₹${money(
              totalGross
            )}    ` +
            `Deductions: ₹${money(
              totalDeductions
            )}    ` +
            `Net Salary: ₹${money(
              totalNet
            )}`
        );

      doc.moveDown();

      /* =========================
         TABLE
      ========================= */

      const columns = [
        {
          title: "Employee",
          width: 105,
        },
        {
          title: "Code",
          width: 60,
        },
        {
          title: "Department",
          width: 75,
        },
        {
          title: "Basic",
          width: 65,
        },
        {
          title: "HRA",
          width: 60,
        },
        {
          title: "DA",
          width: 60,
        },
        {
          title: "TA",
          width: 60,
        },
        {
          title: "OT",
          width: 60,
        },
        {
          title: "Gross",
          width: 70,
        },
        {
          title: "Deduction",
          width: 75,
        },
        {
          title: "Net",
          width: 75,
        },
        {
          title: "Present",
          width: 55,
        },
        {
          title: "Absent",
          width: 55,
        },
        {
          title: "Leave",
          width: 50,
        },
        {
          title: "Status",
          width: 60,
        },
      ];

      const tableX = 30;

      let y = doc.y;

      const drawHeader = () => {
        let x = tableX;

        doc
          .font("Helvetica-Bold")
          .fontSize(6.5);

        columns.forEach(
          (column) => {
            doc
              .rect(
                x,
                y,
                column.width,
                22
              )
              .stroke();

            doc.text(
              column.title,
              x + 2,
              y + 7,
              {
                width:
                  column.width - 4,
                align: "center",
              }
            );

            x += column.width;
          }
        );

        y += 22;
      };

      const drawRow = (payroll) => {
        const employee =
          payroll.employee || {};

        const row = [
          safeString(
            employee.name,
            "-"
          ),

          safeString(
            employee.employee_code,
            "-"
          ),

          safeString(
            employee.department,
            "-"
          ),

          money(
            payroll.earning_basic
          ),

          money(
            payroll.earning_hra
          ),

          money(
            payroll.earning_da
          ),

          money(
            payroll.earning_ta
          ),

          money(
            payroll.earning_overtime
          ),

          money(
            payroll.gross_salary
          ),

          money(
            payroll.total_deductions
          ),

          money(
            payroll.net_salary
          ),

          String(
            payroll.att_present_days || 0
          ),

          String(
            payroll.att_absent_days || 0
          ),

          String(
            payroll.att_leave_days || 0
          ),

          safeString(
            payroll.status,
            "-"
          ),
        ];

        const rowHeight = 20;

        if (
          y + rowHeight >
          doc.page.height - 35
        ) {
          doc.addPage();

          y = 30;

          drawHeader();
        }

        let x = tableX;

        doc
          .font("Helvetica")
          .fontSize(6);

        columns.forEach(
          (column, index) => {
            doc
              .rect(
                x,
                y,
                column.width,
                rowHeight
              )
              .stroke();

            doc.text(
              row[index],
              x + 2,
              y + 6,
              {
                width:
                  column.width - 4,
                height:
                  rowHeight - 4,
                ellipsis: true,
                align:
                  index >= 3 &&
                  index <= 13
                    ? "right"
                    : index === 14
                    ? "center"
                    : "left",
              }
            );

            x += column.width;
          });

        y += rowHeight;
      };

      drawHeader();

      payrolls.forEach(drawRow);

      /* =========================
         FOOTER
      ========================= */

      const range =
        doc.bufferedPageRange();

      for (
        let i = range.start;
        i < range.start + range.count;
        i++
      ) {
        doc.switchToPage(i);

        doc
          .fontSize(7)
          .font("Helvetica")
          .text(
            `Generated on ${moment()
              .tz(TIMEZONE)
              .format(
                "DD-MM-YYYY hh:mm A"
              )}`,
            30,
            doc.page.height - 25
          );

        doc.text(
          `Page ${i + 1} of ${
            range.count
          }`,
          0,
          doc.page.height - 25,
          {
            align: "right",
          }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  generateAttendancePDF,
  generateAttendanceExcel,
  generatePayrollPDF,
};
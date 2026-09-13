const {
  generateAttendancePDF,
  generateAttendanceExcel,
  generatePayrollPDF,
} = require("../services/report.service");

/**
 * Parse and validate month/year from query params
 */
const getMonthYear = (req) => {
  const rawMonth = req.query.month;
  const rawYear = req.query.year;

  console.log("REPORT QUERY:", req.query);

  const month = Number.parseInt(String(rawMonth ?? "").trim(), 10);
  const year = Number.parseInt(String(rawYear ?? "").trim(), 10);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error(
      "Invalid month. Month must be between 1 and 12."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    const error = new Error("Invalid year.");
    error.statusCode = 400;
    throw error;
  }

  return {
    month,
    year,
  };
};

/**
 * Attendance PDF
 * GET /reports/attendance/pdf?month=9&year=2026
 */
const attendanceReportPDF = async (req, res) => {
  try {
    const { month, year } = getMonthYear(req);

    console.log(
      `Generating attendance PDF: month=${month}, year=${year}`
    );

    const buffer = await generateAttendancePDF({
      month,
      year,
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${year}-${String(month).padStart(
        2,
        "0"
      )}.pdf"`
    );

    res.setHeader("Content-Length", buffer.length);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Attendance PDF Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to generate attendance PDF",
      ...(process.env.NODE_ENV !== "production" && {
        stack: error.stack,
      }),
    });
  }
};

/**
 * Attendance Excel
 * GET /reports/attendance/excel?month=9&year=2026
 */
const attendanceReportExcel = async (req, res) => {
  try {
    const { month, year } = getMonthYear(req);

    console.log(
      `Generating attendance Excel: month=${month}, year=${year}`
    );

    const buffer = await generateAttendanceExcel({
      month,
      year,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${year}-${String(month).padStart(
        2,
        "0"
      )}.xlsx"`
    );

    res.setHeader("Content-Length", buffer.length);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Attendance Excel Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to generate attendance Excel",
      ...(process.env.NODE_ENV !== "production" && {
        stack: error.stack,
      }),
    });
  }
};

/**
 * Payroll PDF
 * GET /reports/payroll/pdf?month=9&year=2026
 */
const payrollReportPDF = async (req, res) => {
  try {
    const { month, year } = getMonthYear(req);

    console.log(
      `Generating payroll PDF: month=${month}, year=${year}`
    );

    const buffer = await generatePayrollPDF({
      month,
      year,
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payroll-${year}-${String(month).padStart(
        2,
        "0"
      )}.pdf"`
    );

    res.setHeader("Content-Length", buffer.length);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Payroll PDF Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to generate payroll PDF",
      ...(process.env.NODE_ENV !== "production" && {
        stack: error.stack,
      }),
    });
  }
};

module.exports = {
  attendanceReportPDF,
  attendanceReportExcel,
  payrollReportPDF,
};
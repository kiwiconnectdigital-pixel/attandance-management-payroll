const { generateAttendancePDF, generateAttendanceExcel, generatePayrollPDF } = require('../services/report.service');
const ApiError = require('../utils/ApiError');

// @route GET /api/v1/reports/attendance/pdf?month=&year=
const attendanceReportPDF = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) throw new ApiError(400, 'month and year are required');
    const buffer = await generateAttendancePDF({ month: parseInt(month), year: parseInt(year) });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="attendance_${year}_${month}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  } catch (error) { next(error); }
};

// @route GET /api/v1/reports/attendance/excel?month=&year=
const attendanceReportExcel = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) throw new ApiError(400, 'month and year are required');
    const buffer = await generateAttendanceExcel({ month: parseInt(month), year: parseInt(year) });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="attendance_${year}_${month}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  } catch (error) { next(error); }
};

// @route GET /api/v1/reports/payroll/pdf?month=&year=
const payrollReportPDF = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) throw new ApiError(400, 'month and year are required');
    const buffer = await generatePayrollPDF({ month: parseInt(month), year: parseInt(year) });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payroll_${year}_${month}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  } catch (error) { next(error); }
};

module.exports = { attendanceReportPDF, attendanceReportExcel, payrollReportPDF };
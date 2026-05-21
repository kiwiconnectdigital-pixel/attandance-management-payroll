const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment-timezone');

const Attendance = require('../models/Attendance.model');
const Payroll = require('../models/Payroll.model');

/**
 * ─────────────────────────────────────────────────────────────
 * GENERATE TODAY ATTENDANCE PDF REPORT
 * ─────────────────────────────────────────────────────────────
 */
const generateAttendancePDF = async () => {

  const filter = {
    date: {
      $gte: moment().tz('Asia/Kolkata').startOf('day').toDate(),
      $lte: moment().tz('Asia/Kolkata').endOf('day').toDate(),
    },
  };

  const records = await Attendance.find(filter)
    .populate({
      path: 'employee',
      select: 'name employeeCode department branch',
      populate: {
        path: 'branch',
        select: 'name'
      }
    })
    .sort({ date: 1 });

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    layout: 'landscape',
  });

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(
      `Today's Attendance Report — ${moment()
        .tz('Asia/Kolkata')
        .format('DD MMM YYYY')}`,
      { align: 'center' }
    );

  doc.moveDown();

  // ✅ PDF Columns
  const cols = {
    name: 40,
    code: 140,
    loginBranch: 240,
    logoutBranch: 360,
    date: 480,
    checkIn: 560,
    checkOut: 640,
    hours: 720,
    status: 800,
  };

  doc.font('Helvetica-Bold').fontSize(9);

  doc.text('Employee', cols.name, doc.y, { continued: true });
  doc.text('Code', cols.code, doc.y, { continued: true });
  doc.text('Login Branch', cols.loginBranch, doc.y, { continued: true });
  doc.text('Logout Branch', cols.logoutBranch, doc.y, { continued: true });
  doc.text('Date', cols.date, doc.y, { continued: true });
  doc.text('Check In', cols.checkIn, doc.y, { continued: true });
  doc.text('Check Out', cols.checkOut, doc.y, { continued: true });
  doc.text('Hours', cols.hours, doc.y, { continued: true });
  doc.text('Status', cols.status, doc.y);

  doc.moveTo(40, doc.y).lineTo(820, doc.y).stroke();
  doc.moveDown(0.5);

  doc.font('Helvetica').fontSize(8);

  records.forEach((r) => {

    if (doc.y > 520) doc.addPage();

    const y = doc.y;

    const loginBranch = r.checkIns?.[0]?.branch?.name || '—';
    const logoutBranch = r.checkOuts?.[0]?.branch?.name || '—';

    doc.text(r.employee?.name || 'N/A', cols.name, y, { continued: true });
    doc.text(r.employee?.employeeCode || '', cols.code, y, { continued: true });

    doc.text(loginBranch, cols.loginBranch, y, { continued: true });
    doc.text(logoutBranch, cols.logoutBranch, y, { continued: true });

    doc.text(moment(r.date).format('DD/MM/YYYY'), cols.date, y, { continued: true });

    doc.text(
      r.checkIns?.[0]?.time
        ? moment(r.checkIns[0].time).format('hh:mm A')
        : '—',
      cols.checkIn,
      y,
      { continued: true }
    );

    doc.text(
      r.checkOuts?.[0]?.time
        ? moment(r.checkOuts[0].time).format('hh:mm A')
        : '—',
      cols.checkOut,
      y,
      { continued: true }
    );

    doc.text(
      r.workingHours ? `${r.workingHours.toFixed(1)}h` : '—',
      cols.hours,
      y,
      { continued: true }
    );

    doc.text(r.status || 'N/A', cols.status, y);
  });

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};


/**
 * ─────────────────────────────────────────────────────────────
 * GENERATE TODAY ATTENDANCE EXCEL REPORT
 * ─────────────────────────────────────────────────────────────
 */
const generateAttendanceExcel = async () => {

  const filter = {
    date: {
      $gte: moment().tz('Asia/Kolkata').startOf('day').toDate(),
      $lte: moment().tz('Asia/Kolkata').endOf('day').toDate(),
    },
  };

  const records = await Attendance.find(filter)
    .populate({
      path: 'employee',
      select: 'name employeeCode department branch',
      populate: {
        path: 'branch',
        select: 'name'
      }
    })
    .sort({ date: 1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Today Attendance');

  sheet.columns = [
    { header: 'Employee Code', key: 'code', width: 18 },
    { header: 'Employee Name', key: 'name', width: 22 },
    { header: 'Login Branch', key: 'loginBranch', width: 20 },
    { header: 'Logout Branch', key: 'logoutBranch', width: 20 },
    { header: 'Department', key: 'dept', width: 20 },
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Check In', key: 'checkIn', width: 14 },
    { header: 'Check Out', key: 'checkOut', width: 14 },
    { header: 'Working Hours', key: 'hours', width: 16 },
    { header: 'Overtime', key: 'overtime', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Late', key: 'late', width: 10 },
    { header: 'Late By (mins)', key: 'lateBy', width: 18 },
  ];

  // Header Style
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  records.forEach((r) => {

    const loginBranch = r.checkIns?.[0]?.branch?.name || '—';
    const logoutBranch = r.checkOuts?.[0]?.branch?.name || '—';

    sheet.addRow({
      code: r.employee?.employeeCode || '',
      name: r.employee?.name || '',
      loginBranch,
      logoutBranch,
      dept: r.employee?.department || '',
      date: moment(r.date).format('DD/MM/YYYY'),

      checkIn: r.checkIns?.[0]?.time
        ? moment(r.checkIns[0].time).format('HH:mm')
        : '—',

      checkOut: r.checkOuts?.[0]?.time
        ? moment(r.checkOuts[0].time).format('HH:mm')
        : '—',

      hours: r.workingHours ? r.workingHours.toFixed(2) : '0',
      overtime: r.overtimeHours ? r.overtimeHours.toFixed(2) : '0',
      status: r.status || '',
      late: r.isLate ? 'Yes' : 'No',
      lateBy: r.lateByMinutes || 0,
    });
  });

  // Alternate row color
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F3FF' },
        };
      });
    }
  });

  return workbook.xlsx.writeBuffer();
};


/**
 * ─────────────────────────────────────────────────────────────
 * GENERATE PAYROLL PDF REPORT
 * ─────────────────────────────────────────────────────────────
 */
const generatePayrollPDF = async ({ month, year }) => {

  const payrolls = await Payroll.find({ month, year })
    .populate('employee', 'name employeeCode department')
    .sort({ createdAt: 1 });

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    layout: 'landscape',
  });

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const monthName = moment(`${year}-${month}`, 'YYYY-M').format('MMMM YYYY');

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(`Payroll Summary — ${monthName}`, { align: 'center' });

  doc
    .fontSize(10)
    .text(`Generated: ${moment().format('DD MMM YYYY')}`, { align: 'center' });

  doc.moveDown();

  const totalGross = payrolls.reduce((s, p) => s + (p.grossSalary || 0), 0);
  const totalNet = payrolls.reduce((s, p) => s + (p.netSalary || 0), 0);
  const totalDed = payrolls.reduce((s, p) => s + (p.totalDeductions || 0), 0);

  doc.fontSize(10).font('Helvetica-Bold')
    .text(
      `Employees: ${payrolls.length} | Gross: ₹${totalGross.toLocaleString('en-IN')} | Deductions: ₹${totalDed.toLocaleString('en-IN')} | Net: ₹${totalNet.toLocaleString('en-IN')}`,
      { align: 'center' }
    );

  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

module.exports = {
  generateAttendancePDF,
  generateAttendanceExcel,
  generatePayrollPDF,
};
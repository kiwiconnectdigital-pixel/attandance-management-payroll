const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');
const Attendance = require('../models/Attendance.model');
const Leave = require('../models/Leave.model');
const Payroll = require('../models/Payroll.model');
const Employee = require('../models/Employee.model');

/**
 * Generate a PDF attendance report for a given month/year
 */
const generateAttendancePDF = async ({ month, year, branchId }) => {
  const filter = {
    date: {
      $gte: moment(`${year}-${month}-01`).startOf('month').toDate(),
      $lte: moment(`${year}-${month}-01`).endOf('month').toDate(),
    },
  };

  const records = await Attendance.find(filter)
    .populate({ path: 'employee', populate: { path: 'branch', select: 'name' } })
    .sort({ date: 1 });

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const monthName = moment(`${year}-${month}`, 'YYYY-M').format('MMMM YYYY');

  // Header
  doc.fontSize(16).font('Helvetica-Bold').text(`Attendance Report — ${monthName}`, { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(`Generated on: ${moment().format('DD MMM YYYY, hh:mm A')}`, { align: 'center' });
  doc.moveDown();

  // Table header row
  const cols = { name: 40, code: 200, date: 270, checkIn: 340, checkOut: 420, hours: 500, status: 570 };
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Employee', cols.name, doc.y, { continued: true });
  doc.text('Code', cols.code, doc.y, { continued: true });
  doc.text('Date', cols.date, doc.y, { continued: true });
  doc.text('Check In', cols.checkIn, doc.y, { continued: true });
  doc.text('Check Out', cols.checkOut, doc.y, { continued: true });
  doc.text('Hours', cols.hours, doc.y, { continued: true });
  doc.text('Status', cols.status, doc.y);
  doc.moveTo(40, doc.y).lineTo(760, doc.y).stroke();
  doc.moveDown(0.5);

  // Table rows
  doc.font('Helvetica').fontSize(8);
  records.forEach((r) => {
    if (doc.y > 520) doc.addPage();
    const y = doc.y;
    doc.text(r.employee?.name?.substring(0, 20) || 'N/A', cols.name, y, { continued: true });
    doc.text(r.employee?.employeeCode || '', cols.code, y, { continued: true });
    doc.text(moment(r.date).format('DD/MM/YY'), cols.date, y, { continued: true });
    doc.text(r.checkIn?.time ? moment(r.checkIn.time).format('hh:mm A') : '—', cols.checkIn, y, { continued: true });
    doc.text(r.checkOut?.time ? moment(r.checkOut.time).format('hh:mm A') : '—', cols.checkOut, y, { continued: true });
    doc.text(r.workingHours ? `${r.workingHours.toFixed(1)}h` : '—', cols.hours, y, { continued: true });
    doc.text(r.status, cols.status, y);
    doc.moveDown(0.3);
  });

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

/**
 * Generate an Excel attendance report
 */
const generateAttendanceExcel = async ({ month, year }) => {
  const filter = {
    date: {
      $gte: moment(`${year}-${month}-01`).startOf('month').toDate(),
      $lte: moment(`${year}-${month}-01`).endOf('month').toDate(),
    },
  };

  const records = await Attendance.find(filter)
    .populate('employee', 'name employeeCode department')
    .sort({ date: 1 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendPay System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attendance Report');

  // Column definitions
  sheet.columns = [
    { header: 'Employee Code', key: 'code', width: 16 },
    { header: 'Employee Name', key: 'name', width: 24 },
    { header: 'Department', key: 'dept', width: 18 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Check In', key: 'checkIn', width: 12 },
    { header: 'Check Out', key: 'checkOut', width: 12 },
    { header: 'Working Hours', key: 'hours', width: 16 },
    { header: 'Overtime Hrs', key: 'overtime', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Late?', key: 'late', width: 10 },
    { header: 'Late By (mins)', key: 'lateBy', width: 16 },
  ];

  // Style header row
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Data rows
  records.forEach((r) => {
    sheet.addRow({
      code: r.employee?.employeeCode || '',
      name: r.employee?.name || '',
      dept: r.employee?.department || '',
      date: moment(r.date).format('DD/MM/YYYY'),
      checkIn: r.checkIn?.time ? moment(r.checkIn.time).format('HH:mm') : '—',
      checkOut: r.checkOut?.time ? moment(r.checkOut.time).format('HH:mm') : '—',
      hours: r.workingHours?.toFixed(2) || 0,
      overtime: r.overtimeHours?.toFixed(2) || 0,
      status: r.status,
      late: r.isLate ? 'Yes' : 'No',
      lateBy: r.lateByMinutes || 0,
    });
  });

  // Alternate row styling
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
      });
    }
  });

  return workbook.xlsx.writeBuffer();
};

/**
 * Generate a PDF payroll summary report
 */
const generatePayrollPDF = async ({ month, year }) => {
  const payrolls = await Payroll.find({ month, year })
    .populate('employee', 'name employeeCode department')
    .sort({ createdAt: 1 });

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const monthName = moment(`${year}-${month}`, 'YYYY-M').format('MMMM YYYY');
  doc.fontSize(16).font('Helvetica-Bold').text(`Payroll Summary — ${monthName}`, { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(`Generated: ${moment().format('DD MMM YYYY')}`, { align: 'center' });
  doc.moveDown();

  // Summary totals
  const totalGross = payrolls.reduce((s, p) => s + (p.grossSalary || 0), 0);
  const totalNet = payrolls.reduce((s, p) => s + (p.netSalary || 0), 0);
  const totalDeductions = payrolls.reduce((s, p) => s + (p.totalDeductions || 0), 0);

  doc.fontSize(10).font('Helvetica-Bold')
    .text(`Total Employees: ${payrolls.length}   |   Gross Payroll: ₹${totalGross.toLocaleString('en-IN')}   |   Total Deductions: ₹${totalDeductions.toLocaleString('en-IN')}   |   Net Payroll: ₹${totalNet.toLocaleString('en-IN')}`, { align: 'center' });
  doc.moveDown();

  // Column positions
  const c = { name: 40, code: 190, dept: 270, gross: 380, ded: 460, net: 540, status: 640 };
  doc.font('Helvetica-Bold').fontSize(9);
  ['Employee', 'Code', 'Department', 'Gross (₹)', 'Deductions (₹)', 'Net (₹)', 'Status'].forEach((h, i) => {
    doc.text(h, Object.values(c)[i], doc.y, { continued: i < 6 });
  });
  doc.moveTo(40, doc.y).lineTo(760, doc.y).stroke();
  doc.moveDown(0.5);

  doc.font('Helvetica').fontSize(8);
  payrolls.forEach((p) => {
    if (doc.y > 520) doc.addPage();
    const y = doc.y;
    doc.text(p.employee?.name?.substring(0, 22) || '', c.name, y, { continued: true });
    doc.text(p.employee?.employeeCode || '', c.code, y, { continued: true });
    doc.text(p.employee?.department?.substring(0, 14) || '', c.dept, y, { continued: true });
    doc.text(p.grossSalary?.toLocaleString('en-IN') || '0', c.gross, y, { continued: true });
    doc.text(p.totalDeductions?.toLocaleString('en-IN') || '0', c.ded, y, { continued: true });
    doc.text(p.netSalary?.toLocaleString('en-IN') || '0', c.net, y, { continued: true });
    doc.text(p.status, c.status, y);
    doc.moveDown(0.3);
  });

  doc.end();
  return new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
};

module.exports = { generateAttendancePDF, generateAttendanceExcel, generatePayrollPDF };
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const PDFDocument = require('pdfkit');
const Payroll = require('../models/Payroll.model');
const Payslip = require('../models/Payslip.model');
const Employee = require('../models/Employee.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

router.use(protect);

// @route POST /api/v1/payslips/generate/:payrollId
router.post('/generate/:payrollId', authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.payrollId)
      .populate({ path: 'employee', populate: { path: 'branch' } });
    
    if (!payroll) throw new ApiError(404, 'Payroll not found');
    
    const emp = payroll.employee;
    const monthName = moment(`${payroll.year}-${payroll.month}`, 'YYYY-M').format('MMMM YYYY');
    
          // Generate PDF
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const filename = `payslip_${emp.employeeCode}_${payroll.year}_${payroll.month}.pdf`;
      const filePath = path.join('./uploads/payslips', filename);
      fs.mkdirSync('./uploads/payslips', { recursive: true });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const pageWidth = 495; // A4 width minus margins (50 each side)
      const left = 50;
      const right = 545;

      // ── Company Header ──
      doc.fontSize(18).font('Helvetica-Bold').text('Your Company Name', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Your Company Address, City — 000 000', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').text(`Pay Slip for the Month of ${monthName}`, { align: 'center' });
      doc.moveDown(0.5);

      // ── Divider ──
      doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1.5).stroke();
      doc.moveDown(0.4);

      // ── Date ──
      doc.fontSize(10).font('Helvetica-Bold')
        .text(`Date: ${moment().format('DD/MM/YYYY')}`, left, doc.y);
      doc.moveDown(0.4);

      // ── Employee Info Box ──
      const infoStartY = doc.y;
      doc.rect(left, infoStartY, pageWidth, 110).stroke();

      const infoLeft = left + 6;
      const infoRight = left + (pageWidth / 2) + 6;
      const rowH = 20;

      const infoRows = [
        ['Employee Name', emp.name || '', 'Employee Code', emp.employeeCode || ''],
        ['Designation', emp.designation || '', 'Department', emp.department || ''],
        ["Father's/Husb. Name", emp.fatherName || '', 'Date of Joining', emp.dateOfJoining ? moment(emp.dateOfJoining).format('DD/MM/YYYY') : ''],
        ['Pay Days', String(payroll.workingDays || ''), 'Days Worked', String(payroll.paidDays || '')],
        ['Leaves', String(payroll.lopDays || '0'), 'Payment Method', 'Bank Transfer'],
      ];

      infoRows.forEach((row, i) => {
        const y = infoStartY + (i * rowH) + 5;
        // Left cell
        doc.fontSize(9).font('Helvetica-Bold').text(row[0], infoLeft, y, { continued: true });
        doc.font('Helvetica').text(` : ${row[1]}`);
        // Right cell
        doc.fontSize(9).font('Helvetica-Bold').text(row[2], infoRight, y, { continued: true });
        doc.font('Helvetica').text(` : ${row[3]}`);
        // Divider line between rows
        if (i < infoRows.length - 1) {
          doc.moveTo(left, infoStartY + ((i + 1) * rowH)).lineTo(right, infoStartY + ((i + 1) * rowH)).lineWidth(0.3).stroke();
        }
      });
      // Vertical center divider
      doc.moveTo(left + pageWidth / 2, infoStartY).lineTo(left + pageWidth / 2, infoStartY + 110).lineWidth(0.3).stroke();

      doc.y = infoStartY + 115;

      // ── Earnings / Deductions Table ──
      const colW = pageWidth / 4;
      const tableStartY = doc.y;
      const rowHeight = 20;

      // Table header
      doc.rect(left, tableStartY, colW, rowHeight).fillAndStroke('#e8e8e8', '#000000');
      doc.rect(left + colW, tableStartY, colW, rowHeight).fillAndStroke('#e8e8e8', '#000000');
      doc.rect(left + colW * 2, tableStartY, colW, rowHeight).fillAndStroke('#e8e8e8', '#000000');
      doc.rect(left + colW * 3, tableStartY, colW, rowHeight).fillAndStroke('#e8e8e8', '#000000');

      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
      doc.text('Earnings',    left + 4,           tableStartY + 6, { width: colW - 8 });
      doc.text('Amount',      left + colW + 4,     tableStartY + 6, { width: colW - 8, align: 'right' });
      doc.text('Deductions',  left + colW * 2 + 4, tableStartY + 6, { width: colW - 8 });
      doc.text('Amount',      left + colW * 3 + 4, tableStartY + 6, { width: colW - 8, align: 'right' });

      // Table data rows
      const earningsRows = [
        ['Basic Salary',          payroll.earnings?.basic    || 0],
        ['HRA',                   payroll.earnings?.hra      || 0],
        ['Dearness Allowance',    payroll.earnings?.da       || 0],
        ['Travel Allowance',      payroll.earnings?.ta       || 0],
        ['Overtime',              payroll.earnings?.overtime || 0],
        ['Bonus',                 payroll.earnings?.bonus    || 0],
      ];

      const deductionRows = [
        ['Provident Fund (12%)',  payroll.deductions?.pf   || 0],
        ['ESIC (0.75%)',          payroll.deductions?.esic || 0],
        ['Professional Tax',      payroll.deductions?.pt   || 0],
        ['Income Tax (TDS)',      payroll.deductions?.tds  || 0],
        ['Loss of Pay',           payroll.deductions?.lop  || 0],
      ];

      const maxRows = Math.max(earningsRows.length, deductionRows.length);
      // Pad with empty rows
      while (earningsRows.length < maxRows) earningsRows.push(['', null]);
      while (deductionRows.length < maxRows) deductionRows.push(['', null]);
      // Add 2 empty padding rows
      for (let i = 0; i < 2; i++) { earningsRows.push(['', null]); deductionRows.push(['', null]); }

      const fmt = (n) => n !== null && n !== undefined && n !== '' 
        ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n) 
        : '';

      earningsRows.forEach((earn, i) => {
        const deduct = deductionRows[i] || ['', null];
        const y = tableStartY + rowHeight + (i * rowHeight);

        doc.rect(left,            y, colW, rowHeight).stroke();
        doc.rect(left + colW,     y, colW, rowHeight).stroke();
        doc.rect(left + colW * 2, y, colW, rowHeight).stroke();
        doc.rect(left + colW * 3, y, colW, rowHeight).stroke();

        doc.fontSize(8.5).font('Helvetica');
        if (earn[0]) doc.text(earn[0], left + 4, y + 6, { width: colW - 8 });
        if (earn[1] !== null && earn[0]) doc.text(fmt(earn[1]), left + colW + 4, y + 6, { width: colW - 8, align: 'right' });
        if (deduct[0]) doc.text(deduct[0], left + colW * 2 + 4, y + 6, { width: colW - 8 });
        if (deduct[1] !== null && deduct[0]) doc.text(fmt(deduct[1]), left + colW * 3 + 4, y + 6, { width: colW - 8, align: 'right' });
      });

      // Totals row
      const totalY = tableStartY + rowHeight + (earningsRows.length * rowHeight);
      doc.rect(left,            totalY, colW, rowHeight).stroke();
      doc.rect(left + colW,     totalY, colW, rowHeight).stroke();
      doc.rect(left + colW * 2, totalY, colW, rowHeight).stroke();
      doc.rect(left + colW * 3, totalY, colW, rowHeight).stroke();

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Total Earnings',    left + 4,           totalY + 6, { width: colW - 8 });
      doc.text(fmt(payroll.grossSalary), left + colW + 4, totalY + 6, { width: colW - 8, align: 'right' });
      doc.text('Total Deductions',  left + colW * 2 + 4, totalY + 6, { width: colW - 8 });
      doc.text(fmt(payroll.totalDeductions), left + colW * 3 + 4, totalY + 6, { width: colW - 8, align: 'right' });

      // ── Net Salary ──
      const netY = totalY + rowHeight + 2;
      const netBoxWidth = colW * 2;
      doc.rect(left + netBoxWidth, netY, colW, rowHeight).stroke();
      doc.rect(left + netBoxWidth + colW, netY, colW, rowHeight).stroke();
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Net Salary', left + netBoxWidth + 4, netY + 6, { width: colW - 8 });
      doc.text(fmt(payroll.netSalary), left + netBoxWidth + colW + 4, netY + 6, { width: colW - 8, align: 'right' });

      // ── Signatures ──
      const sigY = netY + 70;
      doc.fontSize(9).font('Helvetica');
      doc.moveTo(left, sigY).lineTo(left + 140, sigY).stroke();
      doc.text("Director's Signatures", left, sigY + 4);
      doc.moveTo(right - 140, sigY).lineTo(right, sigY).stroke();
      doc.text("Payee's Signatures", right - 140, sigY + 4);

      doc.end();
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    // Save payslip record
    const payslip = await Payslip.findOneAndUpdate(
      { payroll: payroll._id },
      { payroll: payroll._id, employee: emp._id, month: payroll.month, year: payroll.year, pdfPath: filePath, generatedBy: req.user._id },
      { upsert: true, new: true }
    );
    
    res.json(new ApiResponse(200, { payslip, pdfUrl: `/uploads/payslips/${filename}` }, 'Payslip generated'));
  } catch (error) {
    next(error);
  }
});

// @route GET /api/v1/payslips
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'employee') {
      const emp = await Employee.findOne({ user: req.user._id });
      if (emp) filter.employee = emp._id;
    }
    const payslips = await Payslip.find(filter)
      .populate('employee', 'name employeeCode')
      .sort({ year: -1, month: -1 });
    res.json(new ApiResponse(200, payslips));
  } catch (error) {
    next(error);
  }
});

module.exports = router;

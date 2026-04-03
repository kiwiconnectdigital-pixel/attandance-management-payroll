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
    
    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('PAYSLIP', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`Pay Period: ${monthName}`, { align: 'center' });
    doc.moveDown();
    
    // Employee Info
    doc.fontSize(10).font('Helvetica-Bold').text('Employee Details');
    doc.font('Helvetica')
      .text(`Name: ${emp.name}`)
      .text(`Code: ${emp.employeeCode}`)
      .text(`Department: ${emp.department}`)
      .text(`Branch: ${emp.branch?.name}`);
    doc.moveDown();
    
    // Earnings table
    const { earnings, deductions, grossSalary, totalDeductions, netSalary } = payroll;
    doc.font('Helvetica-Bold').text('Earnings', 50, doc.y);
    doc.font('Helvetica')
      .text(`Basic: ₹${earnings.basic}`)
      .text(`HRA: ₹${earnings.hra}`)
      .text(`DA: ₹${earnings.da}`)
      .text(`TA: ₹${earnings.ta}`)
      .text(`Overtime: ₹${earnings.overtime}`)
      .text(`Bonus: ₹${earnings.bonus}`)
      .text(`Gross Salary: ₹${grossSalary}`, { bold: true });
    doc.moveDown();
    
    // Deductions table
    doc.font('Helvetica-Bold').text('Deductions');
    doc.font('Helvetica')
      .text(`PF (12%): ₹${deductions.pf}`)
      .text(`ESIC (0.75%): ₹${deductions.esic}`)
      .text(`PT: ₹${deductions.pt}`)
      .text(`TDS: ₹${deductions.tds}`)
      .text(`Loss of Pay: ₹${deductions.lop}`)
      .text(`Total Deductions: ₹${totalDeductions}`);
    doc.moveDown();
    
    doc.fontSize(12).font('Helvetica-Bold').text(`Net Salary: ₹${netSalary}`, { align: 'right' });
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

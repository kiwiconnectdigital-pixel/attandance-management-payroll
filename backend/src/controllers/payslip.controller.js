// controllers/payslip.controller.js - Sequelize Version
const PDFDocument = require("pdfkit");
const { Payroll, Employee, Branch, Company, User, Payslip, sequelize } = require('../models');
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const moment = require("moment");
const path = require("path");
const fs = require("fs");
const { Op } = require('sequelize');

function numberToWords(num) {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertHundreds(n) {
    let str = "";
    if (n >= 100) { str += ones[Math.floor(n / 100)] + " Hundred "; n %= 100; }
    if (n >= 20) { str += tens[Math.floor(n / 10)] + " "; n %= 10; }
    if (n > 0) str += ones[n] + " ";
    return str.trim();
  }

  if (!num || num === 0) return "Zero Rupees Only";

  const intPart = Math.floor(Math.abs(num));
  let result = "";
  if (intPart >= 100000) result += convertHundreds(Math.floor(intPart / 100000)) + " Lakh ";
  if (intPart >= 1000) result += convertHundreds(Math.floor((intPart % 100000) / 1000)) + " Thousand ";
  result += convertHundreds(intPart % 1000);
  return result.trim() + " Rupees Only";
}

module.exports = {
  // @desc Generate Payslip PDF
  generatePayslip: async (req, res, next) => {
    try {
      const payroll = await Payroll.findByPk(req.params.payrollId, {
        include: [
          {
            model: Employee,
            as: 'employee',
            include: [
              { model: Branch, as: 'branch' },
              { model: Company, as: 'company' }
            ]
          }
        ]
      });

      if (!payroll) {
        throw new ApiError(404, "Payroll not found");
      }

      const emp = payroll.employee;
      const monthName = moment(`${payroll.year}-${payroll.month}`, "YYYY-M").format("MMM-YY");

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const filename = `payslip_${emp.employee_code}_${payroll.year}_${payroll.month}.pdf`;
      const filePath = path.join("./uploads/payslips", filename);

      fs.mkdirSync("./uploads/payslips", { recursive: true });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Layout
      const L = 40;
      const R = 555;
      const W = R - L;
      const col1 = L + 155;
      const col2 = L + 285;
      const col3 = col2 + 120;

      const companyName = "APEX ENGINEERING ENTERPRISES";
      const companyEmail = "engineering@apexenggpl.com";

      // Header
      doc.font("Helvetica-Bold").fontSize(14)
        .text(companyName.toUpperCase(), L, 45, { align: "center", width: W });

      doc.moveTo(L, 65).lineTo(R, 65).stroke()
        .moveTo(L, 68).lineTo(R, 68).stroke();

      doc.font("Helvetica").fontSize(10)
        .text(`E-mail: ${companyEmail}`, L, 76);

      doc.moveTo(L, 95).lineTo(R, 95).stroke();

      // Attendance values
      const calendarDays = payroll.att_calendar_days || moment(`${payroll.year}-${payroll.month}`, "YYYY-M").daysInMonth();
      const weekdaysDenom = payroll.att_total_working_days || 0;
      const presentDays = payroll.att_present_days || "-";
      const halfDays = payroll.att_half_days || 0;
      const leaveDays = payroll.att_leave_days || 0;
      const absentDays = payroll.att_absent_days || 0;

      // Info grid
      const infoTop = 100;
      const rowH = 20;
      const infoRows = 7;
      const infoH = infoRows * rowH;
      const infoBot = infoTop + infoH;

      doc.rect(L, infoTop, W, infoH).stroke();
      doc.moveTo(col2, infoTop).lineTo(col2, infoBot).stroke();
      for (let i = 1; i < infoRows; i++) {
        const y = infoTop + i * rowH;
        doc.moveTo(L, y).lineTo(R, y).stroke();
      }

      const leftRows = [
        ["Employee Name:", emp.name || "-"],
        ["Designation:", emp.designation || "-"],
        ["Month & Year:", monthName],
        ["No. of Days in Month", String(calendarDays)],
        ["Total Working Days:", String(weekdaysDenom)],
        ["Days Present:", String(presentDays)],
        ["UAN No.", emp.uan_number || ""],
      ];

      const rightRows = [
        ["PAN No.", emp.pan_number || ""],
        ["Gross Salary", String(Math.round(payroll.gross_salary || 0))],
        ["", ""],
        ["", ""],
        ["", ""],
        ["", ""],
        ["", ""],
      ];

      leftRows.forEach(([label, value], i) => {
        const y = infoTop + i * rowH + 5;
        doc.font("Helvetica-Bold").fontSize(9).text(label, L + 4, y);
        doc.font("Helvetica").fontSize(9).text(String(value), col1, y, {
          width: col2 - col1 - 4,
          align: /^\d/.test(value) ? "right" : "left",
        });
      });

      rightRows.forEach(([label, value], i) => {
        const y = infoTop + i * rowH + 5;
        if (!label) return;
        doc.font("Helvetica-Bold").fontSize(9).text(label, col2 + 4, y);
        doc.font("Helvetica").fontSize(9).text(String(value), col3, y, {
          width: R - col3 - 4, align: "right",
        });
      });

      // Earnings / Deductions table
      const tblTop = infoBot + 12;
      const colMid = L + W / 2;
      const earAmtL = colMid - 85;
      const dedAmtL = R - 85;

      const hdrH = 18;
      doc.rect(L, tblTop, W, hdrH).stroke();
      doc.moveTo(colMid, tblTop).lineTo(colMid, tblTop + hdrH).stroke();
      doc.moveTo(earAmtL, tblTop).lineTo(earAmtL, tblTop + hdrH).stroke();
      doc.moveTo(dedAmtL, tblTop).lineTo(dedAmtL, tblTop + hdrH).stroke();

      doc.font("Helvetica-Bold").fontSize(10)
        .text("Earnings", L + 4, tblTop + 4)
        .text("Amount", earAmtL + 4, tblTop + 4)
        .text("Deductions", colMid + 4, tblTop + 4)
        .text("Amount", dedAmtL + 4, tblTop + 4);

      // Grouped amounts
      const basicDA = (payroll.earning_basic || 0) + (payroll.earning_da || 0);
      const hra = payroll.earning_hra || 0;
      const conveyance = payroll.earning_ta || 0;
      const incentive = (payroll.earning_bonus || 0) + (payroll.earning_overtime || 0);
      const earTotal = basicDA + hra + conveyance + incentive;

      const esi = payroll.deduction_esic || 0;
      const adv = payroll.deduction_advance || 0;
      const profTax = payroll.deduction_pt || 0;
      const lop = payroll.deduction_lop || 0;
      const net = earTotal - (esi + adv + profTax + lop);

      const earRows = [
        ["Basic & DA", basicDA],
        ["HRA", hra],
        ["Conveyance", conveyance],
        ["Incentive", incentive],
      ];

      const dedRows = [
        ["E.S.I.", esi],
        ["Advance", adv],
        ["Professional Tax", profTax],
        ["LOP", lop],
      ];

      const dataRowH = 18;
      const dataRows = 5;
      const tblDataT = tblTop + hdrH;
      const tblDataB = tblDataT + dataRows * dataRowH + dataRowH;

      for (let i = 0; i <= dataRows; i++) {
        doc.moveTo(L, tblDataT + i * dataRowH).lineTo(R, tblDataT + i * dataRowH).stroke();
      }
      doc.moveTo(L, tblDataB).lineTo(R, tblDataB).stroke();

      doc.rect(L, tblDataT, W, tblDataB - tblDataT).stroke();
      doc.moveTo(colMid, tblDataT).lineTo(colMid, tblDataB).stroke();
      doc.moveTo(earAmtL, tblDataT).lineTo(earAmtL, tblDataB).stroke();
      doc.moveTo(dedAmtL, tblDataT).lineTo(dedAmtL, tblDataB).stroke();

      earRows.forEach(([label, value], i) => {
        const y = tblDataT + i * dataRowH + 4;
        doc.font("Helvetica").fontSize(9).text(label, L + 4, y);
        doc.text(String(Math.round(value || 0)), earAmtL + 4, y, { width: colMid - earAmtL - 8, align: "right" });
      });

      dedRows.forEach(([label, value], i) => {
        const y = tblDataT + i * dataRowH + 4;
        doc.font("Helvetica").fontSize(9).text(label, colMid + 4, y);
        doc.text(String(Math.round(value || 0)), dedAmtL + 4, y, { width: R - dedAmtL - 8, align: "right" });
      });

      const totY = tblDataT + dataRows * dataRowH + 4;
      doc.font("Helvetica-Bold").fontSize(9)
        .text("Total", L + 4, totY)
        .text(String(Math.round(earTotal || 0)), earAmtL + 4, totY, { width: colMid - earAmtL - 8, align: "right" })
        .text("Net Salary", colMid + 4, totY)
        .text(String(Math.round(net || 0)), dedAmtL + 4, totY, { width: R - dedAmtL - 8, align: "right" });

      const wordsY = tblDataB + 12;
      doc.moveTo(L, wordsY - 2).lineTo(R, wordsY - 2).stroke();
      doc.font("Helvetica-Bold").fontSize(9)
        .text(`Amount in words Rs.: ${numberToWords(net || 0)}`, L, wordsY);
      doc.moveTo(L, wordsY + 14).lineTo(R, wordsY + 14).stroke();

      const sigY = wordsY + 55;
      doc.moveTo(L + 10, sigY).lineTo(L + 180, sigY).stroke()
        .moveTo(R - 180, sigY).lineTo(R - 10, sigY).stroke();
      doc.font("Helvetica-Bold").fontSize(9)
        .text("Authorised Signatory", L + 10, sigY + 5)
        .text("Employee Signature", R - 155, sigY + 5);

      doc.end();

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Save payslip record
      const [payslip, created] = await Payslip.upsert({
        payroll_id: payroll.id,
        employee_id: emp.id,
        month: payroll.month,
        year: payroll.year,
        pdf_path: filePath,
        generated_by: req.user.id,
        generated_on: new Date()
      });

      const result = await Payslip.findByPk(payslip.id, {
        include: [
          { model: Payroll, as: 'payroll' },
          { model: Employee, as: 'employee' },
          { model: User, as: 'generator', attributes: ['id', 'name'] }
        ]
      });

      return res.json(
        new ApiResponse(200, {
          payslip: result,
          pdfUrl: `/uploads/payslips/${filename}`
        }, "Payslip generated")
      );
    } catch (error) {
      return next(error);
    }
  },

  // @desc Get Payslips
  getPayslips: async (req, res, next) => {
    try {
      const where = {};
      const include = [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'employee_code']
        },
        {
          model: Payroll,
          as: 'payroll',
          attributes: ['id', 'gross_salary', 'net_salary']
        },
        {
          model: User,
          as: 'generator',
          attributes: ['id', 'name']
        }
      ];

      if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ where: { user_id: req.user.id } });
        if (emp) {
          where.employee_id = emp.id;
        }
      } else if (req.user.role === 'company_admin' || req.user.role === 'hr') {
        include[0].where = { company_id: req.user.company_id };
      }

      const payslips = await Payslip.findAll({
        where,
        include,
        order: [['year', 'DESC'], ['month', 'DESC']]
      });

      return res.json(new ApiResponse(200, payslips));
    } catch (error) {
      return next(error);
    }
  },

  // @desc Download Payslip PDF
  downloadPayslip: async (req, res, next) => {
    try {
      const payslip = await Payslip.findByPk(req.params.id, {
        include: [
          { model: Employee, as: 'employee' }
        ]
      });

      if (!payslip) {
        throw new ApiError(404, 'Payslip not found');
      }

      // Check access
      if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ where: { user_id: req.user.id } });
        if (!emp || emp.id !== payslip.employee_id) {
          throw new ApiError(403, 'Access denied');
        }
      }

      // Increment download count
      await payslip.increment('download_count');

      if (!fs.existsSync(payslip.pdf_path)) {
        throw new ApiError(404, 'Payslip file not found');
      }

      res.download(payslip.pdf_path, path.basename(payslip.pdf_path));
    } catch (error) {
      next(error);
    }
  },

  // @desc Get Payslip by ID
  getPayslipById: async (req, res, next) => {
    try {
      const payslip = await Payslip.findByPk(req.params.id, {
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'name', 'employee_code', 'designation']
          },
          {
            model: Payroll,
            as: 'payroll'
          },
          {
            model: User,
            as: 'generator',
            attributes: ['id', 'name']
          }
        ]
      });

      if (!payslip) {
        throw new ApiError(404, 'Payslip not found');
      }

      // Check access
      if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ where: { user_id: req.user.id } });
        if (!emp || emp.id !== payslip.employee_id) {
          throw new ApiError(403, 'Access denied');
        }
      }

      return res.json(new ApiResponse(200, payslip));
    } catch (error) {
      return next(error);
    }
  }
};
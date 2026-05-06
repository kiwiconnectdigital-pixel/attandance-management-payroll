const PDFDocument = require("pdfkit");
const Payroll = require("../models/Payroll.model");
const Payslip = require("../models/Payslip.model");
const Employee = require("../models/Employee.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const moment = require("moment");
const path = require("path");
const fs = require("fs");

/**
 * Converts a number to Indian currency words
 * e.g. 4362 → "Four Thousand Three Hundred Sixty Two Rupees Only"
 */
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
    if (n >= 20)  { str += tens[Math.floor(n / 10)]  + " ";          n %= 10; }
    if (n > 0)      str += ones[n] + " ";
    return str.trim();
  }

  if (!num || num === 0) return "Zero Rupees Only";

  const intPart = Math.floor(Math.abs(num));
  let result = "";
  if (intPart >= 100000) result += convertHundreds(Math.floor(intPart / 100000)) + " Lakh ";
  if (intPart >= 1000)   result += convertHundreds(Math.floor((intPart % 100000) / 1000)) + " Thousand ";
  result += convertHundreds(intPart % 1000);
  return result.trim() + " Rupees Only";
}

module.exports = {
  // @desc  Generate Payslip PDF
  // @route POST /api/v1/payslips/generate/:payrollId
  generatePayslip: async (req, res, next) => {
    try {
      const payroll = await Payroll.findById(req.params.payrollId).populate({
        path: "employee",
        populate: { path: "branch" },
      });

      if (!payroll) throw new ApiError(404, "Payroll not found");

      const emp       = payroll.employee;
      const monthName = moment(`${payroll.year}-${payroll.month}`, "YYYY-M").format("MMM-YY");

      const doc      = new PDFDocument({ margin: 50, size: "A4" });
      const filename = `payslip_${emp.employeeCode}_${payroll.year}_${payroll.month}.pdf`;
      const filePath = path.join("./uploads/payslips", filename);

      fs.mkdirSync("./uploads/payslips", { recursive: true });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const { earnings, deductions, grossSalary, netSalary, attendanceSummary } = payroll;
      const fmt = (v) => String(Math.round(Number(v) || 0));

      // ── Layout ────────────────────────────────────────────────────────────
      const L    = 40;
      const R    = 555;
      const W    = R - L;
      const col1 = L + 155;   // value starts (left panel)
      const col2 = L + 285;   // right panel starts
      const col3 = col2 + 120; // right panel value starts

      const companyName  = emp.branch?.name  || "COMPANY NAME";
      const companyEmail = emp.branch?.email || "info@company.com";

      // ── Header ────────────────────────────────────────────────────────────
      doc.font("Helvetica-Bold").fontSize(14)
         .text(companyName.toUpperCase(), L, 45, { align: "center", width: W });

      doc.moveTo(L, 65).lineTo(R, 65).stroke()
         .moveTo(L, 68).lineTo(R, 68).stroke();

      doc.font("Helvetica").fontSize(10)
         .text(`E-mail: ${companyEmail}`, L, 76);

      doc.moveTo(L, 95).lineTo(R, 95).stroke();

      // ── Info grid (6 rows) ────────────────────────────────────────────────
      const infoTop  = 100;
      const rowH     = 20;
      const infoRows = 6;
      const infoH    = infoRows * rowH;
      const infoBot  = infoTop + infoH;

      doc.rect(L, infoTop, W, infoH).stroke();
      doc.moveTo(col2, infoTop).lineTo(col2, infoBot).stroke();
      for (let i = 1; i < infoRows; i++) {
        const y = infoTop + i * rowH;
        doc.moveTo(L, y).lineTo(R, y).stroke();
      }

      // "No. of days in Months" = calendar days (e.g. 31)
      // "Total Working Days"    = weekdays / payable days (e.g. 23)
      const calendarDays   = attendanceSummary?.calendarDays    ?? "-";
      const weekdaysDenom  = attendanceSummary?.totalWorkingDays ?? "-"; // denominator
      const presentDays    = attendanceSummary?.presentDays      ?? "-";

      const leftRows = [
        ["Employee Name:", emp.name || "-"],
        ["Designation:",   emp.designation || "-"],
        ["Month & Year:",  monthName],
        ["No. of days in Months", String(calendarDays)],
        ["Total Working Days:",   String(weekdaysDenom)],
        ["UAN No.",               emp.uanNumber || ""],
      ];

      const rightRows = [
        ["PAN No.",      emp.panNumber || ""],
        ["Gross Salary", fmt(grossSalary)],
        ["", ""],
        ["", ""],
        ["", ""],
        ["", ""],
      ];

      leftRows.forEach(([label, value], i) => {
        const y = infoTop + i * rowH + 5;
        doc.font("Helvetica-Bold").fontSize(9).text(label, L + 4, y);
        doc.font("Helvetica").fontSize(9).text(value, col1, y, {
          width: col2 - col1 - 4,
          align: /^\d/.test(value) ? "right" : "left",
        });
      });

      rightRows.forEach(([label, value], i) => {
        const y = infoTop + i * rowH + 5;
        if (!label) return;
        doc.font("Helvetica-Bold").fontSize(9).text(label, col2 + 4, y);
        doc.font("Helvetica").fontSize(9).text(value, col3, y, {
          width: R - col3 - 4, align: "right",
        });
      });

      // ── Earnings / Deductions table ───────────────────────────────────────
      const tblTop  = infoBot + 12;
      const colMid  = L + W / 2;
      const earAmtL = colMid - 85;
      const dedAmtL = R - 85;

      // Header row
      const hdrH = 18;
      doc.rect(L, tblTop, W, hdrH).stroke();
      doc.moveTo(colMid,  tblTop).lineTo(colMid,  tblTop + hdrH).stroke();
      doc.moveTo(earAmtL, tblTop).lineTo(earAmtL, tblTop + hdrH).stroke();
      doc.moveTo(dedAmtL, tblTop).lineTo(dedAmtL, tblTop + hdrH).stroke();

      doc.font("Helvetica-Bold").fontSize(10)
        .text("Earnings",   L + 4,       tblTop + 4)
        .text("Amount",     earAmtL + 4, tblTop + 4)
        .text("Deductions", colMid + 4,  tblTop + 4)
        .text("Amount",     dedAmtL + 4, tblTop + 4);

      // ── Grouped amounts (as they appear on the payslip) ──────────────────
      const basicDA    = Number(earnings.basic || 0) + Number(earnings.da || 0);
      const hra        = Number(earnings.hra   || 0);
      const conveyance = Number(earnings.ta    || 0);
      // Incentive = bonus (one-time) + overtime pay
      const incentive  = Number(earnings.bonus || 0) + Number(earnings.overtime || 0) + Number(earnings.other || 0);
      const earTotal   = basicDA + hra + conveyance + incentive;

      const pf      = Number(deductions.pf      || 0);
      const esi     = Number(deductions.esic    || 0);
      const adv     = Number(deductions.advance || 0);
      const profTax = Number(deductions.pt      || 0);
      const lop     = Number(deductions.lop     || 0);  // ← add this
      // Net = earnings total minus deductions shown (LOP is already in pro-rata)
      const net = earTotal - (pf + esi + adv + profTax + lop);

      const earRows = [
        ["Basic & DA",  basicDA],
        ["HRA",         hra],
        ["Conveyance",  conveyance],
        ["Incentive",   incentive],
      ];

      const dedRows = [
        ["Provident Fund",   pf],
        ["E.S.I.",           esi],
        ["Advance",          adv],
        ["Professional Tax", profTax],
        ["LOP",              lop],
      ];

      const dataRowH  = 18;
      const dataRows  = 5;
      const tblDataT  = tblTop + hdrH;
      const tblDataB  = tblDataT + dataRows * dataRowH + dataRowH; // +1 for totals row

      // All horizontal lines
      for (let i = 0; i <= dataRows; i++) {
        doc.moveTo(L, tblDataT + i * dataRowH).lineTo(R, tblDataT + i * dataRowH).stroke();
      }
      doc.moveTo(L, tblDataB).lineTo(R, tblDataB).stroke();

      // Outer box + vertical dividers
      doc.rect(L, tblDataT, W, tblDataB - tblDataT).stroke();
      doc.moveTo(colMid,  tblDataT).lineTo(colMid,  tblDataB).stroke();
      doc.moveTo(earAmtL, tblDataT).lineTo(earAmtL, tblDataB).stroke();
      doc.moveTo(dedAmtL, tblDataT).lineTo(dedAmtL, tblDataB).stroke();

      // Data rows
      earRows.forEach(([label, value], i) => {
        const y = tblDataT + i * dataRowH + 4;
        doc.font("Helvetica").fontSize(9).text(label, L + 4, y);
        doc.text(fmt(value), earAmtL + 4, y, { width: colMid - earAmtL - 8, align: "right" });
      });

      dedRows.forEach(([label, value], i) => {
        const y = tblDataT + i * dataRowH + 4;
        doc.font("Helvetica").fontSize(9).text(label, colMid + 4, y);
        doc.text(fmt(value), dedAmtL + 4, y, { width: R - dedAmtL - 8, align: "right" });
      });

      // Totals row
      const totY = tblDataT + dataRows * dataRowH + 4;
      doc.font("Helvetica-Bold").fontSize(9)
        .text("Total",      L + 4,       totY)
        .text(fmt(earTotal), earAmtL + 4, totY, { width: colMid - earAmtL - 8, align: "right" })
        .text("Net Salary", colMid + 4,  totY)
        .text(fmt(net),     dedAmtL + 4, totY, { width: R - dedAmtL - 8, align: "right" });

      // ── Amount in words ───────────────────────────────────────────────────
      const wordsY = tblDataB + 12;
      doc.moveTo(L, wordsY - 2).lineTo(R, wordsY - 2).stroke();
      doc.font("Helvetica-Bold").fontSize(9)
         .text(`Amount in words Rs.: ${numberToWords(net)}`, L, wordsY);
      doc.moveTo(L, wordsY + 14).lineTo(R, wordsY + 14).stroke();

      // ── Signatures ────────────────────────────────────────────────────────
      const sigY = wordsY + 55;
      doc.moveTo(L + 10, sigY).lineTo(L + 180, sigY).stroke()
         .moveTo(R - 180, sigY).lineTo(R - 10,  sigY).stroke();
      doc.font("Helvetica-Bold").fontSize(9)
         .text("Authorised Signatory", L + 10,  sigY + 5)
         .text("Employee Signature",   R - 155, sigY + 5);

      doc.end();

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error",  reject);
      });

      const payslip = await Payslip.findOneAndUpdate(
        { payroll: payroll._id },
        {
          payroll:     payroll._id,
          employee:    emp._id,
          month:       payroll.month,
          year:        payroll.year,
          pdfPath:     filePath,
          generatedBy: req.user._id,
        },
        { upsert: true, new: true }
      );

      return res.json(
        new ApiResponse(200, { payslip, pdfUrl: `/uploads/payslips/${filename}` }, "Payslip generated")
      );
    } catch (error) {
      return next(error);
    }
  },

  // @desc  Get Payslips
  // @route GET /api/v1/payslips
  getPayslips: async (req, res, next) => {
    try {
      const filter = {};
      if (req.user.role === "employee") {
        const emp = await Employee.findOne({ user: req.user._id });
        if (emp) filter.employee = emp._id;
      }
      const payslips = await Payslip.find(filter)
        .populate("employee", "name employeeCode")
        .sort({ year: -1, month: -1 });
      return res.json(new ApiResponse(200, payslips));
    } catch (error) {
      return next(error);
    }
  },
};
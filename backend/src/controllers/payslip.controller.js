const PDFDocument = require("pdfkit");
const Payroll = require("../models/Payroll.model");
const Payslip = require("../models/Payslip.model");
const Employee = require("../models/Employee.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const moment = require("moment");
const path = require("path");
const fs = require("fs");

module.exports = {
  // @desc Generate Payslip
  // @route POST /api/v1/payslips/generate/:payrollId
  generatePayslip: async (req, res, next) => {
    try {
      const payroll = await Payroll.findById(req.params.payrollId).populate({
        path: "employee",
        populate: { path: "branch" },
      });

      if (!payroll) throw new ApiError(404, "Payroll not found");

      const emp = payroll.employee;
      const monthName = moment(
        `${payroll.year}-${payroll.month}`,
        "YYYY-M",
      ).format("MMMM YYYY");

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const filename = `payslip_${emp.employeeCode}_${payroll.year}_${payroll.month}.pdf`;
      const filePath = path.join("./uploads/payslips", filename);

      fs.mkdirSync("./uploads/payslips", { recursive: true });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const {
        earnings,
        deductions,
        grossSalary,
        totalDeductions,
        netSalary,
        attendanceSummary,
      } = payroll;
      const fmtAmount = (value) => Number(value || 0).toFixed(2);

      // Company header
      const pageLeft = 50;
      const pageRight = 545;
      const contentWidth = pageRight - pageLeft;

      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .text("Company Name", pageLeft, 45, {
          align: "center",
          width: contentWidth,
        });
      doc
        .font("Helvetica")
        .fontSize(10)
        .text(emp.branch?.address || "Company Address", pageLeft, 85, {
          align: "center",
          width: contentWidth,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(`Pay Slip for the Month of ${monthName}`, pageLeft, 115, {
          align: "center",
          width: contentWidth,
        });

      // Info section border
      let y = 160;
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`Date: ${moment().format("DD/MM/YYYY")}`, pageLeft + 4, y + 6);
      y += 30;

      const infoTop = y;
      const infoBottom = infoTop + 98;
      doc
        .lineWidth(1)
        .rect(pageLeft, infoTop, contentWidth, infoBottom - infoTop)
        .stroke();
      doc
        .moveTo((pageLeft + pageRight) / 2, infoTop)
        .lineTo((pageLeft + pageRight) / 2, infoBottom)
        .stroke();

      const leftLabels = [
        ["Employee Name", emp.name || "-"],
        ["Designation", emp.designation || "-"],
        ["Father's/Husband Name", "-"],
        ["Pay Days", attendanceSummary?.totalWorkingDays ?? "-"],
        ["Leaves", attendanceSummary?.leaveDays ?? "-"],
      ];

      const rightLabels = [
        ["Employee Code #", emp.employeeCode || "-"],
        ["Department", emp.department || "-"],
        [
          "Date of Joining",
          emp.dateOfJoining
            ? moment(emp.dateOfJoining).format("DD/MM/YYYY")
            : "-",
        ],
        ["Days Worked", attendanceSummary?.presentDays ?? "-"],
        ["Payment Method", "Bank Transfer"],
      ];

      let infoY = infoTop + 10;
      for (let i = 0; i < leftLabels.length; i++) {
        const [lLabel, lValue] = leftLabels[i];
        const [rLabel, rValue] = rightLabels[i];

        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(lLabel, pageLeft + 6, infoY);
        doc.font("Helvetica").text(`: ${lValue}`, pageLeft + 155, infoY);

        doc.font("Helvetica-Bold").text(rLabel, pageLeft + 255, infoY);
        doc.font("Helvetica").text(`: ${rValue}`, pageLeft + 395, infoY);

        infoY += 18;
      }

      // Earnings / Deductions table
      const tableTop = infoBottom;
      const tableBottom = tableTop + 220;
      const colMid = (pageLeft + pageRight) / 2;

      doc
        .rect(pageLeft, tableTop, contentWidth, tableBottom - tableTop)
        .stroke();
      doc.moveTo(colMid, tableTop).lineTo(colMid, tableBottom).stroke();

      const amountColLeft = colMid - 90;
      const amountColRight = pageRight - 110;
      doc
        .moveTo(amountColLeft, tableTop)
        .lineTo(amountColLeft, tableBottom)
        .stroke();
      doc
        .moveTo(amountColRight, tableTop)
        .lineTo(amountColRight, tableBottom)
        .stroke();

      doc
        .moveTo(pageLeft, tableTop + 22)
        .lineTo(pageRight, tableTop + 22)
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Earnings", pageLeft + 6, tableTop + 7)
        .text("Amount", amountColLeft + 6, tableTop + 7)
        .text("Deductions", colMid + 6, tableTop + 7)
        .text("Amount", amountColRight + 6, tableTop + 7);

      const earningsRows = [
        ["Basic Salary", earnings.basic],
        ["Conveyance Allowance", earnings.ta],
        [
          "Misc. Allowance",
          Number(earnings.hra || 0) +
            Number(earnings.da || 0) +
            Number(earnings.bonus || 0) +
            Number(earnings.overtime || 0),
        ],
        ["Others", earnings.other],
      ];

      const deductionRows = [
        ["Income Tax", deductions.tds],
        [
          "Security",
          Number(deductions.pf || 0) +
            Number(deductions.esic || 0) +
            Number(deductions.pt || 0),
        ],
        ["Others", Number(deductions.lop || 0) + Number(deductions.other || 0)],
        ["", ""],
      ];

      let rowY = tableTop + 30;
      for (let i = 0; i < 4; i++) {
        const [eTitle, eValue] = earningsRows[i];
        const [dTitle, dValue] = deductionRows[i];

        doc
          .font("Helvetica")
          .fontSize(10)
          .text(eTitle, pageLeft + 6, rowY)
          .text(dTitle, colMid + 6, rowY);

        if (eTitle) {
          doc.text(fmtAmount(eValue), amountColLeft + 6, rowY, {
            width: 80,
            align: "right",
          });
        }
        if (dTitle) {
          doc.text(fmtAmount(dValue), amountColRight + 6, rowY, {
            width: 100,
            align: "right",
          });
        }

        rowY += 22;
      }

      const totalsY = tableBottom - 36;
      doc
        .moveTo(pageLeft, totalsY - 6)
        .lineTo(pageRight, totalsY - 6)
        .stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Total Earnings", pageLeft + 6, totalsY)
        .text(fmtAmount(grossSalary), amountColLeft + 6, totalsY, {
          width: 80,
          align: "right",
        })
        .text("Total Deductions", colMid + 6, totalsY)
        .text(fmtAmount(totalDeductions), amountColRight + 6, totalsY, {
          width: 100,
          align: "right",
        });

      // Net salary band
      const netTop = tableBottom + 8;
      doc.rect(colMid, netTop, pageRight - colMid, 22).stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("Net Salary", colMid + 8, netTop + 6)
        .text(fmtAmount(netSalary), amountColRight + 6, netTop + 6, {
          width: 100,
          align: "right",
        });

      // Signature lines
      const signY = 730;
      doc
        .moveTo(pageLeft + 10, signY)
        .lineTo(pageLeft + 210, signY)
        .stroke();
      doc
        .moveTo(pageRight - 210, signY)
        .lineTo(pageRight - 10, signY)
        .stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("Director's Signatures", pageLeft + 50, signY + 6)
        .text("Payee's Signatures", pageRight - 145, signY + 6);

      doc.end();

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      const payslip = await Payslip.findOneAndUpdate(
        { payroll: payroll._id },
        {
          payroll: payroll._id,
          employee: emp._id,
          month: payroll.month,
          year: payroll.year,
          pdfPath: filePath,
          generatedBy: req.user._id,
        },
        { upsert: true, new: true },
      );

      return res.json(
        new ApiResponse(
          200,
          {
            payslip,
            pdfUrl: `/uploads/payslips/${filename}`,
          },
          "Payslip generated",
        ),
      );
    } catch (error) {
      return next(error);
    }
  },

  // @desc Get Payslips
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

const PDFDocument = require("pdfkit");

const {
  Payroll,
  Employee,
  Branch,
  Company,
  User,
  Payslip,
} = require("../models");

const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");

const moment = require("moment");
const path = require("path");
const fs = require("fs");

function numberToWords(num) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function twoDigits(n) {
    if (n < 20) {
      return ones[n];
    }

    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function threeDigits(n) {
    if (n < 100) {
      return twoDigits(n);
    }

    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + twoDigits(n % 100) : "")
    );
  }

  if (!num || Number(num) === 0) {
    return "Zero Rupees Only";
  }

  const amount = Math.floor(Math.abs(Number(num)));

  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const hundred = amount % 1000;

  let result = "";

  if (crore > 0) {
    result += threeDigits(crore) + " Crore ";
  }

  if (lakh > 0) {
    result += threeDigits(lakh) + " Lakh ";
  }

  if (thousand > 0) {
    result += threeDigits(thousand) + " Thousand ";
  }

  if (hundred > 0) {
    result += threeDigits(hundred);
  }

  return result.trim() + " Rupees Only";
}

function money(value) {
  const number = Number(value || 0);

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function amountInWords(value) {
  const amount = Math.max(0, Math.round(Number(value || 0) * 100) / 100);
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  const strip = (words) => words.replace(/\s*Rupees Only$/i, "").trim();

  const rupeeWords = rupees > 0 ? strip(numberToWords(rupees)) : "Zero";
  const paiseWords = paise > 0 ? strip(numberToWords(paise)) : "";

  return `Rupees ${rupeeWords}${paise > 0 ? ` and ${paiseWords} Paise` : ""} Only`;
}

module.exports = {
  generatePayslip: async (req, res, next) => {
    try {
      console.log("========== GENERATE PAYSLIP ==========");
      console.log("Payroll ID:", req.params.payrollId);

      const payroll = await Payroll.findByPk(req.params.payrollId, {
        include: [
          {
            model: Employee,
            as: "employee",
            include: [
              {
                model: Branch,
                as: "branch",
              },
              {
                model: Company,
                as: "company",
              },
            ],
          },
        ],
      });

      if (!payroll) {
        throw new ApiError(404, "Payroll not found");
      }

      if (!payroll.employee) {
        throw new ApiError(404, "Employee not found for this payroll");
      }

      const emp = payroll.employee;
      const company = emp.company;
      const branch = emp.branch;

      if (!company) {
        throw new ApiError(404, "Company not found for this employee");
      }

      console.log("Employee:", emp.name);
      console.log("Company:", company.name);

      if (req.user.role === "employee") {
        const loggedInEmployee = await Employee.findOne({
          where: {
            user_id: req.user.id,
          },
        });

        if (!loggedInEmployee || loggedInEmployee.id !== emp.id) {
          throw new ApiError(403, "Access denied");
        }
      }

      // --------------------------------------------------
      // MONTH
      // --------------------------------------------------

      const monthName = moment(
        `${payroll.year}-${payroll.month}`,
        "YYYY-M",
      ).format("MMMM YYYY");

      const earningBasic = Number(payroll.earning_basic || 0);
      const earningHra = Number(payroll.earning_hra || 0);
      const earningDa = Number(payroll.earning_da || 0);
      const earningTa = Number(payroll.earning_ta || 0);
      const earningOvertime = Number(payroll.earning_overtime || 0);
      const earningBonus = Number(payroll.earning_bonus || 0);
      const earningOther = Number(payroll.earning_other || 0);

      const deductionPf = Number(payroll.deduction_pf || 0);

      const deductionEsic = Number(payroll.deduction_esic || 0);

      const deductionAdvance = Number(payroll.deduction_advance || 0);

      const deductionPt = Number(payroll.deduction_pt || 0);

      const deductionTds = Number(payroll.deduction_tds || 0);

      const deductionLop = Number(payroll.deduction_lop || 0);

      const deductionOther = Number(payroll.deduction_other || 0);

      // The totals printed on the slip are calculated from the rows that are
      // printed, so the slip always adds up (this also repairs payrolls that
      // were processed before gross started to include overtime and bonus).
      // LOP is shown as a note only: it is already missing from the earnings.
      const grossSalary =
        earningBasic +
        earningHra +
        earningDa +
        earningTa +
        earningOvertime +
        earningBonus +
        earningOther;

      const totalDeductions =
        deductionPf +
        deductionEsic +
        deductionPt +
        deductionTds +
        deductionAdvance +
        deductionOther;

      const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

      if (Math.abs(netSalary - Number(payroll.net_salary || 0)) > 0.01) {
        console.warn(
          `Payslip net (${netSalary}) differs from stored net (${payroll.net_salary}) for payroll ${payroll.id}`,
        );
      }

      const calendarDays = Number(payroll.att_calendar_days || 0);

      const workingDays = Number(payroll.att_total_working_days || 0);

      const presentDays = Number(payroll.att_present_days || 0);

      const absentDays = Number(payroll.att_absent_days || 0);

      const leaveDays = Number(payroll.att_leave_days || 0);

      const halfDays = Number(payroll.att_half_days || 0);

      const overtimeHours = Number(payroll.att_overtime_hours || 0);

      const holidayCount = Number(payroll.att_holiday_count || 0);

      const payableDays = Number(payroll.att_payable_days || 0);

      const uploadDir = process.env.UPLOAD_PATH
        ? path.resolve(process.env.UPLOAD_PATH)
        : path.resolve(process.cwd(), "uploads");

      const payslipDir = path.join(uploadDir, "payslips");

      fs.mkdirSync(payslipDir, {
        recursive: true,
      });

      const safeEmployeeCode = String(emp.employee_code || emp.id).replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );

      const filename =
        `payslip_${safeEmployeeCode}_` + `${payroll.year}_${payroll.month}.pdf`;

      const filePath = path.join(payslipDir, filename);

      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
      });

      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // ==================================================
      // PAYSLIP LAYOUT
      // ==================================================

      const L = 40;
      const R = 555;
      const W = R - L;
      const PAGE_W = doc.page.width;

      const C = {
        ink: "#0F172A",
        muted: "#64748B",
        line: "#E2E8F0",
        soft: "#F8FAFC",
        brand: "#2F5BD3",
        brandSoft: "#EEF2FF",
        green: "#15803D",
        greenSoft: "#ECFDF3",
        red: "#B91C1C",
        redSoft: "#FEF2F2",
        amber: "#92400E",
        amberSoft: "#FFFBEB",
        amberLine: "#FCD34D",
      };

      const tinyLabel = (text, x, y, width, color = C.muted, align = "left") =>
        doc
          .font("Helvetica-Bold")
          .fontSize(6.3)
          .fillColor(color)
          .text(String(text).toUpperCase(), x, y, {
            width,
            align,
            characterSpacing: 0.6,
            lineBreak: false,
          });

      // Draws one line of text that always fits its width: the font shrinks
      // down to `minSize`, and only then is the text shortened with "...".
      const fitLine = (
        text,
        x,
        y,
        width,
        font,
        size,
        minSize,
        color,
        options = {},
      ) => {
        let value = String(text);
        let fontSize = size;

        doc.font(font);

        while (fontSize > minSize) {
          doc.fontSize(fontSize);
          if (doc.widthOfString(value) <= width) break;
          fontSize -= 0.25;
        }

        doc.fontSize(fontSize);

        if (doc.widthOfString(value) > width) {
          while (value.length > 1 && doc.widthOfString(value + "...") > width) {
            value = value.slice(0, -1);
          }

          value = value.trimEnd() + "...";
        }

        doc.fillColor(color).text(value, x, y, {
          width: width + 2,
          lineBreak: false,
          ...options,
        });
      };

      const amountText = (value) => (Number(value) ? money(value) : "-");

      // ---------------- header band ----------------
      doc.rect(0, 0, PAGE_W, 96).fill(C.ink);
      doc.rect(0, 96, PAGE_W, 4).fill(C.brand);

      let textX = L;

      if (company.logo) {
        try {
          let logoPath = company.logo;

          if (logoPath.startsWith("/uploads/")) {
            logoPath = logoPath.replace("/uploads/", "");
          }

          logoPath = path.join(uploadDir, logoPath);

          if (fs.existsSync(logoPath)) {
            doc.roundedRect(L, 22, 56, 52, 8).fill("#FFFFFF");
            doc.image(logoPath, L + 4, 26, {
              fit: [48, 44],
              align: "center",
              valign: "center",
            });
            textX = L + 70;
          }
        } catch (logoError) {
          console.log("Logo could not be loaded:", logoError.message);
        }
      }

      const companyAddress = [
        company.address,
        company.city,
        company.state,
        company.pincode,
      ]
        .filter(Boolean)
        .join(", ");

      fitLine(
        String(company.name || "Company").toUpperCase(),
        textX,
        26,
        330 - (textX - L),
        "Helvetica-Bold",
        15,
        9.5,
        "#FFFFFF",
      );

      doc
        .font("Helvetica")
        .fontSize(7.6)
        .fillColor("#CBD5E1")
        .text(companyAddress || "", textX, 48, {
          width: 330 - (textX - L),
          height: 20,
          ellipsis: true,
        });

      const contactLine = [
        company.email ? `E-mail: ${company.email}` : null,
        company.phone ? `Phone: ${company.phone}` : null,
      ]
        .filter(Boolean)
        .join("   |   ");

      if (contactLine) {
        doc
          .font("Helvetica")
          .fontSize(7.6)
          .fillColor("#CBD5E1")
          .text(contactLine, textX, 74, {
            width: 330 - (textX - L),
            lineBreak: false,
            ellipsis: true,
          });
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(21)
        .fillColor("#FFFFFF")
        .text("PAYSLIP", 375, 24, {
          width: R - 375,
          align: "right",
          characterSpacing: 3,
          lineBreak: false,
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#93C5FD")
        .text(monthName, 375, 54, {
          width: R - 375,
          align: "right",
          lineBreak: false,
        });

      const periodStart = moment(`${payroll.year}-${payroll.month}`, "YYYY-M")
        .startOf("month")
        .format("DD MMM");
      const periodEnd = moment(`${payroll.year}-${payroll.month}`, "YYYY-M")
        .endOf("month")
        .format("DD MMM YYYY");

      doc
        .font("Helvetica")
        .fontSize(7.6)
        .fillColor("#CBD5E1")
        .text(`Pay period: ${periodStart} - ${periodEnd}`, 375, 73, {
          width: R - 375,
          align: "right",
          lineBreak: false,
        });

      // ---------------- employee card ----------------
      const cardTop = 118;
      const cellH = 36;
      const cardH = cellH * 3 + 12;

      doc.roundedRect(L, cardTop, W, cardH, 8).fillAndStroke(C.soft, C.line);

      const employeeFields = [
        ["Employee Name", emp.name || "-"],
        ["Employee ID", emp.employee_code || "-"],
        ["Designation", emp.designation || "-"],
        ["Department", emp.department || "-"],
        ["Branch", branch?.name || "-"],
        [
          "Date of Joining",
          emp.date_of_joining
            ? moment(emp.date_of_joining).format("DD MMM YYYY")
            : "-",
        ],
        ["PAN No.", emp.pan_number || "-"],
        ["UAN No.", emp.uan_number || "-"],
        ["Days in Month", calendarDays || "-"],
      ];

      const colW = W / 3;

      employeeFields.forEach(([label, value], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = L + col * colW + 14;
        const y = cardTop + 10 + row * cellH;

        tinyLabel(label, x, y, colW - 20);

        fitLine(value, x, y + 11, colW - 24, "Helvetica-Bold", 9.5, 6.5, C.ink);
      });

      // ---------------- attendance summary ----------------
      const lopDays = absentDays + halfDays * 0.5;

      const attTop = cardTop + cardH + 14;

      tinyLabel("Attendance summary", L, attTop, 200);

      const attendanceCells = [
        ["Working days", workingDays],
        ["Present", presentDays],
        ["Half days", halfDays],
        ["Paid leave", leaveDays],
        ["Absent", absentDays],
        ["Holidays", holidayCount],
        ["LOP days", lopDays],
        ["Payable days", payableDays, true],
      ];

      const gap = 6;
      const cellW =
        (W - gap * (attendanceCells.length - 1)) / attendanceCells.length;
      const boxTop = attTop + 12;

      attendanceCells.forEach(([label, value, highlight], index) => {
        const x = L + index * (cellW + gap);

        doc
          .roundedRect(x, boxTop, cellW, 42, 6)
          .fillAndStroke(
            highlight ? C.brandSoft : "#FFFFFF",
            highlight ? C.brand : C.line,
          );

        doc
          .font("Helvetica-Bold")
          .fontSize(13)
          .fillColor(highlight ? C.brand : C.ink)
          .text(String(value), x, boxTop + 8, {
            width: cellW,
            align: "center",
            lineBreak: false,
          });

        tinyLabel(
          label,
          x,
          boxTop + 28,
          cellW,
          highlight ? C.brand : C.muted,
          "center",
        );
      });

      // ---------------- earnings / deductions ----------------
      const tableTop = boxTop + 42 + 18;
      const tableW = (W - 14) / 2;
      const rightX = L + tableW + 14;

      const earningRows = [
        ["Basic", earningBasic],
        ["House Rent Allowance (HRA)", earningHra],
        ["Dearness Allowance (DA)", earningDa],
        ["Conveyance / TA", earningTa],
        [
          overtimeHours > 0 ? `Overtime (${overtimeHours} h)` : "Overtime",
          earningOvertime,
        ],
        ["Bonus / Incentive", earningBonus],
        ["Other Earnings", earningOther],
      ];

      const deductionRows = [
        ["Provident Fund (PF)", deductionPf],
        ["E.S.I.C.", deductionEsic],
        ["Professional Tax", deductionPt],
        ["TDS", deductionTds],
        ["Advance Recovery", deductionAdvance],
        ["Other Deductions", deductionOther],
      ];

      const headH = 24;
      const bodyH = 7 * 23; // both tables are the same height
      const totalH = 26;

      const drawTable = (x, title, rows, total, totalLabel, tone) => {
        const rowH = bodyH / rows.length;

        // outer frame
        doc
          .roundedRect(x, tableTop, tableW, headH + bodyH + totalH, 8)
          .lineWidth(0.8)
          .stroke(C.line);

        // header
        doc
          .save()
          .roundedRect(x, tableTop, tableW, headH, 8)
          .clip()
          .rect(x, tableTop, tableW, headH)
          .fill(tone.soft)
          .restore();

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor(tone.main)
          .text(title, x + 12, tableTop + 8, {
            lineBreak: false,
            characterSpacing: 0.8,
          });

        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor(tone.main)
          .text("AMOUNT (Rs.)", x + 12, tableTop + 8.5, {
            width: tableW - 24,
            align: "right",
            lineBreak: false,
          });

        // body
        rows.forEach(([label, value], index) => {
          const y = tableTop + headH + index * rowH;

          if (index > 0) {
            doc
              .moveTo(x + 12, y)
              .lineTo(x + tableW - 12, y)
              .lineWidth(0.5)
              .stroke(C.line);
          }

          const textY = y + rowH / 2 - 5;

          doc
            .font("Helvetica")
            .fontSize(8.6)
            .fillColor(C.ink)
            .text(label, x + 12, textY, {
              width: tableW - 100,
              lineBreak: false,
              ellipsis: true,
            });

          doc
            .font(Number(value) ? "Helvetica-Bold" : "Helvetica")
            .fontSize(8.6)
            .fillColor(Number(value) ? C.ink : "#94A3B8")
            .text(amountText(value), x + tableW - 100, textY, {
              width: 88,
              align: "right",
              lineBreak: false,
            });
        });

        // total row
        const totalY = tableTop + headH + bodyH;

        doc
          .save()
          .roundedRect(x, tableTop, tableW, headH + bodyH + totalH, 8)
          .clip()
          .rect(x, totalY, tableW, totalH)
          .fill(tone.soft)
          .restore();

        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(tone.main)
          .text(totalLabel, x + 12, totalY + 8.5, { lineBreak: false });

        doc
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .fillColor(tone.main)
          .text(money(total), x + tableW - 112, totalY + 8, {
            width: 100,
            align: "right",
            lineBreak: false,
          });
      };

      drawTable(L, "EARNINGS", earningRows, grossSalary, "Gross Earnings", {
        main: C.green,
        soft: C.greenSoft,
      });

      drawTable(
        rightX,
        "DEDUCTIONS",
        deductionRows,
        totalDeductions,
        "Total Deductions",
        { main: C.red, soft: C.redSoft },
      );

      // ---------------- net pay ----------------
      const netTop = tableTop + headH + bodyH + totalH + 16;
      const netH = 66;

      doc.roundedRect(L, netTop, W, netH, 10).fill(C.brand);

      tinyLabel("Net pay", L + 20, netTop + 14, 120, "#BFDBFE");

      doc
        .font("Helvetica")
        .fontSize(8.4)
        .fillColor("#FFFFFF")
        .text(amountInWords(netSalary), L + 20, netTop + 29, {
          width: 285,
          height: 28,
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor("#FFFFFF")
        .text(`Rs. ${money(netSalary)}`, L + 280, netTop + 20, {
          width: W - 280 - 20,
          align: "right",
          lineBreak: false,
        });

      doc
        .font("Helvetica")
        .fontSize(7.6)
        .fillColor(C.muted)
        .text(
          `Gross earnings ${money(grossSalary)}  -  Total deductions ${money(totalDeductions)}  =  Net pay ${money(netSalary)}`,
          L,
          netTop + netH + 8,
          { width: W, align: "center", lineBreak: false },
        );

      // ---------------- notes ----------------
      let noteY = netTop + netH + 28;

      if (deductionLop > 0) {
        const noteH = 34;

        doc
          .roundedRect(L, noteY, W, noteH, 6)
          .fillAndStroke(C.amberSoft, C.amberLine);

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor(C.amber)
          .text("Loss of Pay", L + 12, noteY + 7, { lineBreak: false });

        doc
          .font("Helvetica")
          .fontSize(7.8)
          .fillColor(C.amber)
          .text(
            `${lopDays} day(s) of absence / half days = Rs. ${money(deductionLop)}  -  not paid, and already left out of the earnings above.`,
            L + 12,
            noteY + 18,
            { width: W - 24, lineBreak: false, ellipsis: true },
          );

        noteY += noteH + 12;
      }

      // ---------------- signatures ----------------
      const signY = Math.max(noteY + 34, 702);

      [
        [L, "Employer / Authorised Signatory"],
        [R - 170, "Employee Signature"],
      ].forEach(([x, label]) => {
        doc
          .moveTo(x, signY)
          .lineTo(x + 170, signY)
          .lineWidth(0.7)
          .stroke("#94A3B8");

        doc
          .font("Helvetica")
          .fontSize(7.6)
          .fillColor(C.muted)
          .text(label, x, signY + 5, {
            width: 170,
            align: "center",
            lineBreak: false,
          });
      });

      // ---------------- footer ----------------
      doc.moveTo(L, 776).lineTo(R, 776).lineWidth(0.5).stroke(C.line);

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#94A3B8")
        .text(
          `Generated on ${moment().format("DD MMM YYYY")}   |   This is a system-generated payslip and does not require a physical signature.`,
          L,
          783,
          { width: W, align: "center", lineBreak: false },
        );

      doc.end();

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);

        writeStream.on("error", reject);

        doc.on("error", reject);
      });

      const [payslip] = await Payslip.upsert({
        payroll_id: payroll.id,
        employee_id: emp.id,
        month: payroll.month,
        year: payroll.year,
        pdf_path: filePath,
        generated_by: req.user.id,
        generated_on: new Date(),
      });

      const result = await Payslip.findByPk(payslip.id, {
        include: [
          {
            model: Payroll,
            as: "payroll",
          },
          {
            model: Employee,
            as: "employee",
          },
          {
            model: User,
            as: "generator",
            attributes: ["id", "name"],
          },
        ],
      });

      const pdfUrl = `/uploads/payslips/${filename}`;

      return res.json(
        new ApiResponse(
          200,
          {
            payslip: result,
            pdfUrl,
            filename,
          },
          "Payslip generated successfully",
        ),
      );
    } catch (error) {
      console.error("❌ Payslip generation error:", error);

      return next(error);
    }
  },

  getPayslips: async (req, res, next) => {
    try {
      const where = {};

      const include = [
        {
          model: Employee,
          as: "employee",
          attributes: [
            "id",
            "name",
            "employee_code",
            "designation",
            "department",
            "company_id",
          ],
        },
        {
          model: Payroll,
          as: "payroll",
          attributes: [
            "id",
            "month",
            "year",
            "gross_salary",
            "total_deductions",
            "net_salary",
            "status",
          ],
        },
        {
          model: User,
          as: "generator",
          attributes: ["id", "name"],
        },
      ];

      if (req.user.role === "employee") {
        const emp = await Employee.findOne({
          where: {
            user_id: req.user.id,
          },
        });

        if (!emp) {
          return res.json(new ApiResponse(200, []));
        }

        where.employee_id = emp.id;
      }

      if (req.user.role === "company_admin" || req.user.role === "hr") {
        include[0].where = {
          company_id: req.user.company_id,
        };
      }

      const payslips = await Payslip.findAll({
        where,
        include,
        order: [
          ["year", "DESC"],
          ["month", "DESC"],
        ],
      });

      return res.json(new ApiResponse(200, payslips));
    } catch (error) {
      return next(error);
    }
  },

  downloadPayslip: async (req, res, next) => {
    try {
      const payslip = await Payslip.findByPk(req.params.id, {
        include: [
          {
            model: Employee,
            as: "employee",
          },
        ],
      });

      if (!payslip) {
        throw new ApiError(404, "Payslip not found");
      }

      if (req.user.role === "employee") {
        const emp = await Employee.findOne({
          where: {
            user_id: req.user.id,
          },
        });

        if (!emp || emp.id !== payslip.employee_id) {
          throw new ApiError(403, "Access denied");
        }
      }

      if (!payslip.pdf_path || !fs.existsSync(payslip.pdf_path)) {
        throw new ApiError(404, "Payslip file not found");
      }

      await payslip.increment("download_count");

      return res.download(payslip.pdf_path, path.basename(payslip.pdf_path));
    } catch (error) {
      return next(error);
    }
  },

  getPayslipById: async (req, res, next) => {
    try {
      const payslip = await Payslip.findByPk(req.params.id, {
        include: [
          {
            model: Employee,
            as: "employee",
            attributes: [
              "id",
              "name",
              "employee_code",
              "designation",
              "department",
              "company_id",
            ],
          },
          {
            model: Payroll,
            as: "payroll",
          },
          {
            model: User,
            as: "generator",
            attributes: ["id", "name"],
          },
        ],
      });

      if (!payslip) {
        throw new ApiError(404, "Payslip not found");
      }

      if (req.user.role === "employee") {
        const emp = await Employee.findOne({
          where: {
            user_id: req.user.id,
          },
        });

        if (!emp || emp.id !== payslip.employee_id) {
          throw new ApiError(403, "Access denied");
        }
      }

      return res.json(new ApiResponse(200, payslip));
    } catch (error) {
      return next(error);
    }
  },
};
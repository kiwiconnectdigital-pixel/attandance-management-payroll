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

      const grossSalary = Number(payroll.gross_salary || 0);

      const totalDeductions = Number(payroll.total_deductions || 0);

      const netSalary = Number(payroll.net_salary || 0);

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

      const L = 40;
      const R = 555;
      const W = R - L;

      let headerY = 40;

      if (company.logo) {
        try {
          let logoPath = company.logo;

          if (logoPath.startsWith("/uploads/")) {
            logoPath = logoPath.replace("/uploads/", "");
          }

          logoPath = path.join(uploadDir, logoPath);

          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, L, headerY, {
              fit: [70, 55],
            });
          }
        } catch (logoError) {
          console.log("Logo could not be loaded:", logoError.message);
        }
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(
          String(company.name || "Company").toUpperCase(),
          L + 80,
          headerY + 3,
          {
            width: W - 80,
            align: "center",
          },
        );

      const companyAddress = [
        company.address,
        company.city,
        company.state,
        company.pincode,
      ]
        .filter(Boolean)
        .join(", ");

      doc
        .font("Helvetica")
        .fontSize(9)
        .text(companyAddress || "", L + 80, headerY + 25, {
          width: W - 80,
          align: "center",
        });

      if (company.email) {
        doc.fontSize(9).text(`E-mail: ${company.email}`, L + 80, headerY + 40, {
          width: W - 80,
          align: "center",
        });
      }

      doc.moveTo(L, 105).lineTo(R, 105).stroke();

      doc.font("Helvetica-Bold").fontSize(12).text("SALARY SLIP", L, 115, {
        width: W,
        align: "center",
      });

      const infoTop = 140;
      const rowH = 22;
      const infoRows = 7;
      const infoH = infoRows * rowH;
      const infoBottom = infoTop + infoH;

      const middle = L + W / 2;

      doc.rect(L, infoTop, W, infoH).stroke();

      doc.moveTo(middle, infoTop).lineTo(middle, infoBottom).stroke();

      for (let i = 1; i < infoRows; i++) {
        const y = infoTop + i * rowH;

        doc.moveTo(L, y).lineTo(R, y).stroke();
      }

      const leftInfo = [
        ["Employee Name", emp.name || "-"],
        ["Employee Code", emp.employee_code || "-"],
        ["Designation", emp.designation || "-"],
        ["Department", emp.department || "-"],
        ["Month & Year", monthName],
        [
          "Date of Joining",
          emp.date_of_joining
            ? moment(emp.date_of_joining).format("DD-MM-YYYY")
            : "-",
        ],
        ["Branch", branch?.name || "-"],
      ];

      const rightInfo = [
        ["PAN No.", emp.pan_number || "-"],
        ["UAN No.", emp.uan_number || "-"],
        ["Days in Month", calendarDays],
        ["Working Days", workingDays],
        ["Present Days", presentDays],
        ["Leave Days", leaveDays],
        ["Payable Days", payableDays],
      ];

      leftInfo.forEach(([label, value], index) => {
        const y = infoTop + index * rowH + 6;

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(`${label}:`, L + 5, y);

        doc
          .font("Helvetica")
          .fontSize(8)
          .text(String(value), L + 95, y, {
            width: middle - L - 100,
          });
      });

      rightInfo.forEach(([label, value], index) => {
        const y = infoTop + index * rowH + 6;

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(`${label}:`, middle + 5, y);

        doc
          .font("Helvetica")
          .fontSize(8)
          .text(String(value), middle + 100, y, {
            width: R - middle - 105,
            align: typeof value === "number" ? "right" : "left",
          });
      });

      const tableTop = infoBottom + 15;

      const tableMiddle = L + W / 2;

      const earningAmountX = tableMiddle - 85;

      const deductionAmountX = R - 85;

      const headerHeight = 22;
      const dataRowHeight = 21;

      const earningRows = [
        ["Basic", earningBasic],
        ["HRA", earningHra],
        ["DA", earningDa],
        ["Conveyance / TA", earningTa],
        ["Overtime", earningOvertime],
        ["Bonus", earningBonus],
        ["Other Earnings", earningOther],
      ];

      const deductionRows = [
        ["Provident Fund (PF)", deductionPf],
        ["E.S.I.C.", deductionEsic],
        ["Professional Tax", deductionPt],
        ["TDS", deductionTds],
        ["Advance", deductionAdvance],
        ["LOP", deductionLop],
        ["Other Deductions", deductionOther],
      ];

      const maxRows = Math.max(earningRows.length, deductionRows.length);

      const tableHeight =
        headerHeight + maxRows * dataRowHeight + dataRowHeight;

      doc.rect(L, tableTop, W, tableHeight).stroke();

      doc.rect(L, tableTop, W, headerHeight).stroke();

      doc
        .moveTo(tableMiddle, tableTop)
        .lineTo(tableMiddle, tableTop + tableHeight)
        .stroke();

      doc
        .moveTo(earningAmountX, tableTop)
        .lineTo(earningAmountX, tableTop + tableHeight)
        .stroke();

      doc
        .moveTo(deductionAmountX, tableTop)
        .lineTo(deductionAmountX, tableTop + tableHeight)
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Earnings", L + 5, tableTop + 6)
        .text("Amount", earningAmountX + 5, tableTop + 6)
        .text("Deductions", tableMiddle + 5, tableTop + 6)
        .text("Amount", deductionAmountX + 5, tableTop + 6);

      for (let i = 0; i <= maxRows; i++) {
        const y = tableTop + headerHeight + i * dataRowHeight;

        doc.moveTo(L, y).lineTo(R, y).stroke();
      }

      earningRows.forEach(([label, value], index) => {
        const y = tableTop + headerHeight + index * dataRowHeight + 6;

        doc
          .font("Helvetica")
          .fontSize(8)
          .text(label, L + 5, y);

        doc.text(money(value), earningAmountX + 5, y, {
          width: tableMiddle - earningAmountX - 10,
          align: "right",
        });
      });

      deductionRows.forEach(([label, value], index) => {
        const y = tableTop + headerHeight + index * dataRowHeight + 6;

        doc
          .font("Helvetica")
          .fontSize(8)
          .text(label, tableMiddle + 5, y);

        doc.text(money(value), deductionAmountX + 5, y, {
          width: R - deductionAmountX - 10,
          align: "right",
        });
      });

      // Totals
      const totalY = tableTop + headerHeight + maxRows * dataRowHeight + 6;

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Gross Salary", L + 5, totalY)
        .text(money(grossSalary), earningAmountX + 5, totalY, {
          width: tableMiddle - earningAmountX - 10,
          align: "right",
        })
        .text("Total Deductions", tableMiddle + 5, totalY)
        .text(money(totalDeductions), deductionAmountX + 5, totalY, {
          width: R - deductionAmountX - 10,
          align: "right",
        });

      const netBoxTop = tableTop + tableHeight + 15;

      doc.rect(L, netBoxTop, W, 32).stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("NET SALARY", L + 10, netBoxTop + 9);

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(`Rs. ${money(netSalary)}`, L + 300, netBoxTop + 8, {
          width: 205,
          align: "right",
        });

      const wordsTop = netBoxTop + 48;

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(`Amount in Words: ${numberToWords(netSalary)}`, L, wordsTop, {
          width: W,
        });

      const attendanceTop = wordsTop + 30;

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Attendance Summary", L, attendanceTop);

      const attendanceData = [
        `Present: ${presentDays}`,
        `Half Day: ${halfDays}`,
        `Absent: ${absentDays}`,
        `Leave: ${leaveDays}`,
        `Holidays: ${holidayCount}`,
        `Overtime Hours: ${overtimeHours}`,
      ];

      doc
        .font("Helvetica")
        .fontSize(8)
        .text(attendanceData.join("     |     "), L, attendanceTop + 16, {
          width: W,
        });

      const signatureY = attendanceTop + 75;

      doc
        .moveTo(L + 10, signatureY)
        .lineTo(L + 170, signatureY)
        .stroke();

      doc
        .moveTo(R - 170, signatureY)
        .lineTo(R - 10, signatureY)
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("Employee Signature", L + 10, signatureY + 5);

      doc.text("Authorised Signatory", R - 170, signatureY + 5, {
        width: 160,
        align: "center",
      });

      doc
        .font("Helvetica")
        .fontSize(7)
        .text(
          "This is a system generated payslip and does not require a physical signature.",
          L,
          805,
          {
            width: W,
            align: "center",
          },
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

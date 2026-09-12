const express = require("express");

const router = express.Router();

const Controller = require("../controllers/report.controller");

const { protect } = require("../middleware/auth.middleware");

const { authorize } = require("../middleware/role.middleware");

// Protect all report routes
router.use(
  protect,
  authorize("company_admin", "hr")
);

// Attendance PDF
router.get(
  "/attendance/pdf",
  Controller.attendanceReportPDF
);

// Attendance Excel
router.get(
  "/attendance/excel",
  Controller.attendanceReportExcel
);

// Payroll PDF
router.get(
  "/payroll/pdf",
  Controller.payrollReportPDF
);

module.exports = router;
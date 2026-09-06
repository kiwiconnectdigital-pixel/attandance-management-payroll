const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");
const {
  generatePayslip,
  getPayslips,
} = require("../controllers/payslip.controller");

router.use(protect);

// @route POST /api/v1/payslips/generate/:payrollId
router.post("/generate/:payrollId", authorize("company_admin", "hr"), generatePayslip);

// @route GET /api/v1/payslips
router.get("/", getPayslips);

module.exports = router;

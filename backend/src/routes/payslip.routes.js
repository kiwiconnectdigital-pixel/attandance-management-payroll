const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");
const {
  generatePayslip,
  getPayslips,
  downloadPayslip
} = require("../controllers/payslip.controller");

router.use(protect);

router.post(
  "/generate/:payrollId",
  authorize("company_admin", "hr"),
  generatePayslip,
);

router.get("/", getPayslips);

router.get("/:id/download", downloadPayslip); 

module.exports = router;

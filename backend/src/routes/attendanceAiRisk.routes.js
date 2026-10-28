const express = require("express");

const {
  getAIRisks,
  getAIRiskSummary,
  getAIRiskById,
  reviewAIRisk,
  getEmployeeAIRiskProfile,
  testAIRisk,
  runAIRiskAnalysis,
} = require("../controllers/attendanceAiRisk.controller");

const { protect } = require("../middleware/auth.middleware");

const { authorize } = require("../middleware/role.middleware");

const router = express.Router();

// The AI risk data is sensitive: a login is required, and only HR / admins
// (and the super admin) may see it. It used to be open to anyone.
router.use(protect);

router.use(authorize("company_admin", "hr", "super_admin"));

router.get("/", getAIRisks);

router.get("/summary", getAIRiskSummary);

router.post("/run", runAIRiskAnalysis);

router.get("/employee/:employeeId", getEmployeeAIRiskProfile);

router.get("/:id", getAIRiskById);

router.patch("/:id/review", reviewAIRisk);

router.post("/test/:employeeId", testAIRisk);

module.exports = router;
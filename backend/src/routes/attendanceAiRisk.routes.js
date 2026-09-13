const express = require("express");

const {
  getAIRisks,
  getAIRiskSummary,
  getAIRiskById,
  reviewAIRisk,
  getEmployeeAIRiskProfile,
  testAIRisk
} = require("../controllers/attendanceAiRisk.controller");

const router =
  express.Router();

router.get(
  "/",
  getAIRisks
);

router.get(
  "/summary",
  getAIRiskSummary
);

router.get(
  "/:id",
  getAIRiskById
);

router.patch(
  "/:id/review",
  reviewAIRisk
);

router.post(
  "/test/:employeeId",
  testAIRisk
);

module.exports = router;
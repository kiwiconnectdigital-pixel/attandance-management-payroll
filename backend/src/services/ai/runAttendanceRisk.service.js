const { Op } = require("sequelize");

const { evaluateAttendanceRisk, findingSignature, LEVEL_RANK } = require("./attendanceRiskEngine.service");

const { buildEmployeeProfile } = require("./employeeProfile.service");

const { explainFindings } = require("./attendanceRisk.service");

// NOTE: the model is exported as AttendanceAiRisk (this file used to import
// "AttendanceAIRisk", which is undefined, so no risk was ever saved).
const { AttendanceAiRisk, Employee } = require("../../models");

const SAME_ALERT_DAYS = 7;
const RULES_MODEL_NAME = "rules-v1";

let running = false;

const isAnalysisRunning = () => running;

/**
 * Keeps the AI explanation optional: it is only requested for risks that
 * matter (medium and above), at most `maxCalls` times per run, and it is
 * switched off for the rest of the run as soon as the model is unreachable.
 */
const createLlmGate = ({ enabled = false, maxCalls = 8 } = {}) => ({
  enabled,
  remaining: maxCalls,
  unavailable: false,
});

const maybeExplain = async (profile, result, gate) => {
  if (
    !gate ||
    !gate.enabled ||
    gate.unavailable ||
    gate.remaining <= 0 ||
    result.riskScore < 30
  ) {
    return null;
  }

  gate.remaining -= 1;

  try {
    return await explainFindings({
      employeeName: profile.employee.name,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      findings: result.findings,
      windowDays: profile.windowDays,
    });
  } catch (error) {
    // Ollama is not running / the model is missing: carry on with the rules
    gate.unavailable = true;
    console.warn("AI explanation skipped (model not reachable):", error.message);

    return null;
  }
};

/**
 * Analyses one employee and stores the result.
 * Returns { action: "created" | "updated" | "skipped" | "clean", risk }.
 */
const analyzeEmployee = async ({ employeeId, days = 30, gate = null }) => {
  const profile = await buildEmployeeProfile(employeeId, { days });

  const result = evaluateAttendanceRisk(profile);

  // nothing unusual: no alert is created
  if (!result.findings.length) {
    return { action: "clean", risk: null, result };
  }

  const explained = await maybeExplain(profile, result, gate);

  const lastAttendance = profile.attendance[profile.attendance.length - 1];

  const fields = {
    company_id: profile.employee.companyId,
    employee_id: employeeId,
    attendance_id: lastAttendance ? lastAttendance.id : null,
    risk_score: result.riskScore,
    risk_level: result.riskLevel,
    findings: result.findings,
    ai_explanation: explained ? explained.explanation : result.explanation,
    recommended_action: explained
      ? explained.recommendedAction
      : result.recommendedAction,
    model_name: explained
      ? `${RULES_MODEL_NAME} + ${explained.model}`
      : RULES_MODEL_NAME,
    analyzed_at: new Date(),
  };

  // The same alert should not pile up every time the analysis runs
  const since = new Date(Date.now() - SAME_ALERT_DAYS * 24 * 60 * 60 * 1000);

  const recent = await AttendanceAiRisk.findAll({
    where: {
      employee_id: employeeId,
      analyzed_at: { [Op.gte]: since },
    },
    order: [["analyzed_at", "DESC"]],
  });

  const signature = findingSignature(result.findings);

  const match = recent.find(
    (risk) => findingSignature(risk.findings) === signature,
  );

  if (match && match.status === "open") {
    await match.update(fields);

    return { action: "updated", risk: match, result };
  }

  if (
    match &&
    LEVEL_RANK[result.riskLevel] <= (LEVEL_RANK[match.risk_level] || 0)
  ) {
    // already reviewed / dismissed and not any worse than before
    return { action: "skipped", risk: match, result };
  }

  const risk = await AttendanceAiRisk.create({
    ...fields,
    status: "open",
  });

  return { action: "created", risk, result };
};

// Kept for the existing "test" endpoint: analyse a single employee
const runAttendanceRiskAnalysis = async ({
  employeeId,
  attendanceId = null, // eslint-disable-line no-unused-vars
  days = 30,
  useLlm = process.env.AI_RISK_USE_LLM !== "false",
}) => {
  const outcome = await analyzeEmployee({
    employeeId,
    days,
    gate: createLlmGate({ enabled: useLlm }),
  });

  return outcome.risk;
};

/**
 * Analyses every active employee (of one company, or of all companies when
 * companyId is empty) and returns a summary of what happened.
 */
const runCompanyAttendanceRiskAnalysis = async ({
  companyId = null,
  days = 30,
  useLlm = false,
  maxLlmCalls = 8,
} = {}) => {
  if (running) {
    const error = new Error("An AI attendance analysis is already running");
    error.code = "ALREADY_RUNNING";
    throw error;
  }

  running = true;

  const startedAt = new Date();

  const summary = {
    employees: 0,
    analyzed: 0,
    flagged: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    clean: 0,
    failed: 0,
    usedAiExplanations: false,
    days,
    startedAt,
    finishedAt: null,
  };

  try {
    const employees = await Employee.findAll({
      where: {
        is_active: true,
        ...(companyId ? { company_id: companyId } : {}),
      },
      attributes: ["id", "company_id"],
      order: [["id", "ASC"]],
    });

    summary.employees = employees.length;

    const gate = createLlmGate({ enabled: useLlm, maxCalls: maxLlmCalls });

    for (const employee of employees) {
      try {
        const outcome = await analyzeEmployee({
          employeeId: employee.id,
          days,
          gate,
        });

        summary.analyzed += 1;
        summary[outcome.action] += 1;

        if (outcome.action !== "clean") summary.flagged += 1;
      } catch (error) {
        summary.failed += 1;

        console.error(
          `AI attendance analysis failed for employee ${employee.id}:`,
          error.message,
        );
      }
    }

    summary.usedAiExplanations =
      useLlm && !gate.unavailable && gate.remaining < maxLlmCalls;
  } finally {
    summary.finishedAt = new Date();
    running = false;
  }

  return summary;
};

module.exports = {
  runAttendanceRiskAnalysis,
  runCompanyAttendanceRiskAnalysis,
  analyzeEmployee,
  isAnalysisRunning,
};
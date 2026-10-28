const cron = require("node-cron");

const {
  runCompanyAttendanceRiskAnalysis,
  isAnalysisRunning,
} = require("./runAttendanceRisk.service");

const runScheduledAnalysis = async (label) => {
  if (isAnalysisRunning()) return;

  try {
    // scheduled runs use the rules only; set AI_RISK_USE_LLM=true to let a
    // local Ollama model also write the explanations
    const summary = await runCompanyAttendanceRiskAnalysis({
      days: 30,
      useLlm: process.env.AI_RISK_USE_LLM === "true",
    });

    console.log(
      `✅ AI attendance analysis (${label}): ${summary.analyzed}/${summary.employees} employees, ${summary.flagged} flagged (${summary.created} new, ${summary.updated} updated), ${summary.failed} failed`,
    );
  } catch (error) {
    console.error(`❌ AI attendance analysis (${label}) failed:`, error.message);
  }
};

/**
 * Keeps the AI Attendance Monitor filled without anybody pressing a button:
 * every 6 hours (India time) and once shortly after the server starts.
 */
const startAttendanceRiskScheduler = () => {
  cron.schedule("15 */6 * * *", () => runScheduledAnalysis("scheduled"), {
    timezone: "Asia/Kolkata",
  });

  if (process.env.AI_RISK_RUN_ON_START !== "false") {
    const timer = setTimeout(() => runScheduledAnalysis("startup"), 20000);

    if (timer.unref) timer.unref();
  }
};

module.exports = {
  startAttendanceRiskScheduler,
};
const {
  analyzeAttendance
} = require("./attendanceRisk.service");

const {
  buildEmployeeProfile
} = require("./employeeProfile.service");

const {
  AttendanceAIRisk
} = require("../../models");

const runAttendanceRiskAnalysis =
  async ({
    employeeId,
    attendanceId
  }) => {

    const profile =
      await buildEmployeeProfile(
        employeeId
      );

    const result =
      await analyzeAttendance(
        profile
      );

    const risk =
      await AttendanceAIRisk.create({
        company_id:
          profile.employee.company_id,

        employee_id:
          employeeId,

        attendance_id:
          attendanceId,

        risk_score:
          result.riskScore,

        risk_level:
          result.riskLevel,

        findings:
          result.findings,

        ai_explanation:
          result.explanation,

        recommended_action:
          result.recommendedAction,

        model_name:
          "qwen3:4b",

        analyzed_at:
          new Date(),

        status:
          "open"
      });

    return risk;
  };

module.exports = {
  runAttendanceRiskAnalysis
};
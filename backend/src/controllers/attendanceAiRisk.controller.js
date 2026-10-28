const { AttendanceAiRisk, Employee } = require("../models");

const {
  runAttendanceRiskAnalysis,
  runCompanyAttendanceRiskAnalysis,
  analyzeEmployee,
  isAnalysisRunning,
} = require("../services/ai/runAttendanceRisk.service");

const { Op } = require("sequelize");

// A company user only ever sees (and changes) their own company's risks.
// A super admin has no company, so nothing is filtered for them.
const companyScope = (req) =>
  req.user && req.user.company_id ? { company_id: req.user.company_id } : {};

const getAIRisks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      riskLevel,
      status,
      employeeId,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);

    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

    const offset = (pageNumber - 1) * limitNumber;

    const where = { ...companyScope(req) };

    if (riskLevel) {
      where.risk_level = riskLevel;
    }

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employee_id = employeeId;
    }

    if (startDate || endDate) {
      where.analyzed_at = {};

      if (startDate) {
        where.analyzed_at[Op.gte] = new Date(`${startDate}T00:00:00`);
      }

      if (endDate) {
        where.analyzed_at[Op.lte] = new Date(`${endDate}T23:59:59`);
      }
    }

    const result = await AttendanceAiRisk.findAndCountAll({
      where,

      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["id", "name", "employee_code"],

          required: search ? true : false,

          ...(search
            ? {
                where: {
                  [Op.or]: [
                    {
                      name: {
                        [Op.like]: `%${search}%`,
                      },
                    },
                    {
                      employee_code: {
                        [Op.like]: `%${search}%`,
                      },
                    },
                  ],
                },
              }
            : {}),
        },
      ],

      order: [["analyzed_at", "DESC"]],

      limit: limitNumber,
      offset,
    });

    const data = result.rows.map((risk) => {
      const json = risk.toJSON();

      return {
        id: json.id,

        companyId: json.company_id,

        employeeId: json.employee_id,

        employeeName: json.employee?.name || null,

        employeeCode: json.employee?.employee_code || null,

        attendanceId: json.attendance_id,

        riskScore: Number(json.risk_score),

        riskLevel: json.risk_level,

        findings: json.findings || [],

        aiExplanation: json.ai_explanation,

        recommendedAction: json.recommended_action,

        modelName: json.model_name,

        analyzedAt: json.analyzed_at,

        status: json.status,

        reviewedBy: json.reviewed_by,

        reviewedAt: json.reviewed_at,
      };
    });

    return res.json({
      success: true,

      data,

      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: result.count,
        totalPages: Math.ceil(result.count / limitNumber),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAIRiskSummary = async (req, res, next) => {
  try {
    const risks = await AttendanceAiRisk.findAll({
      where: { ...companyScope(req) },
      attributes: ["risk_level", "status"],
    });

    const summary = {
      total: risks.length,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      open: 0,
      reviewed: 0,
      dismissed: 0,
      confirmed: 0,
    };

    risks.forEach((risk) => {
      const level = risk.risk_level;

      const status = risk.status;

      if (Object.prototype.hasOwnProperty.call(summary, level)) {
        summary[level]++;
      }

      if (Object.prototype.hasOwnProperty.call(summary, status)) {
        summary[status]++;
      }
    });

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

const getAIRiskById = async (req, res, next) => {
  try {
    const risk = await AttendanceAiRisk.findOne({
      where: { id: req.params.id, ...companyScope(req) },
      include: [
        {
          model: Employee,
          as: "employee",
        },
      ],
    });

    if (!risk) {
      return res.status(404).json({
        success: false,
        message: "AI attendance risk not found",
      });
    }

    const json = risk.toJSON();

    return res.json({
      success: true,

      data: {
        id: json.id,

        companyId: json.company_id,

        employeeId: json.employee_id,

        // the details page reads camelCase names
        employee: json.employee
          ? {
              id: json.employee.id,
              name: json.employee.name,
              employeeCode: json.employee.employee_code,
              department: json.employee.department,
              designation: json.employee.designation,
            }
          : null,

        attendanceId: json.attendance_id,

        riskScore: Number(json.risk_score),

        riskLevel: json.risk_level,

        findings: json.findings || [],

        aiExplanation: json.ai_explanation,

        recommendedAction: json.recommended_action,

        modelName: json.model_name,

        analyzedAt: json.analyzed_at,

        status: json.status,

        reviewedBy: json.reviewed_by,

        reviewedAt: json.reviewed_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

const reviewAIRisk = async (req, res, next) => {
  try {
    const { status } = req.body;

    const allowedStatuses = ["reviewed", "dismissed", "confirmed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status",
      });
    }

    const risk = await AttendanceAiRisk.findOne({
      where: { id: req.params.id, ...companyScope(req) },
    });

    if (!risk) {
      return res.status(404).json({
        success: false,
        message: "AI attendance risk not found",
      });
    }

    risk.status = status;

    risk.reviewed_by = req.user?.id || null;

    risk.reviewed_at = new Date();

    await risk.save();

    return res.json({
      success: true,

      message: "AI attendance risk updated successfully",

      data: risk,
    });
  } catch (error) {
    next(error);
  }
};

const getEmployeeAIRiskProfile = async (req, res, next) => {
  try {
    const risks = await AttendanceAiRisk.findAll({
      where: {
        employee_id: req.params.employeeId,
        ...companyScope(req),
      },

      order: [["analyzed_at", "DESC"]],

      limit: 50,
    });

    const scores = risks.map((risk) => Number(risk.risk_score));

    const averageRisk = scores.length
      ? scores.reduce((sum, value) => sum + value, 0) / scores.length
      : 0;

    return res.json({
      success: true,

      data: {
        employeeId: Number(req.params.employeeId),

        totalAnalyses: risks.length,

        averageRisk: Number(averageRisk.toFixed(2)),

        latestRisk: risks[0] || null,

        risks,
      },
    });
  } catch (error) {
    next(error);
  }
};

const testAIRisk = async (req, res, next) => {
  try {
    const employeeId = Number(req.params.employeeId);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Valid employeeId is required",
      });
    }

    const employee = await Employee.findOne({
      where: { id: employeeId, ...companyScope(req) },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const risk = await runAttendanceRiskAnalysis({
      employeeId,
      attendanceId: null,
    });

    if (!risk) {
      return res.json({
        success: true,

        message: "No unusual attendance patterns were found for this employee",

        data: null,
      });
    }

    return res.status(201).json({
      success: true,

      message: "AI attendance analysis completed",

      data: risk,
    });
  } catch (error) {
    console.error("❌ AI test failed:", error);

    next(error);
  }
};

/**
 * "Run AI analysis" button: scans the last N days of every active employee
 * (or just one) and stores whatever unusual patterns it finds.
 */
const runAIRiskAnalysis = async (req, res, next) => {
  try {
    if (isAnalysisRunning()) {
      return res.status(409).json({
        success: false,
        message:
          "An AI attendance analysis is already running. Please wait a moment and refresh.",
      });
    }

    const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 30, 1), 180);

    const useLlm =
      req.body?.useAi !== false && process.env.AI_RISK_USE_LLM !== "false";

    if (req.body?.employeeId) {
      const employeeId = Number(req.body.employeeId);

      const employee = await Employee.findOne({
        where: { id: employeeId, ...companyScope(req) },
      });

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      const outcome = await analyzeEmployee({ employeeId, days });

      return res.json({
        success: true,
        message:
          outcome.action === "clean"
            ? "No unusual attendance patterns were found"
            : "AI attendance analysis completed",
        data: {
          employees: 1,
          analyzed: 1,
          flagged: outcome.action === "clean" ? 0 : 1,
          created: outcome.action === "created" ? 1 : 0,
          updated: outcome.action === "updated" ? 1 : 0,
          skipped: outcome.action === "skipped" ? 1 : 0,
          clean: outcome.action === "clean" ? 1 : 0,
          failed: 0,
          days,
        },
      });
    }

    const summary = await runCompanyAttendanceRiskAnalysis({
      companyId: req.user?.company_id || null,
      days,
      useLlm,
      maxLlmCalls: 5,
    });

    return res.json({
      success: true,
      message: `Analysed ${summary.analyzed} employee(s): ${summary.flagged} with unusual patterns`,
      data: summary,
    });
  } catch (error) {
    if (error.code === "ALREADY_RUNNING") {
      return res.status(409).json({ success: false, message: error.message });
    }

    console.error("❌ AI attendance analysis failed:", error);

    next(error);
  }
};

module.exports = {
  runAIRiskAnalysis,
  getAIRisks,
  getAIRiskSummary,
  getAIRiskById,
  reviewAIRisk,
  getEmployeeAIRiskProfile,
  testAIRisk,
};
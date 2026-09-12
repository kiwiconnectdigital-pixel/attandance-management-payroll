const {
  AttendanceAiRisk,
  Employee
} = require("../models");

const {
  runAttendanceRiskAnalysis
} = require("../services/ai/runAttendanceRisk.service");

const { Op } = require("sequelize");

/**
 * GET /api/v1/attendance-ai-risks
 */
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
      search
    } = req.query;

    const pageNumber =
      Math.max(parseInt(page, 10) || 1, 1);

    const limitNumber =
      Math.min(
        Math.max(parseInt(limit, 10) || 100, 1),
        500
      );

    const offset =
      (pageNumber - 1) * limitNumber;

    const where = {};

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
        where.analyzed_at[Op.gte] =
          new Date(`${startDate}T00:00:00`);
      }

      if (endDate) {
        where.analyzed_at[Op.lte] =
          new Date(`${endDate}T23:59:59`);
      }
    }

    const result =
      await AttendanceAiRisk.findAndCountAll({
        where,

        include: [
          {
            model: Employee,
            as: "employee",
            attributes: [
              "id",
              "name",
              "employee_code"
            ],

            required: search
              ? true
              : false,

            ...(search
              ? {
                  where: {
                    [Op.or]: [
                      {
                        name: {
                          [Op.like]:
                            `%${search}%`
                        }
                      },
                      {
                        employee_code: {
                          [Op.like]:
                            `%${search}%`
                        }
                      }
                    ]
                  }
                }
              : {})
          }
        ],

        order: [
          ["analyzed_at", "DESC"]
        ],

        limit: limitNumber,
        offset
      });

    const data =
      result.rows.map((risk) => {
        const json =
          risk.toJSON();

        return {
          id: json.id,

          companyId:
            json.company_id,

          employeeId:
            json.employee_id,

          employeeName:
            json.employee?.name || null,

          employeeCode:
            json.employee?.employee_code ||
            null,

          attendanceId:
            json.attendance_id,

          riskScore:
            Number(json.risk_score),

          riskLevel:
            json.risk_level,

          findings:
            json.findings || [],

          aiExplanation:
            json.ai_explanation,

          recommendedAction:
            json.recommended_action,

          modelName:
            json.model_name,

          analyzedAt:
            json.analyzed_at,

          status:
            json.status,

          reviewedBy:
            json.reviewed_by,

          reviewedAt:
            json.reviewed_at
        };
      });

    return res.json({
      success: true,

      data,

      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: result.count,
        totalPages:
          Math.ceil(
            result.count / limitNumber
          )
      }
    });

  } catch (error) {
    next(error);
  }
};


/**
 * GET /api/v1/attendance-ai-risks/summary
 */
const getAIRiskSummary = async (
  req,
  res,
  next
) => {
  try {
    const risks =
      await AttendanceAiRisk.findAll({
        attributes: [
          "risk_level",
          "status"
        ]
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
      confirmed: 0
    };

    risks.forEach((risk) => {
      const level =
        risk.risk_level;

      const status =
        risk.status;

      if (
        Object.prototype.hasOwnProperty.call(
          summary,
          level
        )
      ) {
        summary[level]++;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          summary,
          status
        )
      ) {
        summary[status]++;
      }
    });

    return res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    next(error);
  }
};


/**
 * GET /api/v1/attendance-ai-risks/:id
 */
const getAIRiskById = async (
  req,
  res,
  next
) => {
  try {
    const risk =
      await AttendanceAiRisk.findByPk(
        req.params.id,
        {
          include: [
            {
              model: Employee,
              as: "employee"
            }
          ]
        }
      );

    if (!risk) {
      return res.status(404).json({
        success: false,
        message:
          "AI attendance risk not found"
      });
    }

    const json =
      risk.toJSON();

    return res.json({
      success: true,

      data: {
        id: json.id,

        companyId:
          json.company_id,

        employeeId:
          json.employee_id,

        employee:
          json.employee || null,

        attendanceId:
          json.attendance_id,

        riskScore:
          Number(json.risk_score),

        riskLevel:
          json.risk_level,

        findings:
          json.findings || [],

        aiExplanation:
          json.ai_explanation,

        recommendedAction:
          json.recommended_action,

        modelName:
          json.model_name,

        analyzedAt:
          json.analyzed_at,

        status:
          json.status,

        reviewedBy:
          json.reviewed_by,

        reviewedAt:
          json.reviewed_at
      }
    });

  } catch (error) {
    next(error);
  }
};


/**
 * PATCH /api/v1/attendance-ai-risks/:id/review
 */
const reviewAIRisk = async (
  req,
  res,
  next
) => {
  try {
    const {
      status
    } = req.body;

    const allowedStatuses = [
      "reviewed",
      "dismissed",
      "confirmed"
    ];

    if (
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid review status"
      });
    }

    const risk =
      await AttendanceAiRisk.findByPk(
        req.params.id
      );

    if (!risk) {
      return res.status(404).json({
        success: false,
        message:
          "AI attendance risk not found"
      });
    }

    risk.status = status;

    risk.reviewed_by =
      req.user?.id || null;

    risk.reviewed_at =
      new Date();

    await risk.save();

    return res.json({
      success: true,

      message:
        "AI attendance risk updated successfully",

      data: risk
    });

  } catch (error) {
    next(error);
  }
};


/**
 * GET /api/v1/employees/:employeeId/ai-risk-profile
 */
const getEmployeeAIRiskProfile =
  async (req, res, next) => {
    try {
      const risks =
        await AttendanceAiRisk.findAll({
          where: {
            employee_id:
              req.params.employeeId
          },

          order: [
            ["analyzed_at", "DESC"]
          ],

          limit: 50
        });

      const scores =
        risks.map((risk) =>
          Number(risk.risk_score)
        );

      const averageRisk =
        scores.length
          ? scores.reduce(
              (sum, value) =>
                sum + value,
              0
            ) / scores.length
          : 0;

      return res.json({
        success: true,

        data: {
          employeeId:
            Number(
              req.params.employeeId
            ),

          totalAnalyses:
            risks.length,

          averageRisk:
            Number(
              averageRisk.toFixed(2)
            ),

          latestRisk:
            risks[0] || null,

          risks
        }
      });

    } catch (error) {
      next(error);
    }
  };


/**
 * TEST ENDPOINT
 *
 * This lets us test Ollama + database
 * without waiting for an attendance punch.
 *
 * POST /api/v1/attendance-ai-risks/test/:employeeId
 */
const testAIRisk =
  async (req, res, next) => {
    try {
      const employeeId =
        Number(req.params.employeeId);

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message:
            "Valid employeeId is required"
        });
      }

      const employee =
        await Employee.findByPk(
          employeeId
        );

      if (!employee) {
        return res.status(404).json({
          success: false,
          message:
            "Employee not found"
        });
      }

      const risk =
        await runAttendanceRiskAnalysis({
          employeeId,
          attendanceId: null
        });

      return res.status(201).json({
        success: true,

        message:
          "AI attendance analysis completed",

        data: risk
      });

    } catch (error) {
      console.error(
        "❌ AI test failed:",
        error
      );

      next(error);
    }
  };


module.exports = {
  getAIRisks,
  getAIRiskSummary,
  getAIRiskById,
  reviewAIRisk,
  getEmployeeAIRiskProfile,
  testAIRisk
};
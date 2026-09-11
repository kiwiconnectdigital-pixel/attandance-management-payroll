const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class AttendanceAiRisk extends Model {}

AttendanceAiRisk.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },

    company_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: "companies",
        key: "id"
      }
    },

    employee_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: "employees",
        key: "id"
      }
    },

    attendance_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: "attendances",
        key: "id"
      }
    },

    risk_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },

    risk_level: {
      type: DataTypes.ENUM(
        "low",
        "medium",
        "high",
        "critical"
      ),
      allowNull: false,
      defaultValue: "low"
    },

    findings: {
      type: DataTypes.JSON,
      allowNull: true
    },

    ai_explanation: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    recommended_action: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    model_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    analyzed_at: {
      type: DataTypes.DATE,
      allowNull: false
    },

    status: {
      type: DataTypes.ENUM(
        "open",
        "reviewed",
        "dismissed",
        "confirmed"
      ),
      allowNull: false,
      defaultValue: "open"
    },

    reviewed_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: "users",
        key: "id"
      }
    },

    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: "AttendanceAiRisk",
    tableName: "attendance_ai_risks",

    timestamps: true,
    underscored: true,
    paranoid: false,

    indexes: [
      {
        fields: ["employee_id"]
      },
      {
        fields: ["company_id"]
      },
      {
        fields: ["attendance_id"]
      },
      {
        fields: ["risk_level"]
      },
      {
        fields: ["status"]
      }
    ]
  }
);

module.exports = AttendanceAiRisk;

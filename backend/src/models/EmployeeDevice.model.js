const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class EmployeeDevice extends Model {}

EmployeeDevice.init(
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

    device_id: {
      type: DataTypes.STRING(255),
      allowNull: false
    },

    device_model: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    os: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    app_version: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    first_seen: {
      type: DataTypes.DATE,
      allowNull: false
    },

    last_seen: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    sequelize,

    modelName: "EmployeeDevice",

    tableName: "employee_devices",

    timestamps: true,

    underscored: true,

    paranoid: false,

    indexes: [
      {
        fields: ["employee_id"]
      },
      {
        fields: ["device_id"]
      },
      {
        fields: ["company_id"]
      }
    ]
  }
);

module.exports = EmployeeDevice;

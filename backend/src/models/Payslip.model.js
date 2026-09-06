// models/Payslip.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Payslip extends Model {}

Payslip.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    payroll_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "payrolls", key: "id" },
      unique: true 
    },
    employee_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "employees", key: "id" } 
    },
    month: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    pdf_path: { type: DataTypes.STRING(500), allowNull: true },
    generated_by: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "users", key: "id" } 
    },
    generated_on: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    download_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Payslip",
    tableName: "payslips",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["payroll_id"], unique: true },
      { fields: ["employee_id"] },
      { fields: ["month", "year"] },
    ],
  }
);

module.exports = Payslip;
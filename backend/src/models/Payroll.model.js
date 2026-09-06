// models/Payroll.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Payroll extends Model {}

Payroll.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    employee_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "employees", key: "id" } 
    },
    month: { type: DataTypes.INTEGER, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    // Earnings
    earning_basic: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    earning_hra: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    earning_da: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    earning_ta: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    earning_overtime: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    earning_bonus: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    earning_other: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    // Deductions
    deduction_esic: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    deduction_advance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    deduction_pt: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    deduction_tds: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    deduction_lop: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    deduction_other: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    // Summary
    gross_salary: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    total_deductions: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    net_salary: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    // Attendance Summary
    att_total_working_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    att_present_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    att_absent_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    att_leave_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    att_overtime_hours: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    att_calendar_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    att_weekdays_in_month: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    att_holiday_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    att_payable_days: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    att_half_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: { 
      type: DataTypes.ENUM("draft", "processed", "paid"), 
      allowNull: false, 
      defaultValue: "draft" 
    },
    processed_by: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "users", key: "id" } 
    },
    processed_on: { type: DataTypes.DATE, allowNull: true },
    paid_on: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Payroll",
    tableName: "payrolls",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["employee_id", "month", "year"], unique: true },
      { fields: ["employee_id"] },
      { fields: ["month", "year"] },
      { fields: ["status"] },
    ],
  }
);

module.exports = Payroll;
// models/Employee.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Employee extends Model {
  // Virtual for gross salary
  get grossSalary() {
    return (this.salary_basic || 0) + (this.salary_hra || 0) + 
           (this.salary_da || 0) + (this.salary_ta || 0) + (this.salary_other || 0);
  }
}

Employee.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    company_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "companies", key: "id" } 
    },
    user_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      unique: true,
      references: { model: "users", key: "id" } 
    },
    branch_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "branches", key: "id" } 
    },
    employee_code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    department: { type: DataTypes.STRING(100), allowNull: true },
    designation: { type: DataTypes.STRING(100), allowNull: true },
    date_of_joining: { type: DataTypes.DATEONLY, allowNull: true },
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    gender: { type: DataTypes.ENUM("male", "female", "other"), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    profile_image: { type: DataTypes.STRING(255), allowNull: true },
    face_descriptor: { type: DataTypes.JSON, allowNull: true },
    photo: { type: DataTypes.STRING(255), allowNull: true },
    // Work Schedule
    work_start_hour: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 9 },
    work_start_minute: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    late_threshold_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Salary Structure
    salary_basic: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    salary_hra: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    salary_da: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    salary_ta: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    salary_other: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    // Leave Balances
    leave_balance_cl: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 12 },
    leave_balance_sl: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 12 },
    leave_balance_pl: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 15 },
    // Bank Details
    bank_account_number: { type: DataTypes.STRING(50), allowNull: true },
    bank_name: { type: DataTypes.STRING(255), allowNull: true },
    bank_ifsc_code: { type: DataTypes.STRING(20), allowNull: true },
    // Government IDs
    pan_number: { type: DataTypes.STRING(20), allowNull: true },
    aadhar_number: { type: DataTypes.STRING(20), allowNull: true },
    pf_number: { type: DataTypes.STRING(50), allowNull: true },
    esic_number: { type: DataTypes.STRING(50), allowNull: true },
    uan_number: { type: DataTypes.STRING(50), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Employee",
    tableName: "employees",
    timestamps: true,
    underscored: true,
    paranoid: false,
    hooks: {
      beforeCreate: async (employee) => {
        if (!employee.employee_code) {
          const count = await Employee.count({ where: { company_id: employee.company_id } });
          employee.employee_code = `EMP${String(count + 1).padStart(3, "0")}`;
        }
      },
    },
    indexes: [
      { fields: ["employee_code"] },
      { fields: ["email"] },
      { fields: ["company_id"] },
      { fields: ["branch_id"] },
      { fields: ["user_id"] },
      { fields: ["is_active"] },
    ],
  }
);

module.exports = Employee;
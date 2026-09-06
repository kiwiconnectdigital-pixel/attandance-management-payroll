// models/Attendance.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Attendance extends Model {}

Attendance.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    employee_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "employees", key: "id" } 
    },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { 
      type: DataTypes.ENUM("present", "absent", "half-day", "on-leave", "holiday", "weekend"), 
      allowNull: false, 
      defaultValue: "absent" 
    },
    working_hours: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    overtime_hours: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    is_late: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    late_by_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Attendance",
    tableName: "attendance",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["employee_id", "date"], unique: true },
      { fields: ["employee_id"] },
      { fields: ["date"] },
      { fields: ["status"] },
    ],
  }
);

module.exports = Attendance;
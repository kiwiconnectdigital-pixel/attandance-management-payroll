// models/Leave.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Leave extends Model {}

Leave.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    employee_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "employees", key: "id" } 
    },
    leave_type: { 
      type: DataTypes.ENUM("CL", "SL", "PL", "HD"), 
      allowNull: false 
    },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    total_days: { type: DataTypes.DECIMAL(5, 1), allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    half_day_option: { 
      type: DataTypes.ENUM("first_half", "second_half"), 
      allowNull: true 
    },
    status: { 
      type: DataTypes.ENUM("pending", "approved", "rejected", "cancelled"), 
      allowNull: false, 
      defaultValue: "pending" 
    },
    applied_on: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reviewed_by: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "users", key: "id" } 
    },
    reviewed_on: { type: DataTypes.DATE, allowNull: true },
    review_remarks: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Leave",
    tableName: "leaves",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["employee_id"] },
      { fields: ["status"] },
      { fields: ["start_date", "end_date"] },
    ],
  }
);

module.exports = Leave;
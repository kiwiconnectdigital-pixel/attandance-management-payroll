// models/AuditLog.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class AuditLog extends Model {}

AuditLog.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    table_name: { type: DataTypes.STRING(50), allowNull: false },
    record_id: { type: DataTypes.BIGINT, allowNull: false },
    audit_action: { 
      type: DataTypes.ENUM("create", "update", "delete"), 
      allowNull: false 
    },
    old_value: { type: DataTypes.JSON, allowNull: true },
    new_value: { type: DataTypes.JSON, allowNull: true },
    performed_by: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "users", key: "id" } 
    },
    performed_at: { type: DataTypes.DATE, allowNull: false },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "AuditLog",
    tableName: "audit_logs",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["table_name", "record_id"] },
    ],
  }
);

module.exports = AuditLog;
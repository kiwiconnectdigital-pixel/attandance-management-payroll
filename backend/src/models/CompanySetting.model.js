// models/CompanySetting.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class CompanySetting extends Model {}

CompanySetting.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    company_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "companies", key: "id" } 
    },
    setting_key: { type: DataTypes.STRING(100), allowNull: false },
    setting_value: { type: DataTypes.TEXT, allowNull: true },
    data_type: { 
      type: DataTypes.ENUM("string", "integer", "boolean", "json"), 
      allowNull: false, 
      defaultValue: "string" 
    },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "CompanySetting",
    tableName: "company_settings",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["company_id", "setting_key"], unique: true },
      { fields: ["company_id"] },
    ],
  }
);

module.exports = CompanySetting;
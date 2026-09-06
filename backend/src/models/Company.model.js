// models/Company.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Company extends Model {}

Company.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
    state: { type: DataTypes.STRING(100), allowNull: true },
    pincode: { type: DataTypes.STRING(20), allowNull: true },
    gst_number: { type: DataTypes.STRING(50), allowNull: true },
    pan_number: { type: DataTypes.STRING(50), allowNull: true },
    pf_code: { type: DataTypes.STRING(50), allowNull: true },
    esic_code: { type: DataTypes.STRING(50), allowNull: true },
    logo: { type: DataTypes.STRING(255), allowNull: true },
    website: { type: DataTypes.STRING(255), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Company",
    tableName: "companies",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["code"] },
      { fields: ["email"] },
      { fields: ["is_active"] },
    ],
  }
);

module.exports = Company;
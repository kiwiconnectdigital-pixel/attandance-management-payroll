// models/Branch.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Branch extends Model {}

Branch.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    company_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "companies", key: "id" } 
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false },
    address: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
    state: { type: DataTypes.STRING(100), allowNull: true },
    pincode: { type: DataTypes.STRING(20), allowNull: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    manager_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "employees", key: "id" } 
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    // Geofence settings
    geofence_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    geofence_latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    geofence_longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    geofence_radius_meters: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    geofence_address: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Branch",
    tableName: "branches",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["company_id", "code"], unique: true },
      { fields: ["company_id"] },
      { fields: ["is_active"] },
    ],
  }
);

module.exports = Branch;
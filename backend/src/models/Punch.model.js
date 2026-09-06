// models/Punch.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Punch extends Model {}

Punch.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    attendance_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "attendance", key: "id" } 
    },
    type: { 
      type: DataTypes.ENUM("check_in", "check_out"), 
      allowNull: false 
    },
    time: { type: DataTypes.DATE, allowNull: false },
    selfie: { type: DataTypes.STRING(255), allowNull: true },
    branch_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "branches", key: "id" } 
    },
    latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    face_match_score: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
    face_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_late: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    late_by_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Punch",
    tableName: "punches",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["attendance_id"] },
      { fields: ["type", "time"] },
    ],
  }
);

module.exports = Punch;
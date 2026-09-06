// models/Notification.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    company_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "companies", key: "id" } 
    },
    user_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: "users", key: "id" } 
    },
    type: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    link: { type: DataTypes.STRING(500), allowNull: true },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    read_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Notification",
    tableName: "notifications",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["is_read"] },
      { fields: ["created_at"] },
    ],
  }
);

module.exports = Notification;
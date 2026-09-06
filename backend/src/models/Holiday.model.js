// models/Holiday.model.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Holiday extends Model {}

Holiday.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    company_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "companies", key: "id" } 
    },
    branch_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: "branches", key: "id" } 
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    type: { 
      type: DataTypes.ENUM("national", "regional", "optional", "company"), 
      allowNull: false, 
      defaultValue: "national" 
    },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_weekday: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    year: { type: DataTypes.INTEGER, allowNull: true },
    month: { type: DataTypes.INTEGER, allowNull: true },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
    is_deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Holiday",
    tableName: "holidays",
    timestamps: true,
    underscored: true,
    paranoid: false,
    hooks: {
      beforeCreate: (holiday) => {
        if (holiday.date) {
          const date = new Date(holiday.date);
          holiday.year = date.getFullYear();
          holiday.month = date.getMonth() + 1;
          const day = date.getDay();
          holiday.is_weekday = (day !== 0 && day !== 6);
        }
      },
      beforeUpdate: (holiday) => {
        if (holiday.changed("date") && holiday.date) {
          const date = new Date(holiday.date);
          holiday.year = date.getFullYear();
          holiday.month = date.getMonth() + 1;
          const day = date.getDay();
          holiday.is_weekday = (day !== 0 && day !== 6);
        }
      },
    },
    indexes: [
      { fields: ["company_id", "branch_id", "date"], unique: true },
      { fields: ["company_id"] },
      { fields: ["branch_id"] },
      { fields: ["date"] },
      { fields: ["year", "month"] },
    ],
  }
);

module.exports = Holiday;
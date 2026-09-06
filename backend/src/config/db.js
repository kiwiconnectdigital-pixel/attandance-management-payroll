// config/db.js - Sequelize Configuration
const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "attendance_payroll",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "Aman@123456",
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      charset: "utf8mb4",
      collate: "utf8mb4_unicode_ci",
      underscored: true,
      timestamps: true,
      paranoid: false,
    },
    timezone: "+05:30",
  }
);

module.exports = sequelize;
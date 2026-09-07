const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class AttendanceLocationLog extends Model {}

AttendanceLocationLog.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    attendance_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "attendance", key: "id" },
    },
    employee_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "employees", key: "id" },
    },
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
    address: { type: DataTypes.STRING, allowNull: true },
    accuracy_meters: { type: DataTypes.FLOAT, allowNull: true },
    // 'checkin' | 'checkout' | 'periodic'
    source: {
      type: DataTypes.ENUM("checkin", "checkout", "periodic"),
      allowNull: false,
      defaultValue: "periodic",
    },
    recorded_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: "AttendanceLocationLog",
    tableName: "attendance_location_logs",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["attendance_id"] },
      { fields: ["employee_id"] },
      { fields: ["recorded_at"] },
    ],
  }
);

module.exports = AttendanceLocationLog;
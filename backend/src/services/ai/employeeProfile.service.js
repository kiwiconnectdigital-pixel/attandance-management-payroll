const {
  Attendance,
  AttendanceLocationLog,
  EmployeeDevice,
  Employee
} = require("../../models");

const { Op } = require("sequelize");

const buildEmployeeProfile = async (
  employeeId
) => {

  const employee = await Employee.findByPk(
    employeeId
  );

  if (!employee) {
    throw new Error("Employee not found");
  }

  const fromDate = new Date();

  fromDate.setDate(
    fromDate.getDate() - 30
  );

  const attendance =
    await Attendance.findAll({
      where: {
        employee_id: employeeId,

        created_at: {
          [Op.gte]: fromDate
        }
      },

      order: [
        ["created_at", "ASC"]
      ]
    });

  const locations =
    await AttendanceLocationLog.findAll({
      where: {
        employee_id: employeeId,

        recorded_at: {
          [Op.gte]: fromDate
        }
      },

      order: [
        ["recorded_at", "ASC"]
      ]
    });

  const devices =
    await EmployeeDevice.findAll({
      where: {
        employee_id: employeeId
      }
    });

  return {
    employee: {
      id: employee.id,
      name: employee.name,
      department: employee.department,
      designation: employee.designation
    },

    attendance: attendance.map(
      (a) => ({
        date: a.created_at,
        checkIn: a.check_in,
        checkOut: a.check_out,
        status: a.status,
        lateMinutes: a.late_minutes,
        overtimeMinutes:
          a.overtime_minutes
      })
    ),

    locations: locations.map(
      (location) => ({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy:
          location.accuracy_meters,
        recordedAt:
          location.recorded_at,
        source: location.source
      })
    ),

    devices: devices.map(
      (device) => ({
        deviceId: device.device_id,
        model: device.device_model,
        os: device.os
      })
    )
  };
};

module.exports = {
  buildEmployeeProfile
};
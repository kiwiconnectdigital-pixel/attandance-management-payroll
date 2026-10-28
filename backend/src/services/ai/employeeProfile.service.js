const {
  Attendance,
  AttendanceLocationLog,
  EmployeeDevice,
  Employee,
  Punch,
} = require("../../models");

const { Op } = require("sequelize");
const moment = require("moment-timezone");

const TZ = "Asia/Kolkata";

// device ids that every browser / unknown client may share are not evidence
const GENERIC_DEVICE = /^(unknown|web|browser|null|undefined|none|)$/i;

const findSharedDevices = async (employee, devices) => {
  const deviceIds = [
    ...new Set(
      devices
        .map((device) => String(device.device_id || "").trim())
        .filter((id) => id && !GENERIC_DEVICE.test(id)),
    ),
  ];

  if (!deviceIds.length) return [];

  const sameDevice = await EmployeeDevice.findAll({
    where: {
      device_id: { [Op.in]: deviceIds },
      employee_id: { [Op.ne]: employee.id },
      company_id: employee.company_id,
    },
  });

  if (!sameDevice.length) return [];

  const otherIds = [...new Set(sameDevice.map((row) => row.employee_id))];

  const others = await Employee.findAll({
    where: { id: { [Op.in]: otherIds } },
    attributes: ["id", "name"],
  });

  const nameById = new Map(others.map((other) => [other.id, other.name]));

  return deviceIds
    .map((deviceId) => {
      const rows = sameDevice.filter((row) => row.device_id === deviceId);
      const own = devices.find((device) => device.device_id === deviceId);

      return {
        deviceId,
        deviceModel: own?.device_model || null,
        otherEmployees: [
          ...new Set(
            rows.map((row) => nameById.get(row.employee_id) || "Another employee"),
          ),
        ],
      };
    })
    .filter((device) => device.otherEmployees.length);
};

/**
 * Collects the real attendance data the risk engine needs for one employee.
 *   days  how many days back to look (default 30, max 180)
 */
const buildEmployeeProfile = async (employeeId, { days = 30 } = {}) => {
  const windowDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 180);

  const employee = await Employee.findByPk(employeeId);

  if (!employee) {
    throw new Error("Employee not found");
  }

  const today = moment().tz(TZ);
  const endDate = today.format("YYYY-MM-DD");
  const startDate = today
    .clone()
    .subtract(windowDays - 1, "days")
    .format("YYYY-MM-DD");

  const rangeStart = moment.tz(startDate, TZ).toDate();

  const attendance = await Attendance.findAll({
    where: {
      employee_id: employeeId,
      is_deleted: false,
      date: { [Op.between]: [startDate, endDate] },
    },
    order: [["date", "ASC"]],
  });

  const attendanceIds = attendance.map((record) => record.id);

  const punches = attendanceIds.length
    ? await Punch.findAll({
        where: {
          attendance_id: { [Op.in]: attendanceIds },
          is_deleted: false,
        },
        order: [["time", "ASC"]],
      })
    : [];

  const locations = await AttendanceLocationLog.findAll({
    where: {
      employee_id: employeeId,
      recorded_at: { [Op.gte]: rangeStart },
    },
    order: [["recorded_at", "ASC"]],
    limit: 5000,
  });

  const devices = await EmployeeDevice.findAll({
    where: { employee_id: employeeId },
  });

  const sharedDevices = await findSharedDevices(employee, devices);

  const punchesByAttendance = new Map();

  punches.forEach((punch) => {
    if (!punchesByAttendance.has(punch.attendance_id)) {
      punchesByAttendance.set(punch.attendance_id, []);
    }

    punchesByAttendance.get(punch.attendance_id).push({
      type: punch.type,
      time: punch.time,
      latitude: punch.latitude === null ? null : Number(punch.latitude),
      longitude: punch.longitude === null ? null : Number(punch.longitude),
      faceVerified: Boolean(punch.face_verified),
      // punches typed in by an admin are saved with this address
      manual: String(punch.address || "").trim() === "Manually added",
      autoCheckout: Boolean(punch.is_auto_checkout),
    });
  });

  return {
    windowDays,
    startDate,
    endDate,

    employee: {
      id: employee.id,
      companyId: employee.company_id,
      name: employee.name,
      department: employee.department,
      designation: employee.designation,
    },

    attendance: attendance.map((record) => ({
      id: record.id,
      date: record.date,
      status: record.status,
      isLate: Boolean(record.is_late),
      lateMinutes: Number(record.late_by_minutes || 0),
      workingHours: Number(record.working_hours || 0),
      overtimeHours: Number(record.overtime_hours || 0),
      punches: punchesByAttendance.get(record.id) || [],
    })),

    locations: locations.map((location) => ({
      attendanceId: location.attendance_id,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      accuracy: location.accuracy_meters,
      recordedAt: location.recorded_at,
      source: location.source,
    })),

    sharedDevices,
  };
};

module.exports = {
  buildEmployeeProfile,
};
const cron = require("node-cron");
const moment = require("moment-timezone");
const { Op } = require("sequelize");

const {
  Attendance,
  Punch,
  Employee,
  Company,
} = require("../models");

const {
  calculateWorkingHoursFromPunches,
  determineStatus,
} = require("./attendance.service");

const DEFAULT_WORK_END_HOUR = 18;
const DEFAULT_WORK_END_MINUTE = 30;

/**
 * Finds every attendance record (from any day before today) that still has
 * more check-ins than check-outs, but only for companies that have
 * auto_checkout_enabled = true. For each one, inserts a system-generated
 * check_out punch and recalculates working hours / status.
 */
const runAutoCheckout = async () => {
  const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

  const staleAttendance = await Attendance.findAll({
    where: {
      date: { [Op.lt]: today },
      is_deleted: false,
    },
    include: [
      {
        model: Employee,
        as: "employee",
        required: true,
        include: [
          {
            model: Company,
            as: "company",
            required: true,
            where: { auto_checkout_enabled: true },
          },
        ],
      },
    ],
  });

  let checkedOutCount = 0;

  for (const attendance of staleAttendance) {
    const checkInCount = await Punch.count({
      where: { attendance_id: attendance.id, type: "check_in" },
    });
    const checkOutCount = await Punch.count({
      where: { attendance_id: attendance.id, type: "check_out" },
    });

    if (checkInCount === 0 || checkOutCount >= checkInCount) continue;

    const autoCheckoutTime = moment
      .tz(attendance.date, "YYYY-MM-DD", "Asia/Kolkata")
      .hour(DEFAULT_WORK_END_HOUR)
      .minute(DEFAULT_WORK_END_MINUTE)
      .second(0)
      .millisecond(0);

    await Punch.create({
      attendance_id: attendance.id,
      type: "check_out",
      time: autoCheckoutTime.toDate(),
      selfie: null,
      branch_id: null,
      latitude: null,
      longitude: null,
      address: "Auto checked-out by system",
      face_verified: false,
    });

    const punches = await Punch.findAll({
      where: { attendance_id: attendance.id },
      order: [["time", "ASC"]],
    });

    const checkIns = punches.filter((p) => p.type === "check_in");
    const checkOuts = punches.filter((p) => p.type === "check_out");

    const { workingHours, overtimeHours } = calculateWorkingHoursFromPunches(
      checkIns,
      checkOuts,
    );

    const status = determineStatus(workingHours, attendance.late_by_minutes || 0);

    await attendance.update({
      working_hours: workingHours,
      overtime_hours: overtimeHours,
      status,
      remarks: attendance.remarks
        ? `${attendance.remarks}; Auto checked-out by system (missed checkout)`
        : "Auto checked-out by system (missed checkout)",
    });

    checkedOutCount += 1;
  }

  return checkedOutCount;
};

/**
 * Runs once every day, well before the 12:00 PM (noon) deadline, in the
 * Asia/Kolkata timezone. Only affects companies with auto_checkout_enabled.
 */
const startAutoCheckoutScheduler = () => {
  cron.schedule(
    "0 11 * * *",
    async () => {
      try {
        console.log(
          "Running auto-checkout job at:",
          moment().tz("Asia/Kolkata").format("DD MMM YYYY hh:mm:ss A"),
        );
        const count = await runAutoCheckout();
        console.log(`✅ Auto-checkout complete. ${count} record(s) closed out.`);
      } catch (error) {
        console.error("❌ Auto-checkout job failed:", error);
      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );
};

module.exports = {
  startAutoCheckoutScheduler,
  runAutoCheckout,
};
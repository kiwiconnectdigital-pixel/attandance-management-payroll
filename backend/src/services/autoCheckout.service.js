const cron = require("node-cron");
const moment = require("moment-timezone");
const { Op } = require("sequelize");

const {
  Attendance,
  Punch,
  Employee,
  Company,
  User,
  Notification,
} = require("../models");

const { emitToUser } = require("../socket");

const {
  calculateWorkingHoursFromPunches,
  determineStatus,
} = require("./attendance.service");

/**
 * Finds every attendance record for TODAY (or any earlier day that was
 * somehow missed, as a safety net) that still has more check-ins than
 * check-outs, but only for companies that have auto_checkout_enabled = true.
 * For each one, inserts a system-generated check_out punch timestamped at
 * 23:59:00 on that same day, flags it as auto, and recalculates working
 * hours / status. This lets the employee check in fresh the next day.
 */
const runAutoCheckout = async () => {
  const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");

  const staleAttendance = await Attendance.findAll({
    where: {
      date: { [Op.lte]: today },
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
      .hour(23)
      .minute(59)
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
      is_auto_checkout: true,
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

    await notifyAdmins(attendance.employee, attendance.date);

    checkedOutCount += 1;
  }

  return checkedOutCount;
};

/**
 * Creates a notification (and pushes it live over Socket.IO) for every
 * company_admin of this employee's company who has opted in to
 * notifications. Silently does nothing if no admins have opted in.
 */
const notifyAdmins = async (employee, attendanceDate) => {
  const admins = await User.findAll({
    where: {
      company_id: employee.company_id,
      role: "company_admin",
      is_active: true,
      notifications_enabled: true,
    },
  });

  if (admins.length === 0) return;

  const dateLabel = moment(attendanceDate).format("DD MMM YYYY");

  for (const admin of admins) {
    const notification = await Notification.create({
      company_id: employee.company_id,
      user_id: admin.id,
      type: "auto_checkout",
      title: "Employee auto checked-out",
      message: `${employee.name} was automatically checked out on ${dateLabel} because they didn't check out themselves.`,
      link: "/reports",
    });

    emitToUser(admin.id, "notification:new", {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      is_read: false,
      created_at: notification.createdAt,
    });
  }
};

/**
 * Runs every day at 23:55 (Asia/Kolkata) -- shortly before the 23:59 cutoff
 * -- so any employee who forgot to check out gets closed out the same day
 * and can check in fresh tomorrow. Only affects companies with
 * auto_checkout_enabled turned on.
 */
const startAutoCheckoutScheduler = () => {
  cron.schedule(
    "55 23 * * *",
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
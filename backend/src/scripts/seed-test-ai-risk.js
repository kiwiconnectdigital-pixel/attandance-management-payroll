/**
 * LOCAL TEST ONLY - do NOT commit/push this file.
 *
 * Plants a clearly unusual month of attendance for ONE employee so you can
 * watch the AI Attendance Monitor pick it up:
 *   - 9 late arrivals
 *   - 4 days with 5 hours of overtime
 *   - one impossible GPS jump (Indore -> Bhopal in 5 minutes)
 *
 * Put this file in:  backend/src/scripts/seed-test-ai-risk.js
 *
 *   node src/scripts/seed-test-ai-risk.js <EMPLOYEE_CODE>             add the data
 *   node src/scripts/seed-test-ai-risk.js <EMPLOYEE_CODE> --cleanup   remove it again
 *
 * Then open the AI Attendance Monitor and press "Run AI analysis".
 * Real attendance is never touched: only days that have no record are filled,
 * and everything it adds is marked remarks = "TEST-SEED-AI".
 */

const moment = require("moment-timezone");
const {
  sequelize,
  Employee,
  Attendance,
  Punch,
  AttendanceLocationLog,
  AttendanceAiRisk,
} = require("../models");

const MARK = "TEST-SEED-AI";
const TZ = "Asia/Kolkata";

const [employeeCode] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const CLEANUP = process.argv.includes("--cleanup");

async function main() {
  if (!employeeCode) {
    console.log("Usage: node src/scripts/seed-test-ai-risk.js <EMPLOYEE_CODE> [--cleanup]");
    process.exit(1);
  }

  const employee = await Employee.findOne({ where: { employee_code: employeeCode } });

  if (!employee) {
    console.error(`No employee found with employee_code "${employeeCode}"`);
    process.exit(1);
  }

  const seeded = await Attendance.findAll({
    where: { employee_id: employee.id, remarks: MARK },
  });

  if (CLEANUP) {
    const ids = seeded.map((a) => a.id);

    if (ids.length) {
      await AttendanceLocationLog.destroy({ where: { attendance_id: ids } });
      await Punch.destroy({ where: { attendance_id: ids } });
      await Attendance.destroy({ where: { id: ids } });
    }

    const removedRisks = await AttendanceAiRisk.destroy({
      where: { employee_id: employee.id },
    });

    console.log(`Removed ${ids.length} test day(s) and ${removedRisks} AI alert(s) for ${employeeCode}.`);
    return;
  }

  if (seeded.length) {
    console.error("Test data already exists for this employee. Run with --cleanup first.");
    process.exit(1);
  }

  const today = moment().tz(TZ);
  let created = 0;
  let lastAttendance = null;

  for (let back = 1; back <= 24 && created < 20; back += 1) {
    const date = today.clone().subtract(back, "days");

    if (date.day() === 0) continue; // Sunday

    const dateText = date.format("YYYY-MM-DD");

    const existing = await Attendance.findOne({
      where: { employee_id: employee.id, date: dateText },
    });

    if (existing) continue;

    const late = created < 9;
    const overtime = created >= 9 && created < 13;
    const lateMinutes = late ? 30 + created * 3 : 0;

    const checkIn = date
      .clone()
      .hour(9)
      .minute(late ? 30 + lateMinutes % 25 : 5 + (created * 7) % 20)
      .second(0);

    const checkOut = date.clone().hour(overtime ? 23 : 18).minute(5).second(0);

    const attendance = await Attendance.create({
      employee_id: employee.id,
      date: dateText,
      status: "present",
      working_hours: overtime ? 13 : 8,
      overtime_hours: overtime ? 5 : 0,
      is_late: late,
      late_by_minutes: lateMinutes,
      remarks: MARK,
    });

    await Punch.bulkCreate([
      {
        attendance_id: attendance.id,
        type: "check_in",
        time: checkIn.toDate(),
        latitude: 22.745,
        longitude: 75.8968,
        address: "Seeded test data",
        face_verified: true,
        is_late: late,
        late_by_minutes: lateMinutes,
      },
      {
        attendance_id: attendance.id,
        type: "check_out",
        time: checkOut.toDate(),
        latitude: 22.745,
        longitude: 75.8968,
        address: "Seeded test data",
        face_verified: true,
      },
    ]);

    lastAttendance = { attendance, date };
    created += 1;
  }

  if (lastAttendance) {
    const base = lastAttendance.date.clone().hour(11).minute(0).second(0);

    await AttendanceLocationLog.bulkCreate([
      {
        attendance_id: lastAttendance.attendance.id,
        employee_id: employee.id,
        latitude: 22.7196,
        longitude: 75.8577,
        accuracy_meters: 20,
        source: "periodic",
        recorded_at: base.toDate(),
      },
      {
        attendance_id: lastAttendance.attendance.id,
        employee_id: employee.id,
        latitude: 23.2599,
        longitude: 77.4126,
        accuracy_meters: 20,
        source: "periodic",
        recorded_at: base.clone().add(5, "minutes").toDate(),
      },
    ]);
  }

  console.log(`Seeded ${created} day(s) for ${employee.name} (${employeeCode}).`);
  console.log('Now open the AI Attendance Monitor and press "Run AI analysis".');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
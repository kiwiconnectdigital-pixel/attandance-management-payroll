/**
 * LOCAL TEST ONLY - do NOT commit/push this file.
 *
 * Creates a fake attendance record + GPS location trail for one employee so
 * you can test Reports -> Employee Timeline without marking attendance.
 *
 * Put this file in:  backend/src/scripts/seed-test-trail.js
 *
 * Run from the backend folder:
 *   node src/scripts/seed-test-trail.js <EMPLOYEE_CODE> [YYYY-MM-DD]
 *   e.g. node src/scripts/seed-test-trail.js EMP-001-002
 *
 * Re-run on a date that already has seeded data:
 *   node src/scripts/seed-test-trail.js EMP-001-002 2026-10-09 --replace
 *
 * Remove the test data again:
 *   node src/scripts/seed-test-trail.js EMP-001-002 2026-10-09 --cleanup
 *
 * Date defaults to today (IST). Real attendance rows are never overwritten:
 * only rows whose remarks = "TEST-SEED" are replaced / cleaned up.
 */

const moment = require("moment-timezone");
const {
  sequelize,
  Employee,
  Attendance,
  AttendanceLocationLog,
} = require("../models");

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const [employeeCode, dateArg] = args.filter((a) => !a.startsWith("--"));

const REPLACE = flags.includes("--replace");
const CLEANUP = flags.includes("--cleanup");
const TZ = "Asia/Kolkata";

// Three places near Scheme 54, Indore (same area as your screenshot).
//  A -> B is ~115 m apart (should be 2 separate stops)
//  C is ~900 m away (should show a "Travel" row)
const PLACE_A = { lat: 22.745, lng: 75.89678 };
const PLACE_B = { lat: 22.74603, lng: 75.89702 };
const PLACE_C = { lat: 22.7525, lng: 75.8935 };

const jitter = (meters) => (Math.random() - 0.5) * 2 * (meters / 111000);

function pingsAround(place, startTime, count, stepSeconds, jitterMeters) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({
      latitude: place.lat + jitter(jitterMeters),
      longitude: place.lng + jitter(jitterMeters),
      accuracy_meters: Math.round(30 + Math.random() * 70), // 30-100 m
      source: "periodic",
      recorded_at: startTime.clone().add(i * stepSeconds, "seconds").toDate(),
    });
  }
  return rows;
}

async function main() {
  if (!employeeCode) {
    console.log(
      "Usage: node src/scripts/seed-test-trail.js <EMPLOYEE_CODE> [YYYY-MM-DD] [--replace|--cleanup]",
    );
    process.exit(1);
  }

  const date = dateArg || moment().tz(TZ).format("YYYY-MM-DD");

  const employee = await Employee.findOne({
    where: { employee_code: employeeCode },
  });
  if (!employee) {
    console.error(`No employee found with employee_code "${employeeCode}"`);
    process.exit(1);
  }

  let attendance = await Attendance.findOne({
    where: { employee_id: employee.id, date },
  });

  if (CLEANUP) {
    if (!attendance) {
      console.log("Nothing to clean up for that date.");
    } else if (attendance.remarks !== "TEST-SEED") {
      console.error(
        "That attendance row is real data (remarks is not TEST-SEED). Not touching it.",
      );
      process.exit(1);
    } else {
      await AttendanceLocationLog.destroy({
        where: { attendance_id: attendance.id },
      });
      await attendance.destroy();
      console.log(`Removed test data for ${employeeCode} on ${date}`);
    }
    return;
  }

  if (attendance && attendance.remarks !== "TEST-SEED") {
    console.error(
      `${employeeCode} already has REAL attendance on ${date}. Pick another date (or employee) so real data is not mixed with test pings.`,
    );
    process.exit(1);
  }

  if (attendance) {
    if (!REPLACE) {
      console.error(
        `Test data already exists for ${date}. Re-run with --replace to rebuild it.`,
      );
      process.exit(1);
    }
    await AttendanceLocationLog.destroy({
      where: { attendance_id: attendance.id },
    });
  } else {
    attendance = await Attendance.create({
      employee_id: employee.id,
      date,
      status: "present",
      working_hours: 1.5,
      remarks: "TEST-SEED",
    });
  }

  const t0 = moment.tz(`${date} 15:36:00`, "YYYY-MM-DD HH:mm:ss", TZ);

  const rows = [];

  // Check-in at place A
  rows.push({
    latitude: PLACE_A.lat,
    longitude: PLACE_A.lng,
    accuracy_meters: 60,
    source: "checkin",
    recorded_at: t0.toDate(),
  });

  // 8 minutes of noisy pings around A (GPS jitter ~60 m)
  rows.push(...pingsAround(PLACE_A, t0.clone().add(30, "seconds"), 16, 30, 60));

  // Stand at B (~115 m away) for 6 minutes
  rows.push(
    ...pingsAround(PLACE_B, t0.clone().add(9, "minutes"), 12, 30, 25),
  );

  // Walk/ride to C and stay 5 minutes
  rows.push(
    ...pingsAround(PLACE_C, t0.clone().add(20, "minutes"), 10, 30, 25),
  );

  // Check-out at C
  rows.push({
    latitude: PLACE_C.lat,
    longitude: PLACE_C.lng,
    accuracy_meters: 40,
    source: "checkout",
    recorded_at: t0.clone().add(26, "minutes").toDate(),
  });

  await AttendanceLocationLog.bulkCreate(
    rows.map((r) => ({
      ...r,
      attendance_id: attendance.id,
      employee_id: employee.id,
      address: null, // periodic pings have no address in real data either
    })),
  );

  console.log(
    `Seeded ${rows.length} location points for ${employee.name} (${employeeCode}) on ${date}.`,
  );
  console.log(
    "Now log in as admin/HR -> Reports -> Employee Movement/Timeline, pick this employee and date.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

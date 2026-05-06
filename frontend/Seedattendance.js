/**
 * seedAttendance.js
 * Seeds 30 days of attendance for a single employee.
 *
 * Usage:
 *   EMPLOYEE_ID=<id> MONTH=5 YEAR=2026 node seedAttendance.js
 *   -- or edit the defaults below --
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ── Inline schemas (no need to import from your app) ─────────────────────────
const punchSchema = new mongoose.Schema({
  time:           { type: Date,   required: true },
  selfie:         { type: String },
  location: {
    latitude:  { type: Number },
    longitude: { type: Number },
    address:   { type: String },
  },
  faceMatchScore: { type: Number },
  faceVerified:   { type: Boolean, default: false },
  isLate:         { type: Boolean, default: false },
  lateByMinutes:  { type: Number,  default: 0 },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  employee:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date:          { type: Date, required: true },
  checkIns:      [punchSchema],
  checkOuts:     [punchSchema],
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'on-leave', 'holiday', 'weekend'],
    default: 'absent',
  },
  workingHours:  { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  remarks:       { type: String },
}, { timestamps: true });

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

const Attendance = mongoose.models.Attendance
  || mongoose.model('Attendance', attendanceSchema);

// ── Config ────────────────────────────────────────────────────────────────────
const MONGO_URI   = process.env.MONGO_URI   || 'mongodb://localhost:27017/hrms';
const EMPLOYEE_ID = process.env.EMPLOYEE_ID || '665f1a2b3c4d5e6f7a8b9c0d'; // ← change default
const MONTH       = parseInt(process.env.MONTH || '5');   // 1-based
const YEAR        = parseInt(process.env.YEAR  || '2026');

// Office shift config
const SHIFT_START_HOUR   = 9;   // 9:00 AM
const SHIFT_START_MIN    = 0;
const LATE_GRACE_MINUTES = 15;  // grace period before marking late
const SHIFT_END_HOUR     = 18;  // 6:00 PM
const SHIFT_END_MIN      = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setTime(date, hour, minute, offsetMin = 0) {
  const d = new Date(date);
  d.setHours(hour, minute + offsetMin, rand(0, 59), 0);
  return d;
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate(); // month is 1-based
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sun or Sat
}

/**
 * Build a realistic punch-in record.
 * offsetMin: minutes after shift start (negative = early)
 */
function buildCheckIn(date, offsetMin) {
  const time         = setTime(date, SHIFT_START_HOUR, SHIFT_START_MIN, offsetMin);
  const lateBy       = Math.max(0, offsetMin - LATE_GRACE_MINUTES);
  const isLate       = lateBy > 0;

  return {
    time,
    selfie:         `selfie_in_${date.toISOString().slice(0, 10)}.jpg`,
    location: {
      latitude:  18.5204 + (Math.random() * 0.002 - 0.001),
      longitude: 73.8567 + (Math.random() * 0.002 - 0.001),
      address:   'Office Premises, Pune, Maharashtra',
    },
    faceMatchScore: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)),
    faceVerified:   true,
    isLate,
    lateByMinutes:  lateBy,
  };
}

/**
 * Build a realistic punch-out record.
 * offsetMin: minutes after shift end (negative = early)
 */
function buildCheckOut(date, offsetMin) {
  const time = setTime(date, SHIFT_END_HOUR, SHIFT_END_MIN, offsetMin);
  return {
    time,
    selfie:         `selfie_out_${date.toISOString().slice(0, 10)}.jpg`,
    location: {
      latitude:  18.5204 + (Math.random() * 0.002 - 0.001),
      longitude: 73.8567 + (Math.random() * 0.002 - 0.001),
      address:   'Office Premises, Pune, Maharashtra',
    },
    faceMatchScore: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)),
    faceVerified:   true,
    isLate:         false,
    lateByMinutes:  0,
  };
}

// ── Main seed logic ───────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log(`✅ Connected to MongoDB`);

  const totalDays = daysInMonth(MONTH, YEAR);
  console.log(`📅 Seeding attendance for ${YEAR}-${String(MONTH).padStart(2, '0')} (${totalDays} days)`);

  const records = [];

  for (let day = 1; day <= totalDays; day++) {
    // Month is 1-based; Date constructor month is 0-based
    const date = new Date(YEAR, MONTH - 1, day, 0, 0, 0, 0);

    // ── Weekend ──────────────────────────────────────────────────────────
    if (isWeekend(date)) {
      records.push({
        employee:      new mongoose.Types.ObjectId(EMPLOYEE_ID),
        date,
        checkIns:      [],
        checkOuts:     [],
        status:        'weekend',
        workingHours:  0,
        overtimeHours: 0,
        remarks:       'Weekend',
      });
      continue;
    }

    // ── Weighted day-type roll ───────────────────────────────────────────
    // present: ~70%, late-present: ~15%, half-day: ~5%, on-leave: ~7%, absent: ~3%
    const roll = rand(1, 100);

    if (roll <= 3) {
      // Absent
      records.push({
        employee:      new mongoose.Types.ObjectId(EMPLOYEE_ID),
        date,
        checkIns:      [],
        checkOuts:     [],
        status:        'absent',
        workingHours:  0,
        overtimeHours: 0,
        remarks:       'Unexplained absence',
      });
      continue;
    }

    if (roll <= 10) {
      // On leave
      records.push({
        employee:      new mongoose.Types.ObjectId(EMPLOYEE_ID),
        date,
        checkIns:      [],
        checkOuts:     [],
        status:        'on-leave',
        workingHours:  0,
        overtimeHours: 0,
        remarks:       'Approved leave',
      });
      continue;
    }

    if (roll <= 15) {
      // Half-day: comes in on time, leaves after ~4-4.5 hrs
      const inOffset  = rand(-10, 5);
      const checkIn   = buildCheckIn(date, inOffset);
      const outTime   = new Date(checkIn.time.getTime() + rand(4 * 60, 4.5 * 60) * 60000);
      const checkOut  = {
        time:           outTime,
        selfie:         `selfie_out_${date.toISOString().slice(0, 10)}.jpg`,
        location:       checkIn.location,
        faceMatchScore: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)),
        faceVerified:   true,
        isLate:         false,
        lateByMinutes:  0,
      };
      const workingHours = parseFloat(((outTime - checkIn.time) / 3600000).toFixed(2));

      records.push({
        employee:      new mongoose.Types.ObjectId(EMPLOYEE_ID),
        date,
        checkIns:      [checkIn],
        checkOuts:     [checkOut],
        status:        'half-day',
        workingHours,
        overtimeHours: 0,
        remarks:       'Half day',
      });
      continue;
    }

    // ── Full present day ─────────────────────────────────────────────────
    // Late arrivals for roll 16-30, on-time for 31+
    const isLateDay   = roll <= 30;
    const inOffset    = isLateDay ? rand(16, 60) : rand(-15, 15);
    const checkIn     = buildCheckIn(date, inOffset);

    // Checkout: sometimes overtime (5% chance)
    const hasOvertime = rand(1, 100) <= 5;
    const outOffset   = hasOvertime ? rand(60, 180) : rand(-10, 30);
    const checkOut    = buildCheckOut(date, outOffset);

    // Ensure checkout is always after checkin
    if (checkOut.time <= checkIn.time) {
      checkOut.time = new Date(checkIn.time.getTime() + 8 * 3600000);
    }

    const workingMs   = checkOut.time - checkIn.time;
    const workingHours = parseFloat((workingMs / 3600000).toFixed(2));
    const regularMs   = 9 * 3600000; // 9-hour standard shift
    const overtimeHours = workingMs > regularMs
      ? parseFloat(((workingMs - regularMs) / 3600000).toFixed(2))
      : 0;

    records.push({
      employee:      new mongoose.Types.ObjectId(EMPLOYEE_ID),
      date,
      checkIns:      [checkIn],
      checkOuts:     [checkOut],
      status:        'present',
      workingHours,
      overtimeHours,
      remarks:       isLateDay ? `Late by ${checkIn.lateByMinutes} min` : '',
    });
  }

  // Upsert all records (safe to re-run)
  let inserted = 0, updated = 0;
  for (const record of records) {
    const res = await Attendance.findOneAndUpdate(
      { employee: record.employee, date: record.date },
      record,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (res.createdAt?.getTime() === res.updatedAt?.getTime()) inserted++;
    else updated++;
  }

  // Summary
  const summary = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Seed summary:');
  Object.entries(summary).forEach(([status, count]) => {
    console.log(`   ${status.padEnd(12)} : ${count} days`);
  });
  console.log(`\n✅ Done — ${records.length} records (${inserted} inserted, ${updated} updated)`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
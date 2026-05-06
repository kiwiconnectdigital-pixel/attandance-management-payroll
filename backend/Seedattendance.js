/**
 * seedAttendance.js
 * Seeds 31 days of attendance for Aman Rajpoot (EMP012) — May 2026
 *
 * Test coverage:
 *   ✓ Half-days  → LOP deduction on payslip (days 14, 22, 29)
 *   ✓ Late ≥30m  → auto half-day status (days 5, 20) — tests attendance controller rule
 *   ✓ Late <30m  → still present (days 12, 27) — should NOT trigger half-day
 *   ✓ Absent     → LOP full day (day 21)
 *   ✓ On-leave   → paid, no LOP (days 2, 9)
 *   ✓ Overtime   → overtime pay (days 7, 28)
 *   ✓ Weekends   → skipped
 *
 * Usage:
 *   node seedAttendance.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ── Inline schemas ────────────────────────────────────────────────────────────
const punchSchema = new mongoose.Schema({
  time:           { type: Date,    required: true },
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
    type:    String,
    enum:    ['present', 'absent', 'half-day', 'on-leave', 'holiday', 'weekend'],
    default: 'absent',
  },
  isLate:        { type: Boolean, default: false },   // top-level late flag
  lateByMinutes: { type: Number,  default: 0 },       // top-level late minutes
  workingHours:  { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  remarks:       { type: String },
}, { timestamps: true });

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

const Attendance = mongoose.models.Attendance
  || mongoose.model('Attendance', attendanceSchema);

// ── Config ────────────────────────────────────────────────────────────────────
const MONGO_URI   = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
const EMPLOYEE_ID = '69da2eadf09b38ddc3915864';   // Aman Rajpoot _id
const MONTH       = 5;    // May
const YEAR        = 2026;

const SHIFT_START_HOUR = 9;
const SHIFT_START_MIN  = 0;
const LATE_GRACE_MIN   = 15;  // minutes of grace before marking late
const HALF_DAY_LATE_MIN = 30; // ≥30 min late → half-day (mirrors attendance.controller rule)
const SHIFT_END_HOUR   = 18;
const SHIFT_END_MIN    = 0;
const STD_SHIFT_HOURS  = 9;   // standard shift duration in hours

// ── Helpers ───────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function makeTime(baseDate, hour, minute, offsetMin = 0) {
  const d = new Date(baseDate);
  d.setHours(hour, minute + offsetMin, rand(0, 59), 0);
  return d;
}

function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function buildCheckIn(date, offsetMin) {
  const time   = makeTime(date, SHIFT_START_HOUR, SHIFT_START_MIN, offsetMin);
  const lateBy = Math.max(0, offsetMin - LATE_GRACE_MIN);
  return {
    time,
    selfie:         `selfie_in_EMP012_${date.toISOString().slice(0, 10)}.jpg`,
    location: {
      latitude:  22.7196 + (Math.random() * 0.002 - 0.001),
      longitude: 75.8577 + (Math.random() * 0.002 - 0.001),
      address:   'HR Office, Indore, Madhya Pradesh',
    },
    faceMatchScore: parseFloat((0.86 + Math.random() * 0.13).toFixed(2)),
    faceVerified:   true,
    isLate:         lateBy > 0,
    lateByMinutes:  lateBy,
  };
}

function buildCheckOut(date, offsetMin = 0) {
  return {
    time:           makeTime(date, SHIFT_END_HOUR, SHIFT_END_MIN, offsetMin),
    selfie:         `selfie_out_EMP012_${date.toISOString().slice(0, 10)}.jpg`,
    location: {
      latitude:  22.7196 + (Math.random() * 0.002 - 0.001),
      longitude: 75.8577 + (Math.random() * 0.002 - 0.001),
      address:   'HR Office, Indore, Madhya Pradesh',
    },
    faceMatchScore: parseFloat((0.86 + Math.random() * 0.13).toFixed(2)),
    faceVerified:   true,
    isLate:         false,
    lateByMinutes:  0,
  };
}

// ── Day plan ──────────────────────────────────────────────────────────────────
//
//  type          | lateOffset | what it tests
//  --------------|------------|----------------------------------------------
//  on-leave      |     —      | paid leave, payableDays += 1, no LOP
//  absent        |     —      | LOP full day
//  half-day      |     —      | manual half-day (left early), LOP 0.5 day
//  late-halfday  |   ≥30 min  | attendance controller auto-marks half-day
//  late          |   <30 min  | still present, no half-day penalty
//  overtime      |     —      | extra pay, no LOP
//  (default)     |     —      | normal present

const DAY_OVERRIDES = {
  // ── Leave (paid, no LOP) ──────────────────────────────────────────────────
  2:  { type: 'on-leave',     remarks: 'Approved casual leave' },
  9:  { type: 'on-leave',     remarks: 'Approved casual leave' },

  // ── Absent (LOP full day) ─────────────────────────────────────────────────
  21: { type: 'absent',       remarks: 'Unexplained absence' },

  // ── Manual half-days (left early — LOP 0.5×dailyRate each) ───────────────
  14: { type: 'half-day',     remarks: 'Half day — dentist appointment' },
  22: { type: 'half-day',     remarks: 'Half day — personal work' },
  29: { type: 'half-day',     remarks: 'Half day — early departure approved' },

  // ── Late ≥30 min → auto half-day (tests attendance.controller rule) ───────
  5:  { type: 'late-halfday', lateOffset: 35, remarks: 'Late 35 min → half-day' },
  20: { type: 'late-halfday', lateOffset: 48, remarks: 'Late 48 min → half-day' },

  // ── Late <30 min → present (grace period, NO half-day penalty) ───────────
  12: { type: 'late',         lateOffset: 22, remarks: 'Late 22 min (within threshold)' },
  27: { type: 'late',         lateOffset: 18, remarks: 'Late 18 min (within threshold)' },

  // ── Overtime (extra pay) ──────────────────────────────────────────────────
  7:  { type: 'overtime',     extraMin: 90,  remarks: 'Project deadline' },
  28: { type: 'overtime',     extraMin: 120, remarks: 'Month-end reporting' },
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const totalDays = new Date(YEAR, MONTH, 0).getDate(); // 31 for May
  const empId     = new mongoose.Types.ObjectId(EMPLOYEE_ID);
  console.log(`📅 Seeding May ${YEAR} for Aman Rajpoot (EMP012) — ${totalDays} days\n`);

  const records = [];

  for (let day = 1; day <= totalDays; day++) {
    const date     = new Date(YEAR, MONTH - 1, day, 0, 0, 0, 0);
    const override = DAY_OVERRIDES[day];

    // ── Weekend ──────────────────────────────────────────────────────────────
    if (isWeekend(date)) {
      records.push({
        employee: empId, date,
        checkIns: [], checkOuts: [],
        status: 'weekend', isLate: false, lateByMinutes: 0,
        workingHours: 0, overtimeHours: 0,
        remarks: date.getDay() === 6 ? 'Saturday' : 'Sunday',
      });
      continue;
    }

    // ── On-leave ─────────────────────────────────────────────────────────────
    if (override?.type === 'on-leave') {
      records.push({
        employee: empId, date,
        checkIns: [], checkOuts: [],
        status: 'on-leave', isLate: false, lateByMinutes: 0,
        workingHours: 0, overtimeHours: 0,
        remarks: override.remarks,
      });
      continue;
    }

    // ── Absent ───────────────────────────────────────────────────────────────
    if (override?.type === 'absent') {
      records.push({
        employee: empId, date,
        checkIns: [], checkOuts: [],
        status: 'absent', isLate: false, lateByMinutes: 0,
        workingHours: 0, overtimeHours: 0,
        remarks: override.remarks,
      });
      continue;
    }

    // ── Manual half-day (left early after ~4 hrs) ────────────────────────────
    if (override?.type === 'half-day') {
      const checkIn  = buildCheckIn(date, rand(-5, 5));
      const outTime  = new Date(checkIn.time.getTime() + rand(4 * 60, 4.5 * 60) * 60000);
      const checkOut = {
        time:           outTime,
        selfie:         `selfie_out_EMP012_${date.toISOString().slice(0, 10)}.jpg`,
        location:       checkIn.location,
        faceMatchScore: parseFloat((0.86 + Math.random() * 0.13).toFixed(2)),
        faceVerified:   true,
        isLate: false, lateByMinutes: 0,
      };
      records.push({
        employee: empId, date,
        checkIns: [checkIn], checkOuts: [checkOut],
        status:        'half-day',
        isLate:        false,
        lateByMinutes: 0,
        workingHours:  parseFloat(((outTime - checkIn.time) / 3600000).toFixed(2)),
        overtimeHours: 0,
        remarks:       override.remarks,
      });
      continue;
    }

    // ── Late ≥30 min → attendance controller marks as half-day ───────────────
    // Mirrors: const initialStatus = lateInfo.minutes >= 30 ? 'half-day' : 'present'
    if (override?.type === 'late-halfday') {
      const lateOffset = override.lateOffset;                     // e.g. 35
      const lateBy     = Math.max(0, lateOffset - LATE_GRACE_MIN); // 35-15=20 → stored
      const checkIn    = buildCheckIn(date, lateOffset);
      const checkOut   = buildCheckOut(date, rand(-10, 15));
      if (checkOut.time <= checkIn.time) {
        checkOut.time = new Date(checkIn.time.getTime() + 8 * 3600000);
      }
      const workMs = checkOut.time - checkIn.time;
      records.push({
        employee: empId, date,
        checkIns: [checkIn], checkOuts: [checkOut],
        // status is half-day because lateByMinutes >= 30 (threshold in controller)
        status:        'half-day',
        isLate:        true,
        lateByMinutes: lateBy,
        workingHours:  parseFloat((workMs / 3600000).toFixed(2)),
        overtimeHours: 0,
        remarks:       override.remarks,
      });
      continue;
    }

    // ── Late <30 min → present (grace threshold not exceeded) ────────────────
    if (override?.type === 'late') {
      const lateOffset = override.lateOffset;
      const lateBy     = Math.max(0, lateOffset - LATE_GRACE_MIN);
      const checkIn    = buildCheckIn(date, lateOffset);
      const checkOut   = buildCheckOut(date, rand(-10, 20));
      if (checkOut.time <= checkIn.time) {
        checkOut.time = new Date(checkIn.time.getTime() + 8 * 3600000);
      }
      const workMs = checkOut.time - checkIn.time;
      records.push({
        employee: empId, date,
        checkIns: [checkIn], checkOuts: [checkOut],
        status:        'present',   // lateBy < 30, so NOT half-day
        isLate:        lateBy > 0,
        lateByMinutes: lateBy,
        workingHours:  parseFloat((workMs / 3600000).toFixed(2)),
        overtimeHours: 0,
        remarks:       override.remarks,
      });
      continue;
    }

    // ── Overtime ──────────────────────────────────────────────────────────────
    if (override?.type === 'overtime') {
      const checkIn  = buildCheckIn(date, rand(-10, 5));
      const checkOut = buildCheckOut(date, override.extraMin);
      const workMs   = checkOut.time - checkIn.time;
      const stdMs    = STD_SHIFT_HOURS * 3600000;
      records.push({
        employee: empId, date,
        checkIns: [checkIn], checkOuts: [checkOut],
        status:        'present',
        isLate:        false,
        lateByMinutes: 0,
        workingHours:  parseFloat((workMs / 3600000).toFixed(2)),
        overtimeHours: parseFloat(Math.max(0, (workMs - stdMs) / 3600000).toFixed(2)),
        remarks:       override.remarks,
      });
      continue;
    }

    // ── Normal present ────────────────────────────────────────────────────────
    const inOffset = rand(-10, 10);
    const checkIn  = buildCheckIn(date, inOffset);
    const checkOut = buildCheckOut(date, rand(-5, 25));
    if (checkOut.time <= checkIn.time) {
      checkOut.time = new Date(checkIn.time.getTime() + STD_SHIFT_HOURS * 3600000);
    }
    const workMs = checkOut.time - checkIn.time;
    records.push({
      employee: empId, date,
      checkIns: [checkIn], checkOuts: [checkOut],
      status:        'present',
      isLate:        checkIn.isLate,
      lateByMinutes: checkIn.lateByMinutes,
      workingHours:  parseFloat((workMs / 3600000).toFixed(2)),
      overtimeHours: 0,
      remarks:       '',
    });
  }

  // ── Upsert ────────────────────────────────────────────────────────────────
  let inserted = 0, updated = 0;
  for (const rec of records) {
    const before = await Attendance.findOne({ employee: rec.employee, date: rec.date });
    await Attendance.findOneAndUpdate(
      { employee: rec.employee, date: rec.date },
      rec,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    before ? updated++ : inserted++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const byStatus = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const manualHalfDays  = records.filter(r => r.status === 'half-day' && !r.isLate).length;
  const autoHalfDays    = records.filter(r => r.status === 'half-day' &&  r.isLate).length;
  const latePresentDays = records.filter(r => r.status === 'present'  &&  r.isLate).length;
  const overtimeDays    = records.filter(r => r.overtimeHours > 0).length;

  // Mirror payroll.controller logic to show expected LOP
  const weekdays     = records.filter(r => r.status !== 'weekend').length;
  const presentCount = byStatus['present']  || 0;
  const halfCount    = byStatus['half-day'] || 0;
  const leaveCount   = byStatus['on-leave'] || 0;
  const absentCount  = byStatus['absent']   || 0;
  const payableDays  = presentCount + (halfCount * 0.5) + leaveCount;
  const lopDays      = weekdays - payableDays;

  console.log('📊 Seed summary — Aman Rajpoot (EMP012), May 2026');
  console.log('─'.repeat(44));
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status.padEnd(14)}: ${count} days`);
  });
  console.log('─'.repeat(44));
  console.log(`  Late arrivals : ${latePresentDays + autoHalfDays} days total`);
  console.log(`    → < 30 min  : ${latePresentDays} days (present)`);
  console.log(`    → ≥ 30 min  : ${autoHalfDays} days (auto half-day)`);
  console.log(`  Manual half   : ${manualHalfDays} days`);
  console.log(`  Overtime days : ${overtimeDays} days`);
  console.log('─'.repeat(44));
  console.log(`  Weekdays total: ${weekdays}`);
  console.log(`  Payable days  : ${payableDays}  (present + half×0.5 + leave)`);
  console.log(`  LOP days      : ${lopDays}  (weekdays − payable)`);
  console.log('─'.repeat(44));
  console.log(`\n✅ Done — ${records.length} records (${inserted} inserted, ${updated} updated)`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
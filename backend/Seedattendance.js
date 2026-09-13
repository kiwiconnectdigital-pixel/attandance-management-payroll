require('dotenv').config();
const mongoose = require('mongoose');

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
  isLate:        { type: Boolean, default: false },   
  lateByMinutes: { type: Number,  default: 0 },       
  workingHours:  { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  remarks:       { type: String },
}, { timestamps: true });

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

const Attendance = mongoose.models.Attendance
  || mongoose.model('Attendance', attendanceSchema);

const MONGO_URI   = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
const EMPLOYEE_ID = '69da2eadf09b38ddc3915864';   
const MONTH       = 5;   
const YEAR        = 2026;

const SHIFT_START_HOUR = 9;
const SHIFT_START_MIN  = 0;
const LATE_GRACE_MIN   = 15;  
const HALF_DAY_LATE_MIN = 30;
const SHIFT_END_HOUR   = 18;
const SHIFT_END_MIN    = 0;
const STD_SHIFT_HOURS  = 9;  

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

const DAY_OVERRIDES = {
  2:  { type: 'on-leave',     remarks: 'Approved casual leave' },
  9:  { type: 'on-leave',     remarks: 'Approved casual leave' },

  21: { type: 'absent',       remarks: 'Unexplained absence' },

  14: { type: 'half-day',     remarks: 'Half day — dentist appointment' },
  22: { type: 'half-day',     remarks: 'Half day — personal work' },
  29: { type: 'half-day',     remarks: 'Half day — early departure approved' },

  5:  { type: 'late-halfday', lateOffset: 35, remarks: 'Late 35 min → half-day' },
  20: { type: 'late-halfday', lateOffset: 48, remarks: 'Late 48 min → half-day' },

  12: { type: 'late',         lateOffset: 22, remarks: 'Late 22 min (within threshold)' },
  27: { type: 'late',         lateOffset: 18, remarks: 'Late 18 min (within threshold)' },

  7:  { type: 'overtime',     extraMin: 90,  remarks: 'Project deadline' },
  28: { type: 'overtime',     extraMin: 120, remarks: 'Month-end reporting' },
};

async function seed() {
  await mongoose.connect(MONGO_URI);

  const totalDays = new Date(YEAR, MONTH, 0).getDate(); 
  const empId     = new mongoose.Types.ObjectId(EMPLOYEE_ID);

  const records = [];

  for (let day = 1; day <= totalDays; day++) {
    const date     = new Date(YEAR, MONTH - 1, day, 0, 0, 0, 0);
    const override = DAY_OVERRIDES[day];

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

    if (override?.type === 'late-halfday') {
      const lateOffset = override.lateOffset;                     
      const lateBy     = Math.max(0, lateOffset - LATE_GRACE_MIN); 
      const checkIn    = buildCheckIn(date, lateOffset);
      const checkOut   = buildCheckOut(date, rand(-10, 15));
      if (checkOut.time <= checkIn.time) {
        checkOut.time = new Date(checkIn.time.getTime() + 8 * 3600000);
      }
      const workMs = checkOut.time - checkIn.time;
      records.push({
        employee: empId, date,
        checkIns: [checkIn], checkOuts: [checkOut],
        status:        'half-day',
        isLate:        true,
        lateByMinutes: lateBy,
        workingHours:  parseFloat((workMs / 3600000).toFixed(2)),
        overtimeHours: 0,
        remarks:       override.remarks,
      });
      continue;
    }

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
        status:        'present',  
        isLate:        lateBy > 0,
        lateByMinutes: lateBy,
        workingHours:  parseFloat((workMs / 3600000).toFixed(2)),
        overtimeHours: 0,
        remarks:       override.remarks,
      });
      continue;
    }

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

  const byStatus = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const manualHalfDays  = records.filter(r => r.status === 'half-day' && !r.isLate).length;
  const autoHalfDays    = records.filter(r => r.status === 'half-day' &&  r.isLate).length;
  const latePresentDays = records.filter(r => r.status === 'present'  &&  r.isLate).length;
  const overtimeDays    = records.filter(r => r.overtimeHours > 0).length;

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
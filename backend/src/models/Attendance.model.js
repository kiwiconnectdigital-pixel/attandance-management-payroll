const mongoose = require('mongoose');

const punchSchema = new mongoose.Schema({
  time: { type: Date, required: true },
  selfie: { type: String },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String },
  },
  faceMatchScore: { type: Number },
  faceVerified: { type: Boolean, default: false },
  // ✅ Move late info to per-punch level
  isLate: { type: Boolean, default: false },
  lateByMinutes: { type: Number, default: 0 },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  checkIns: [punchSchema],
  checkOuts: [punchSchema],
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'on-leave', 'holiday', 'weekend'],
    default: 'absent',
  },
  workingHours: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  // isLate: { type: Boolean, default: false },
  // lateByMinutes: { type: Number, default: 0 },
  remarks: { type: String },
}, { timestamps: true });

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
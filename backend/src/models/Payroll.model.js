const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true },  // 1–12
  year: { type: Number, required: true },

  // Earnings
  earnings: {
    basic: { type: Number, required: true },
    hra:   { type: Number, default: 0 },
    da:    { type: Number, default: 0 },
    ta:    { type: Number, default: 0 },       // Conveyance
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },       // used for Incentive
    other: { type: Number, default: 0 },
  },

  // Deductions
  deductions: {
    // pf:      { type: Number, default: 0 },   // 12% of basic  → Provident Fund
    esic:    { type: Number, default: 0 },   // 0.75% of gross → E.S.I.
    advance: { type: Number, default: 0 },   // NEW — Advance deduction
    pt:      { type: Number, default: 0 },   // Professional Tax (fixed slab)
    tds:     { type: Number, default: 0 },   // Tax deducted at source (kept for future)
    lop:     { type: Number, default: 0 },   // Loss of pay
    other:   { type: Number, default: 0 },
  },

  // Summary
  grossSalary:     { type: Number, required: true },
  totalDeductions: { type: Number, required: true },
  netSalary:       { type: Number, required: true },

  // Attendance summary for this month
  attendanceSummary: {
    totalWorkingDays: { type: Number },
    presentDays:      { type: Number },
    absentDays:       { type: Number },
    leaveDays:        { type: Number },
    overtimeHours:    { type: Number },
  },

  status: {
    type: String,
    enum: ['draft', 'processed', 'paid'],
    default: 'draft',
  },

  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedOn: { type: Date },
  paidOn:      { type: Date },
}, { timestamps: true });

// Unique payroll per employee per month/year
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
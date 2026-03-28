const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema({
  payroll: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  pdfPath: { type: String },              // Path to generated PDF file
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  generatedOn: { type: Date, default: Date.now },
  downloadCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Payslip', payslipSchema);
const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  leaveType: { type: String, enum: ['CL', 'SL', 'PL', 'HD'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalDays: { type: Number, required: true },
  reason: { type: String, required: true },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
  },
  // In your Leave.model.js, add:
halfDayOption: {
  type: String,
  enum: ['first_half', 'second_half'],
  required: function() { return this.leaveType === 'HD'; }
},
  appliedOn: { type: Date, default: Date.now },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedOn: { type: Date },
  reviewRemarks: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
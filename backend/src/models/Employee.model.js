const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, unique: true }, // Auto-generated: EMP001
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  department: { type: String, required: true },
  designation: { type: String, required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  dateOfJoining: { type: Date, required: true },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  address: { type: String },
  profileImage: { type: String,  required: true  }, // File path
  faceDescriptor: { type: [Number], default: null }, 
photo: { type: String },  // path to the reference photo
  // Salary structure
  salary: {
    basic: { type: Number, required: true },
    hra: { type: Number, default: 0 },         // House rent allowance
    da: { type: Number, default: 0 },           // Dearness allowance
    ta: { type: Number, default: 0 },           // Travel allowance
    other: { type: Number, default: 0 },
  },
  workStartTime: {
  hour: { type: Number, default: 9 },
  minute: { type: Number, default: 0 }
},
  lateThresholdMinutes: { type: Number, default: 0 },
  leaveBalance: {
    CL: { type: Number, default: 12 },  // Casual leave
    SL: { type: Number, default: 12 },  // Sick leave
    PL: { type: Number, default: 15 },  // Privilege leave
  },
  
  bankDetails: {
    accountNumber: { type: String },
    bankName: { type: String },
    ifscCode: { type: String },
  },
  
  panNumber: { type: String },
  aadharNumber: { type: String },
  pfNumber: { type: String },
  esicNumber: { type: String },
  
  isActive: { type: Boolean, default: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Auto-generate employee code
employeeSchema.pre('save', async function (next) {
  if (!this.employeeCode) {
    const count = await mongoose.model('Employee').countDocuments();
    this.employeeCode = `EMP${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Virtual for gross salary
employeeSchema.virtual('grossSalary').get(function () {
  const s = this.salary;
  return s.basic + s.hra + s.da + s.ta + s.other;
});

module.exports = mongoose.model('Employee', employeeSchema);
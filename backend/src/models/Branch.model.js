const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  code:    { type: String, required: true, unique: true },
  address: { type: String, required: true },
  city:    { type: String, required: true },
  state:   { type: String, required: true },
  pincode: { type: String },
  phone:   { type: String },
  email:   { type: String },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  isActive: { type: Boolean, default: true },

  // ── Geofence Settings ──────────────────────────────────────────────────
  geofence: {
    enabled: {
      type: Boolean,
      default: false, // set true to enforce location-based attendance
    },
    latitude: {
      type: Number,
      default: null,  // office center latitude
    },
    longitude: {
      type: Number,
      default: null,  // office center longitude
    },
    radiusMeters: {
      type: Number,
      default: 100,   // allowed radius in meters (100m default)
    },
    address: {
      type: String,
      default: '',    // human-readable office address for error messages
    },
  },
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);
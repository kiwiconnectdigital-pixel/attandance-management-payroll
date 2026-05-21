const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Holiday name is required"],
      trim: true,
    },

    date: {
      type: Date,
      required: [true, "Holiday date is required"],
      unique: true,
    },

    type: {
      type: String,
      enum: ["national", "regional", "optional", "company"],
      default: "national",
      // national  = Republic Day, Independence Day, Gandhi Jayanti etc.
      // regional  = State-specific holidays
      // optional  = Employee can choose (e.g. birthday leave)
      // company   = Company declared holiday
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    isWeekday: {
      type: Boolean,
      default: true,
      // Auto-set on save — true if Mon-Fri, false if Sat/Sun
      // Only weekday holidays affect working day count
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      // null = applies to ALL branches
      // set branch ID = applies to that branch only (regional holidays)
    },

    year: {
      type: Number,
      // Auto-set from date on save
    },

    month: {
      type: Number,
      // Auto-set from date on save (1–12)
    },
  },
  {
    timestamps: true,
  }
);

// ── Auto-compute isWeekday, year, month before saving ─────────────────────
holidaySchema.pre("save", function (next) {
  const dow = this.date.getDay(); // 0=Sun, 6=Sat
  this.isWeekday = dow !== 0 && dow !== 6;
  this.year      = this.date.getFullYear();
  this.month     = this.date.getMonth() + 1; // 1-indexed
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────
holidaySchema.index({ date: 1 });
holidaySchema.index({ year: 1, month: 1 });
holidaySchema.index({ branch: 1 });

const Holiday = mongoose.model("Holiday", holidaySchema);
module.exports = Holiday;

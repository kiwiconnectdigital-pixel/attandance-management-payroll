const Attendance = require("../models/Attendance.model");
const Employee = require("../models/Employee.model");
const {
  isLate,
  calculateWorkingHoursFromPunches,
} = require("../services/attendance.service");
const {
  getFaceDescriptor,
  compareDescriptors,
  MATCH_THRESHOLD,
} = require("../services/faceVerification.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const moment = require("moment");
const { checkGeofence } = require("../services/geofence.service");

module.exports = {
  checkIn: async (req, res, next) => {
    try {
      const { latitude, longitude, address } = req.body;

      const employee = await Employee.findOne({ user: req.user._id });
      if (!employee) throw new ApiError(404, "Employee record not found");

      if (!req.file) throw new ApiError(400, "Selfie is required for check-in");

      if (!employee.faceDescriptor || employee.faceDescriptor.length === 0) {
        throw new ApiError(
          400,
          "No reference face on file. Please contact HR to update your profile photo.",
        );
      }

      const selfieDescriptor = await getFaceDescriptor(req.file.path);
      if (!selfieDescriptor) {
        throw new ApiError(
          400,
          "No face detected in selfie. Please retake the photo.",
        );
      }

      const distance = compareDescriptors(
        employee.faceDescriptor,
        selfieDescriptor,
      );
      // if (distance >= MATCH_THRESHOLD) {
      //   throw new ApiError(
      //     401,
      //     `Face verification failed (score: ${distance.toFixed(3)}). Access denied.`,
      //   );
      // }

      if (!latitude || !longitude) {
        throw new ApiError(400, "Location (latitude & longitude) is required");
      }

      res.status(200).json({
        success: true,
        message: "Check-in successful",
        data: { latitude, longitude, address },
      });
    } catch (error) {
      console.error("Check-in Error:", error);

      if (next) return next(error);

      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  },

// @route POST /api/v1/attendance/checkout
 checkOut : async (req, res, next) => {
  try {
    const { latitude, longitude, address } = req.body;

    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) throw new ApiError(404, 'Employee record not found');

    const today = moment().startOf('day').toDate();
    const attendance = await Attendance.findOne({ employee: employee._id, date: today });

    if (!attendance || attendance.checkIns.length === 0)
      throw new ApiError(400, 'No check-in found for today');

    // Must have checked in more times than checked out
    if (attendance.checkOuts.length >= attendance.checkIns.length)
      throw new ApiError(400, 'Please check in before checking out again');

    // ── Face verification ──────────────────────────────────────────
    if (!req.file) throw new ApiError(400, 'Selfie is required for check-out');
    if (!employee.faceDescriptor || employee.faceDescriptor.length === 0)
      throw new ApiError(400, 'No reference face on file.');

    const selfiePath = req.file.path;
    const selfieDescriptor = await getFaceDescriptor(selfiePath);
    if (!selfieDescriptor) throw new ApiError(400, 'No face detected in selfie. Please retake the photo.');

    const distance = compareDescriptors(employee.faceDescriptor, selfieDescriptor);
    const faceVerified = distance < MATCH_THRESHOLD;

    if (!faceVerified) {
      throw new ApiError(401, `Face verification failed (score: ${distance.toFixed(3)}). Access denied.`);
    }
    // ──────────────────────────────────────────────────────────────
if (!latitude || !longitude) {
  throw new ApiError(400, 'Location (latitude & longitude) is required');
}

// Load branch geofence settings
const employeeWithBranch = await Employee.findById(employee._id).populate('branch');
if (employeeWithBranch?.branch) {
  const geo = checkGeofence(
    employeeWithBranch.branch,
    parseFloat(latitude),
    parseFloat(longitude)
  );
  if (!geo.allowed) throw new ApiError(403, geo.message);
}
    const checkOutTime = new Date();

    const punch = {
      time: checkOutTime,
      selfie: selfiePath,
      location: { latitude, longitude, address },
      faceMatchScore: parseFloat(distance.toFixed(4)),
      faceVerified: true,
    };

    attendance.checkOuts.push(punch);

    // Recalculate total working hours from all pairs
    const { workingHours, overtimeHours } = calculateWorkingHoursFromPunches(
      attendance.checkIns,
      attendance.checkOuts
    );
    attendance.workingHours = workingHours;
    attendance.overtimeHours = overtimeHours;

    await attendance.save();

    res.json(new ApiResponse(200, attendance,
      `Checked out at ${moment(checkOutTime).format('hh:mm A')}. Total: ${workingHours.toFixed(2)} hrs ✓ Face verified`
    ));
  } catch (error) {
    next(error);
  }
},
  // @route GET /api/v1/attendance  (unchanged logic, just uses new schema)
  getAttendance: async (req, res, next) => {
    try {
      const {
        employeeId,
        month,
        year,
        startDate,
        endDate,
        page = 1,
        limit = 31,
      } = req.query;
      const filter = {};

      if (employeeId) {
        filter.employee = employeeId;
      } else if (req.user.role === "employee") {
        const emp = await Employee.findOne({ user: req.user._id });
        if (emp) filter.employee = emp._id;
      }

      if (month && year) {
        filter.date = {
          $gte: moment(`${year}-${month}-01`).startOf("month").toDate(),
          $lte: moment(`${year}-${month}-01`).endOf("month").toDate(),
        };
      } else if (startDate && endDate) {
        filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      const skip = (page - 1) * limit;
      const [records, total] = await Promise.all([
        Attendance.find(filter)
          .populate("employee", "name employeeCode department")
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ date: -1 }),
        Attendance.countDocuments(filter),
      ]);

      res.json(new ApiResponse(200, { records, total }));
    } catch (error) {
      next(error);
    }
  },
  // @route GET /api/v1/attendance/today-summary  (unchanged)
  getTodaySummary: async (req, res, next) => {
    try {
      const today = moment().startOf("day").toDate();
      const tomorrow = moment().endOf("day").toDate();

      const [totalEmployees, presentToday, lateToday] = await Promise.all([
        Employee.countDocuments({ isActive: true }),
        Attendance.countDocuments({
          date: { $gte: today, $lte: tomorrow },
          status: "present",
        }),
        Attendance.countDocuments({
          date: { $gte: today, $lte: tomorrow },
          isLate: true,
        }),
      ]);

      res.json(
        new ApiResponse(200, {
          totalEmployees,
          presentToday,
          absentToday: totalEmployees - presentToday,
          lateToday,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
};

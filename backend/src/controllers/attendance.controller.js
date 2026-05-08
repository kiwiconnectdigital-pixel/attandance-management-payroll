const Attendance = require("../models/Attendance.model");
const Employee   = require("../models/Employee.model");
const Branch     = require("../models/Branch.model");
const {
  isLate,
  calculateWorkingHoursFromPunches,
  determineStatus,
} = require("../services/attendance.service");
const {
  getFaceDescriptor,
  compareDescriptors,
  MATCH_THRESHOLD,
} = require("../services/faceVerification.service");
const ApiResponse = require("../utils/ApiResponse");
const ApiError    = require("../utils/ApiError");
const moment      = require("moment");
const { checkGeofence } = require("../services/geofence.service");

module.exports = {

  // ─── CHECK IN ─────────────────────────────────────────────────────────────
  checkIn: async (req, res, next) => {
    try {
      const { latitude, longitude, address } = req.body;

      // ── Employee lookup ──────────────────────────────────────────────────
      const employee = await Employee.findOne({ user: req.user._id });
      if (!employee) throw new ApiError(404, 'Employee record not found');

      // ── Face verification ────────────────────────────────────────────────
      if (!req.file)
        throw new ApiError(400, 'Selfie is required for check-in');
      if (!employee.faceDescriptor || employee.faceDescriptor.length === 0)
        throw new ApiError(400, 'No reference face on file. Please contact HR to update your profile photo.');

      const selfieDescriptor = await getFaceDescriptor(req.file.path);
      if (!selfieDescriptor)
        throw new ApiError(400, 'No face detected in selfie. Please retake the photo.');

      const distance = compareDescriptors(employee.faceDescriptor, selfieDescriptor);
      if (distance >= MATCH_THRESHOLD)
        throw new ApiError(401, `Face verification failed (score: ${distance.toFixed(3)}). Access denied.`);

      // ── Location / geofence ──────────────────────────────────────────────
      if (!latitude || !longitude)
        throw new ApiError(400, 'Location (latitude & longitude) is required');

      const employeeWithBranch = await Employee.findById(employee._id).populate('branch');
      if (employeeWithBranch?.branch) {
        const geo = checkGeofence(
          employeeWithBranch.branch,
          parseFloat(latitude),
          parseFloat(longitude)
        );
        if (!geo.allowed) throw new ApiError(403, geo.message);
      }

      // ── Late calculation ─────────────────────────────────────────────────
      const checkInTime = moment().tz('Asia/Kolkata').toDate();
      const lateInfo = isLate(
        checkInTime,
        employee.workStartTime?.hour   ?? 9,
        employee.workStartTime?.minute ?? 0
      );

      // ── Build punch ──────────────────────────────────────────────────────
      const punch = {
        time:           checkInTime,
        selfie:         req.file.path.replace(/\\/g, '/'),
        location:       { latitude, longitude, address },
        faceMatchScore: parseFloat(distance.toFixed(4)),
        faceVerified:   true,
        isLate:         lateInfo.isLate,
        lateByMinutes:  lateInfo.minutes,
      };
console.log("Employee start time:", employee.workStartTime);
console.log("Check-in time (raw):", checkInTime);
      // ── Status for first punch ───────────────────────────────────────────
      // Working hours are 0 at check-in, so only the late rule can trigger half-day here.
      // The checkout handler will re-evaluate with actual hours.
      const initialStatus = lateInfo.minutes >= 30 ? 'half-day' : 'present';

      // ── Upsert attendance record ─────────────────────────────────────────
      const today = moment().startOf('day').toDate();
      let attendance = await Attendance.findOne({ employee: employee._id, date: today });

      if (!attendance) {
        attendance = await Attendance.create({
          employee:      employee._id,
          date:          today,
          status:        initialStatus,
          isLate:        lateInfo.isLate,
          lateByMinutes: lateInfo.minutes,
          checkIns:      [punch],
          checkOuts:     [],
        });
      } else {
        attendance.checkIns.push(punch);

        // Top-level late info and initial status only set from the FIRST punch
        if (attendance.checkIns.length === 1) {
          attendance.isLate        = lateInfo.isLate;
          attendance.lateByMinutes = lateInfo.minutes;
          attendance.status        = initialStatus;
        }

        await attendance.save();
      }

      const statusNote = lateInfo.isLate
        ? `Late by ${lateInfo.minutes}m${lateInfo.minutes >= 30 ? ' — marked half-day' : ''}`
        : 'On time';

      res.json(new ApiResponse(
        200,
        attendance,
        `Checked in at ${moment(checkInTime).format('hh:mm A')} ✓ ${statusNote}`
      ));
    } catch (error) {
      next(error);
    }
  },

  // ─── CHECK OUT ────────────────────────────────────────────────────────────
  checkOut: async (req, res, next) => {
    try {
      const { latitude, longitude, address, branchId } = req.body;

      // ── Employee lookup ──────────────────────────────────────────────────
      const employee = await Employee.findOne({ user: req.user._id });
      if (!employee) throw new ApiError(404, 'Employee record not found');

      // ── Attendance guard ─────────────────────────────────────────────────
      const today      = moment().startOf('day').toDate();
      const attendance = await Attendance.findOne({ employee: employee._id, date: today });

      if (!attendance || attendance.checkIns.length === 0)
        throw new ApiError(400, 'No check-in found for today');

      if (attendance.checkOuts.length >= attendance.checkIns.length)
        throw new ApiError(400, 'Please check in before checking out again');

      // ── Face verification ────────────────────────────────────────────────
      if (!req.file)
        throw new ApiError(400, 'Selfie is required for check-out');
      if (!employee.faceDescriptor || employee.faceDescriptor.length === 0)
        throw new ApiError(400, 'No reference face on file.');

      const selfieDescriptor = await getFaceDescriptor(req.file.path);
      if (!selfieDescriptor)
        throw new ApiError(400, 'No face detected in selfie. Please retake the photo.');

      const distance    = compareDescriptors(employee.faceDescriptor, selfieDescriptor);
      const faceVerified = distance < MATCH_THRESHOLD;
      if (!faceVerified)
        throw new ApiError(401, `Face verification failed (score: ${distance.toFixed(3)}). Access denied.`);

      // ── Location / geofence ──────────────────────────────────────────────
      if (!latitude || !longitude)
        throw new ApiError(400, 'Location (latitude & longitude) is required');

      if (!branchId)
        throw new ApiError(400, 'Please select a branch for check-out');

      const selectedBranch = await Branch.findById(branchId);
      if (!selectedBranch)  throw new ApiError(404, 'Selected branch not found');
      if (!selectedBranch.isActive) throw new ApiError(400, 'Selected branch is inactive');

      if (selectedBranch.geofence?.enabled) {
        const geo = checkGeofence(
          selectedBranch,
          parseFloat(latitude),
          parseFloat(longitude)
        );
        if (!geo.allowed) throw new ApiError(403, geo.message);
      }

      // ── Build punch ──────────────────────────────────────────────────────
      const checkOutTime = moment().tz('Asia/Kolkata').toDate();
      const punch = {
        time:           checkOutTime,
        selfie:         req.file.path.replace(/\\/g, '/'),
        location:       { latitude, longitude, address },
        faceMatchScore: parseFloat(distance.toFixed(4)),
        faceVerified:   true,
      };

      attendance.checkOuts.push(punch);

      // ── Recalculate hours ────────────────────────────────────────────────
      const { workingHours, overtimeHours } = calculateWorkingHoursFromPunches(
        attendance.checkIns,
        attendance.checkOuts
      );
      attendance.workingHours  = workingHours;
      attendance.overtimeHours = overtimeHours;

      // ── Re-evaluate status ───────────────────────────────────────────────
      // determineStatus checks BOTH rules:
      //   1. workingHours < 5  → half-day
      //   2. lateByMinutes >= 30 → half-day
      //   3. otherwise → present
      attendance.status = determineStatus(workingHours, attendance.lateByMinutes ?? 0);

      await attendance.save();

      const statusLabel = attendance.status === 'half-day' ? ' — marked half-day' : '';
      res.json(new ApiResponse(
        200,
        attendance,
        `Checked out at ${moment(checkOutTime).format('hh:mm A')}. ` +
        `Total: ${workingHours.toFixed(2)} hrs ✓ Face verified${statusLabel}`
      ));
    } catch (error) {
      next(error);
    }
  },

  // ─── GET ATTENDANCE (list) ─────────────────────────────────────────────────
  getAttendance: async (req, res, next) => {
    try {
      const {
        employeeId,
        month,
        year,
        startDate,
        endDate,
        page  = 1,
        limit = 31,
      } = req.query;

      const filter = {};

      if (employeeId) {
        filter.employee = employeeId;
      } else if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ user: req.user._id });
        if (emp) filter.employee = emp._id;
      }

      if (month && year) {
        filter.date = {
          $gte: moment(`${year}-${month}-01`).startOf('month').toDate(),
          $lte: moment(`${year}-${month}-01`).endOf('month').toDate(),
        };
      } else if (startDate && endDate) {
        filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      const skip = (page - 1) * limit;
      const [records, total] = await Promise.all([
        Attendance.find(filter)
          .populate('employee', 'name employeeCode department')
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

  // ─── TODAY'S SUMMARY ──────────────────────────────────────────────────────
  getTodaySummary: async (req, res, next) => {
    try {
      const today = moment().tz('Asia/Kolkata').startOf('day').toDate();
      const tomorrow = moment().endOf('day').toDate();

      const [totalEmployees, presentToday, lateToday, halfDayToday] = await Promise.all([
        Employee.countDocuments({ isActive: true }),
        Attendance.countDocuments({
          date:   { $gte: today, $lte: tomorrow },
          status: 'present',
        }),
        Attendance.countDocuments({
          date:   { $gte: today, $lte: tomorrow },
          isLate: true,
        }),
        Attendance.countDocuments({
          date:   { $gte: today, $lte: tomorrow },
          status: 'half-day',
        }),
      ]);

      res.json(new ApiResponse(200, {
        totalEmployees,
        presentToday,
        absentToday:  totalEmployees - presentToday,
        lateToday,
        halfDayToday,   // ← new field
      }));
    } catch (error) {
      next(error);
    }
  },

  // ─── GET BY ID ────────────────────────────────────────────────────────────
  getAttendanceById: async (req, res, next) => {
    try {
      const attendance = await Attendance.findById(req.params.id)
        .populate('employee', 'name employeeCode department designation');

      if (!attendance) throw new ApiError(404, 'Attendance record not found');

      if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ user: req.user._id });
        if (!emp || attendance.employee._id.toString() !== emp._id.toString())
          throw new ApiError(403, 'Access denied');
      }

      res.json(new ApiResponse(200, attendance));
    } catch (error) {
      next(error);
    }
  },
  // ─── ALL ATTENDANCE WITH SEARCH & FILTER ─────────────────────────────
getAllAttendanceDetailed: async (req, res, next) => {
  try {
    const {
      search,      // name or employeeCode
      month,
      year,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};
    let employeeFilter = {};

    // ── Search by name / employeeCode ─────────────────────────────
    if (search) {
      const employees = await Employee.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { employeeCode: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');

      const empIds = employees.map(e => e._id);
      filter.employee = { $in: empIds };
    }

    // ── Date filters ──────────────────────────────────────────────
    if (month && year) {
      filter.date = {
        $gte: moment(`${year}-${month}-01`).startOf('month').toDate(),
        $lte: moment(`${year}-${month}-01`).endOf('month').toDate(),
      };
    } else if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate('employee', 'name employeeCode department designation')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(filter),
    ]);

    // ── Format response (include selfies properly) ────────────────
    const formatted = records.map(record => ({
      _id: record._id,
      date: record.date,
      employee: record.employee,
      status: record.status,
      workingHours: record.workingHours,
      overtimeHours: record.overtimeHours,

      checkIns: record.checkIns.map(ci => ({
        time: ci.time,
        selfie: ci.selfie,
        location: ci.location,
        isLate: ci.isLate,
        lateByMinutes: ci.lateByMinutes,
      })),

      checkOuts: record.checkOuts.map(co => ({
        time: co.time,
        selfie: co.selfie,
        location: co.location,
      })),
    }));

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: formatted,
    });

  } catch (error) {
    next(error);
  }
},
// Add these methods to your attendance controller:
// ─── UPDATE ATTENDANCE ─────────────────────────────────────────────
updateAttendance: async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, workingHours, lateByMinutes, isLate, checkInTime, checkOutTime, remarks } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) throw new ApiError(404, 'Attendance record not found');

    // Update fields
    if (status) attendance.status = status;
    if (workingHours !== undefined) attendance.workingHours = workingHours;
    if (lateByMinutes !== undefined) attendance.lateByMinutes = lateByMinutes;
    if (isLate !== undefined) attendance.isLate = isLate;
    if (remarks) attendance.remarks = remarks;

    // Update check-in/out times if provided using moment
    if (checkInTime && attendance.checkIns.length > 0) {
      const [hours, minutes] = checkInTime.split(':');
      const checkInDateTime = moment(attendance.date)
        .hours(parseInt(hours))
        .minutes(parseInt(minutes))
        .seconds(0)
        .toDate();
      attendance.checkIns[0].time = checkInDateTime;
    }
    
    if (checkOutTime && attendance.checkOuts.length > 0) {
      const [hours, minutes] = checkOutTime.split(':');
      const checkOutDateTime = moment(attendance.date)
        .hours(parseInt(hours))
        .minutes(parseInt(minutes))
        .seconds(0)
        .toDate();
      attendance.checkOuts[0].time = checkOutDateTime;
    }

    await attendance.save();
    res.json(new ApiResponse(200, attendance, 'Attendance updated successfully'));
  } catch (error) {
    next(error);
  }
},

// ─── CREATE ATTENDANCE (MANUAL) ────────────────────────────────────
createAttendance: async (req, res, next) => {
  try {
    const { employeeId, date, status, workingHours, lateByMinutes, isLate, checkInTime, checkOutTime, remarks } = req.body;

    // Check if attendance already exists
    const existingAttendance = await Attendance.findOne({ 
      employee: employeeId, 
      date: new Date(date) 
    });
    
    if (existingAttendance) {
      throw new ApiError(400, 'Attendance already exists for this date');
    }

    // Create check-ins and check-outs arrays
    const checkIns = [];
    const checkOuts = [];

    if (checkInTime) {
      const [hours, minutes] = checkInTime.split(':');
      const checkInDateTime = moment(date)
        .hours(parseInt(hours))
        .minutes(parseInt(minutes))
        .seconds(0)
        .toDate();
      
      checkIns.push({
        time: checkInDateTime,
        location: { latitude: 0, longitude: 0, address: 'Manually added' },
        faceVerified: false,
        isLate: isLate || false,
        lateByMinutes: lateByMinutes || 0
      });
    }

    if (checkOutTime) {
      const [hours, minutes] = checkOutTime.split(':');
      const checkOutDateTime = moment(date)
        .hours(parseInt(hours))
        .minutes(parseInt(minutes))
        .seconds(0)
        .toDate();
      
      checkOuts.push({
        time: checkOutDateTime,
        location: { latitude: 0, longitude: 0, address: 'Manually added' },
        faceVerified: false
      });
    }

    const attendance = new Attendance({
      employee: employeeId,
      date: new Date(date),
      status: status || 'present',
      workingHours: workingHours || 0,
      lateByMinutes: lateByMinutes || 0,
      isLate: isLate || false,
      remarks: remarks || '',
      checkIns: checkIns,
      checkOuts: checkOuts
    });

    await attendance.save();
    res.json(new ApiResponse(201, attendance, 'Attendance created successfully'));
  } catch (error) {
    next(error);
  }
},

// ─── DELETE ATTENDANCE ─────────────────────────────────────────────
deleteAttendance: async (req, res, next) => {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findByIdAndDelete(id);
    if (!attendance) throw new ApiError(404, 'Attendance record not found');
    res.json(new ApiResponse(200, null, 'Attendance deleted successfully'));
  } catch (error) {
    next(error);
  }
},

// ─── BULK UPDATE ATTENDANCE ────────────────────────────────────────
bulkUpdateAttendance: async (req, res, next) => {
  try {
    const { employeeId, month, year, status } = req.body;
    
    const startDate = moment(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = moment(`${year}-${month}-01`).endOf('month').toDate();
    
    const attendances = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    });
    
    let updatedCount = 0;
    
    for (let attendance of attendances) {
      attendance.status = status;
      if (status === 'absent') {
        attendance.workingHours = 0;
        attendance.isLate = false;
        attendance.lateByMinutes = 0;
      } else if (status === 'half-day') {
        attendance.workingHours = 4;
        if (!attendance.workingHours || attendance.workingHours === 0) {
          attendance.workingHours = 4;
        }
      } else if (status === 'present') {
        if (!attendance.workingHours || attendance.workingHours === 0) {
          attendance.workingHours = 8;
        }
      }
      await attendance.save();
      updatedCount++;
    }
    
    res.json(new ApiResponse(200, null, `Bulk updated ${updatedCount} records to ${status}`));
  } catch (error) {
    next(error);
  }
},
};
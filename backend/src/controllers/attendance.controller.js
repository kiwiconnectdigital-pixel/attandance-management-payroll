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
const moment      = require("moment-timezone");
const { checkGeofence } = require("../services/geofence.service");

// Default work schedule: 9:30 AM to 6:30 PM IST
const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_START_MINUTE = 30;
const DEFAULT_WORK_END_HOUR = 18;
const DEFAULT_WORK_END_MINUTE = 30;

module.exports = {

  // ─── CHECK IN ─────────────────────────────────────────────────────────────
  checkIn: async (req, res, next) => {
  try {
    const { latitude, longitude, address, branchId } = req.body; // ← add branchId

    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) throw new ApiError(404, 'Employee record not found');

    // ── Face verification ──────────────────────────────────────────────
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

    // ── Location / geofence ────────────────────────────────────────────
    if (!latitude || !longitude)
      throw new ApiError(400, 'Location (latitude & longitude) is required');

    // Use selected branch instead of employee's default branch
    if (!branchId)
      throw new ApiError(400, 'Please select a branch for check-in');

    const selectedBranch = await Branch.findById(branchId);
    if (!selectedBranch)      throw new ApiError(404, 'Selected branch not found');
    if (!selectedBranch.isActive) throw new ApiError(400, 'Selected branch is inactive');

    if (selectedBranch.geofence?.enabled) {
      const geo = checkGeofence(
        selectedBranch,
        parseFloat(latitude),
        parseFloat(longitude)
      );
      if (!geo.allowed) throw new ApiError(403, geo.message);
    }

    // ── Late calculation ───────────────────────────────────────────────
    const checkInTime     = moment().tz('Asia/Kolkata');
    const workStartHour   = employee.workStartTime?.hour   ?? DEFAULT_WORK_START_HOUR;
    const workStartMinute = employee.workStartTime?.minute ?? DEFAULT_WORK_START_MINUTE;

   const lateThreshold = employee.lateThresholdMinutes ?? 0;
const lateInfo = isLate(checkInTime.toDate(), workStartHour, workStartMinute, lateThreshold);

    console.log("Work start time:", `${workStartHour}:${workStartMinute}`);
    console.log("Check-in time:", checkInTime.format('HH:mm:ss'));

    // ── Build punch ────────────────────────────────────────────────────
    const punch = {
      time:           checkInTime.toDate(),
      selfie:         req.file.path.replace(/\\/g, '/'),
      branch:         selectedBranch._id,     // ← selected branch, not employee's default
      location:       { latitude, longitude, address },
      faceMatchScore: parseFloat(distance.toFixed(4)),
      faceVerified:   true,
      isLate:         lateInfo.isLate,
      lateByMinutes:  lateInfo.minutes,
    };

    const initialStatus = lateInfo.minutes >= 30 ? 'half-day' : 'present';

    // ── Upsert attendance record ───────────────────────────────────────
    const today = moment().tz('Asia/Kolkata').startOf('day').toDate();
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
      `Checked in at ${checkInTime.format('hh:mm A')} ✓ ${statusNote}`
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
    const today      = moment().tz('Asia/Kolkata').startOf('day').toDate();
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

    const distance     = compareDescriptors(employee.faceDescriptor, selfieDescriptor);
    const faceVerified = distance < MATCH_THRESHOLD;
    if (!faceVerified)
      throw new ApiError(401, `Face verification failed (score: ${distance.toFixed(3)}). Access denied.`);

    // ── Location / geofence ──────────────────────────────────────────────
    if (!latitude || !longitude)
      throw new ApiError(400, 'Location (latitude & longitude) is required');

    if (!branchId)
      throw new ApiError(400, 'Please select a branch for check-out');

    const selectedBranch = await Branch.findById(branchId);
    if (!selectedBranch)       throw new ApiError(404, 'Selected branch not found');
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
    const checkOutTime = moment().tz('Asia/Kolkata');
    const punch = {
      time:           checkOutTime.toDate(),
      branch:         selectedBranch._id,
      selfie:         req.file.path.replace(/\\/g, '/'),
      location:       { latitude, longitude, address },
      faceMatchScore: parseFloat(distance.toFixed(4)),
      faceVerified:   true,
    };

    attendance.checkOuts.push(punch);

    // ── Recalculate hours using employee's personal schedule ─────────────
    const workStartHour   = employee.workStartTime?.hour   ?? DEFAULT_WORK_START_HOUR;
    const workStartMinute = employee.workStartTime?.minute ?? DEFAULT_WORK_START_MINUTE;

    console.log("Employee work start time:", `${workStartHour}:${workStartMinute}`);
    console.log("Check-out time:", checkOutTime.format('HH:mm:ss'));

    const { workingHours, overtimeHours } = calculateWorkingHoursFromPunches(
      attendance.checkIns,
      attendance.checkOuts,
      workStartHour,          // ← employee's personal start time
      workStartMinute,        // ← employee's personal start time
      DEFAULT_WORK_END_HOUR,
      DEFAULT_WORK_END_MINUTE
    );

    attendance.workingHours  = workingHours;
    attendance.overtimeHours = overtimeHours;

    // ── Re-evaluate status ───────────────────────────────────────────────
    attendance.status = determineStatus(workingHours, attendance.lateByMinutes ?? 0);

    await attendance.save();

    const statusLabel = attendance.status === 'half-day' ? ' — marked half-day' : '';
    res.json(new ApiResponse(
      200,
      attendance,
      `Checked out at ${checkOutTime.format('hh:mm A')}. ` +
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
          $gte: moment.tz(`${year}-${month}-01`, 'Asia/Kolkata').startOf('month').toDate(),
          $lte: moment.tz(`${year}-${month}-01`, 'Asia/Kolkata').endOf('month').toDate(),
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
      const tomorrow = moment().tz('Asia/Kolkata').endOf('day').toDate();

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
        halfDayToday,
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
        search,
        month,
        year,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      const filter = {};

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
          $gte: moment.tz(`${year}-${month}-01`, 'Asia/Kolkata').startOf('month').toDate(),
          $lte: moment.tz(`${year}-${month}-01`, 'Asia/Kolkata').endOf('month').toDate(),
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

      // ── Format response ────────────────────────────────
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

  // ─── UPDATE ATTENDANCE ─────────────────────────────────────────────
 updateAttendance: async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, workingHours, lateByMinutes, isLate, checkInTime, checkOutTime, remarks } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) throw new ApiError(404, 'Attendance record not found');

    // Fetch employee for their personal work schedule
    const employee = await Employee.findById(attendance.employee);

    if (status)                        attendance.status        = status;
    if (workingHours !== undefined)    attendance.workingHours  = workingHours;
    if (lateByMinutes !== undefined)   attendance.lateByMinutes = lateByMinutes;
    if (isLate !== undefined)          attendance.isLate        = isLate;
    if (remarks)                       attendance.remarks       = remarks;

    if (checkInTime && attendance.checkIns.length > 0) {
      const [hours, minutes] = checkInTime.split(':');
      attendance.checkIns[0].time = moment.tz(attendance.date, 'Asia/Kolkata')
        .hours(parseInt(hours)).minutes(parseInt(minutes)).seconds(0).toDate();

      // Recalculate late status using employee's personal start time
      const workStartHour   = employee?.workStartTime?.hour   ?? DEFAULT_WORK_START_HOUR;
      const workStartMinute = employee?.workStartTime?.minute ?? DEFAULT_WORK_START_MINUTE;
      const lateThreshold = employee?.lateThresholdMinutes ?? 0;
const lateInfo = isLate(attendance.checkIns[0].time, workStartHour, workStartMinute, lateThreshold);
      attendance.isLate        = lateInfo.isLate;
      attendance.lateByMinutes = lateInfo.minutes;
      attendance.checkIns[0].isLate        = lateInfo.isLate;
      attendance.checkIns[0].lateByMinutes = lateInfo.minutes;
    }

    if (checkOutTime && attendance.checkOuts.length > 0) {
      const [hours, minutes] = checkOutTime.split(':');
      attendance.checkOuts[0].time = moment.tz(attendance.date, 'Asia/Kolkata')
        .hours(parseInt(hours)).minutes(parseInt(minutes)).seconds(0).toDate();
    }

    // Recalculate working hours if either time was updated
    if ((checkInTime || checkOutTime) && attendance.checkIns.length > 0 && attendance.checkOuts.length > 0) {
      const workStartHour   = employee?.workStartTime?.hour   ?? DEFAULT_WORK_START_HOUR;
      const workStartMinute = employee?.workStartTime?.minute ?? DEFAULT_WORK_START_MINUTE;

      const { workingHours: wh, overtimeHours: oh } = calculateWorkingHoursFromPunches(
        attendance.checkIns,
        attendance.checkOuts,
        workStartHour,
        workStartMinute,
        DEFAULT_WORK_END_HOUR,
        DEFAULT_WORK_END_MINUTE
      );
      attendance.workingHours  = wh;
      attendance.overtimeHours = oh;
      attendance.status = determineStatus(wh, attendance.lateByMinutes ?? 0);
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

    const existingAttendance = await Attendance.findOne({ employee: employeeId, date: new Date(date) });
    if (existingAttendance) throw new ApiError(400, 'Attendance already exists for this date');

    // Fetch employee to use their personal work schedule
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new ApiError(404, 'Employee not found');

    const workStartHour   = employee.workStartTime?.hour   ?? DEFAULT_WORK_START_HOUR;
    const workStartMinute = employee.workStartTime?.minute ?? DEFAULT_WORK_START_MINUTE;

    const checkIns  = [];
    const checkOuts = [];

    if (checkInTime) {
      const [hours, minutes] = checkInTime.split(':');
      const checkInDateTime = moment.tz(date, 'Asia/Kolkata')
        .hours(parseInt(hours)).minutes(parseInt(minutes)).seconds(0).toDate();

      const lateThreshold = employee.lateThresholdMinutes ?? 0;
const lateInfo = isLate(checkInDateTime, workStartHour, workStartMinute, lateThreshold);

      checkIns.push({
        time:          checkInDateTime,
        location:      { latitude: 0, longitude: 0, address: 'Manually added' },
        faceVerified:  false,
        isLate:        lateInfo.isLate,
        lateByMinutes: lateInfo.minutes,
      });
    }

    if (checkOutTime) {
      const [hours, minutes] = checkOutTime.split(':');
      const checkOutDateTime = moment.tz(date, 'Asia/Kolkata')
        .hours(parseInt(hours)).minutes(parseInt(minutes)).seconds(0).toDate();

      checkOuts.push({
        time:         checkOutDateTime,
        location:     { latitude: 0, longitude: 0, address: 'Manually added' },
        faceVerified: false,
      });
    }

    // Auto-calculate working hours if both punches present
    let computedWorkingHours  = workingHours || 0;
    let computedOvertimeHours = 0;
    let computedIsLate        = isLate || false;
    let computedLateByMinutes = lateByMinutes || 0;

    if (checkIns.length > 0 && checkOuts.length > 0) {
      const { workingHours: wh, overtimeHours: oh } = calculateWorkingHoursFromPunches(
        checkIns, checkOuts,
        workStartHour, workStartMinute,
        DEFAULT_WORK_END_HOUR, DEFAULT_WORK_END_MINUTE
      );
      computedWorkingHours  = wh;
      computedOvertimeHours = oh;
    }

    if (checkIns.length > 0) {
      computedIsLate        = checkIns[0].isLate;
      computedLateByMinutes = checkIns[0].lateByMinutes;
    }

    const attendance = new Attendance({
      employee:      employeeId,
      date:          new Date(date),
      status:        status || determineStatus(computedWorkingHours, computedLateByMinutes),
      workingHours:  computedWorkingHours,
      overtimeHours: computedOvertimeHours,
      lateByMinutes: computedLateByMinutes,
      isLate:        computedIsLate,
      remarks:       remarks || '',
      checkIns,
      checkOuts,
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
      
      const startDate = moment.tz(`${year}-${month}-01`, 'Asia/Kolkata').startOf('month').toDate();
      const endDate = moment.tz(`${year}-${month}-01`, 'Asia/Kolkata').endOf('month').toDate();
      
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
          attendance.workingHours = 4.5; // Half of 9:30 AM - 6:30 PM (9 hours)
          if (!attendance.workingHours || attendance.workingHours === 0) {
            attendance.workingHours = 4.5;
          }
        } else if (status === 'present') {
          if (!attendance.workingHours || attendance.workingHours === 0) {
            attendance.workingHours = 9; // Full working day: 9 hours
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
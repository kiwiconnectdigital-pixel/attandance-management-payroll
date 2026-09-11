// controllers/attendance.controller.js - Sequelize Version (UPDATED - No Branch Required)
const { Attendance, AttendanceLocationLog, Punch, Employee, Branch, User,Company, sequelize } = require('../models');
const { isLate, calculateWorkingHoursFromPunches, determineStatus } = require('../services/attendance.service');
const { getFaceDescriptor, compareDescriptors, MATCH_THRESHOLD } = require('../services/faceVerification.service');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const moment = require('moment-timezone');
const { Op } = require('sequelize');

// Default work schedule: 9:30 AM to 6:30 PM IST
const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_START_MINUTE = 30;
const DEFAULT_WORK_END_HOUR = 18;
const DEFAULT_WORK_END_MINUTE = 30;
// Place near the top of attendance.controller.js, after requires
function serializePunch(p) {
  const v = p.toJSON ? p.toJSON() : p;
  return {
    ...v,
    latitude: v.latitude !== null && v.latitude !== undefined ? parseFloat(v.latitude) : null,
    longitude: v.longitude !== null && v.longitude !== undefined ? parseFloat(v.longitude) : null,
    face_match_score: v.face_match_score !== null && v.face_match_score !== undefined ? parseFloat(v.face_match_score) : null,
  };
}
module.exports = {
  // ─── CHECK IN (No branch required) ─────────────────────────────────────────────────────────────
  checkIn: async (req, res, next) => {
  try {
    const { latitude, longitude, address } = req.body;

    const employee = await Employee.findOne({
      where: { user_id: req.user.id, is_active: true },
      include: [{ model: User, as: 'user', attributes: ['id', 'email'] }]
    });
    if (!employee) throw new ApiError(404, 'Employee record not found');

    if (!req.file) throw new ApiError(400, 'Selfie is required for check-in');
    if (!employee.face_descriptor || employee.face_descriptor.length === 0) {
      throw new ApiError(400, 'No reference face on file. Please contact HR to update your profile photo.');
    }

    const selfieDescriptor = await getFaceDescriptor(req.file.path);
    if (!selfieDescriptor) {
      throw new ApiError(400, 'No face detected in selfie. Please retake the photo.');
    }

    const employeeDescriptor = JSON.parse(employee.face_descriptor);
    const distance = compareDescriptors(employeeDescriptor, selfieDescriptor);
    if (distance >= MATCH_THRESHOLD) {
      throw new ApiError(401, `Face verification failed (score: ${distance.toFixed(3)}). Access denied.`);
    }

    if (!latitude || !longitude) {
      throw new ApiError(400, 'Location (latitude & longitude) is required');
    }
    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);
    if (isNaN(parsedLat) || isNaN(parsedLng) ||
        parsedLat < -90 || parsedLat > 90 ||
        parsedLng < -180 || parsedLng > 180) {
      throw new ApiError(400, 'Invalid location coordinates');
    }

    const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

    let attendance = await Attendance.findOne({
      where: { employee_id: employee.id, date: today }
    });

    // ── FIXED GUARD: compare check-in count vs check-out count ──────────
    // An open session (checkInCount > checkOutCount) always blocks a new
    // check-in, regardless of how many complete in/out cycles happened
    // earlier the same day.
    if (attendance) {
      const checkInCount = await Punch.count({
        where: { attendance_id: attendance.id, type: 'check_in' }
      });
      const checkOutCount = await Punch.count({
        where: { attendance_id: attendance.id, type: 'check_out' }
      });
      if (checkInCount > checkOutCount) {
        throw new ApiError(400, 'You are already checked in today. Please check out first.');
      }

      // ── Duplicate-tap shield: block a near-identical punch fired within
      // a couple of seconds of the last one (same rough location, same type)
      const lastPunch = await Punch.findOne({
        where: { attendance_id: attendance.id, type: 'check_in' },
        order: [['time', 'DESC']]
      });
      if (lastPunch) {
        const secondsSinceLast = moment().diff(moment(lastPunch.time), 'seconds');
        if (secondsSinceLast < 5) {
          throw new ApiError(400, 'Duplicate check-in detected. Please wait a moment and try again.');
        }
      }
    }

    const checkInTime = moment().tz('Asia/Kolkata');
    const workStartHour = employee.work_start_hour ?? DEFAULT_WORK_START_HOUR;
    const workStartMinute = employee.work_start_minute ?? DEFAULT_WORK_START_MINUTE;
    const lateThreshold = employee.late_threshold_minutes ?? 0;
    const lateInfo = isLate(checkInTime.toDate(), workStartHour, workStartMinute, lateThreshold);

    const initialStatus = lateInfo.minutes >= 30 ? 'half-day' : 'present';

    if (!attendance) {
      attendance = await Attendance.create({
        employee_id: employee.id,
        date: today,
        status: initialStatus,
        is_late: lateInfo.isLate,
        late_by_minutes: lateInfo.minutes,
        working_hours: 0
      });
    }

    const selfiePath = req.file.path.replace(/\\/g, '/');
    const punch = await Punch.create({
      attendance_id: attendance.id,
      type: 'check_in',
      time: checkInTime.toDate(),
      selfie: selfiePath,
      branch_id: null,
      latitude: parsedLat,
      longitude: parsedLng,
      address: address || 'GPS captured',
      face_match_score: parseFloat(distance.toFixed(4)),
      face_verified: true,
      is_late: lateInfo.isLate,
      late_by_minutes: lateInfo.minutes
    });

    await AttendanceLocationLog.create({
      attendance_id: attendance.id,
      employee_id: employee.id,
      latitude: parsedLat,
      longitude: parsedLng,
      address: address || 'GPS captured',
      source: 'checkin',
      recorded_at: checkInTime.toDate()
    });

    const statusNote = lateInfo.isLate
      ? `Late by ${lateInfo.minutes}m${lateInfo.minutes >= 30 ? ' — marked half-day' : ''}`
      : 'On time';

    res.json(new ApiResponse(
      200,
      {
        attendanceId: attendance.id,
        checkInTime: checkInTime.format('HH:mm:ss'),
        location: { latitude: parsedLat, longitude: parsedLng }
      },
      `Checked in at ${checkInTime.format('hh:mm A')} ✓ ${statusNote}`
    ));
  } catch (error) {
    next(error);
  }
},

checkInWithLocation: async (req, res, next) => {
  try {
    const {
      latitude,
      longitude,
      address,
      accuracy_meters
    } = req.body;

    // =========================================================
    // 1. FIND EMPLOYEE
    // =========================================================
    const employee = await Employee.findOne({
      where: {
        user_id: req.user.id,
        is_active: true,
        is_deleted: false
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email"]
        }
      ]
    });

    if (!employee) {
      throw new ApiError(404, "Employee record not found");
    }

    // =========================================================
    // 2. FIND COMPANY
    // =========================================================
    const company = await Company.findByPk(employee.company_id);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    if (!company.is_active) {
      throw new ApiError(400, "Company is inactive");
    }

    // =========================================================
    // 3. SELFIE REQUIRED
    // =========================================================
    if (!req.file) {
      throw new ApiError(400, "Selfie is required for check-in");
    }

    // =========================================================
    // 4. CHECK EMPLOYEE REFERENCE FACE
    // =========================================================
    if (
      !employee.face_descriptor ||
      employee.face_descriptor.length === 0
    ) {
      throw new ApiError(
        400,
        "No reference face on file. Please contact HR to update your profile photo."
      );
    }

    // =========================================================
    // 5. GET FACE DESCRIPTOR FROM SELFIE
    // =========================================================
    const selfieDescriptor = await getFaceDescriptor(req.file.path);

    if (!selfieDescriptor) {
      throw new ApiError(
        400,
        "No face detected in selfie. Please retake the photo."
      );
    }

    // =========================================================
    // 6. FACE VERIFICATION
    // =========================================================
    let employeeDescriptor;

    try {
      employeeDescriptor = JSON.parse(employee.face_descriptor);
    } catch (error) {
      throw new ApiError(
        500,
        "Invalid employee face data. Please contact HR."
      );
    }

    const distance = compareDescriptors(
      employeeDescriptor,
      selfieDescriptor
    );

    if (distance >= MATCH_THRESHOLD) {
      throw new ApiError(
        401,
        `Face verification failed (score: ${distance.toFixed(
          3
        )}). Access denied.`
      );
    }

    // =========================================================
    // 7. FIND EMPLOYEE BRANCH
    // =========================================================
    const branch = await Branch.findOne({
      where: {
        id: employee.branch_id,
        company_id: employee.company_id,
        is_active: true,
        is_deleted: false
      }
    });

    if (!branch) {
      throw new ApiError(
        400,
        "Active branch not found for this employee. Please contact HR."
      );
    }

    // =========================================================
    // 8. LOCATION VARIABLES
    // =========================================================
    let parsedLat = null;
    let parsedLng = null;
    let distanceFromOffice = null;
    let allowedRadius = null;

    // =========================================================
    // 9. COMPANY LOCATION SETTING
    // =========================================================
    if (company.office_location_enabled === true) {
      // -------------------------------------------------------
      // Location is mandatory
      // -------------------------------------------------------
      if (
        latitude === undefined ||
        latitude === null ||
        latitude === "" ||
        longitude === undefined ||
        longitude === null ||
        longitude === ""
      ) {
        throw new ApiError(
          400,
          "Location (latitude & longitude) is required for check-in"
        );
      }

      parsedLat = parseFloat(latitude);
      parsedLng = parseFloat(longitude);

      // -------------------------------------------------------
      // Validate employee coordinates
      // -------------------------------------------------------
      if (
        isNaN(parsedLat) ||
        isNaN(parsedLng) ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLng < -180 ||
        parsedLng > 180
      ) {
        throw new ApiError(
          400,
          "Invalid location coordinates"
        );
      }

      // -------------------------------------------------------
      // Branch geofence must be enabled
      // -------------------------------------------------------
      if (branch.geofence_enabled !== true) {
        throw new ApiError(
          400,
          "Geofence is not configured for your branch. Please contact HR."
        );
      }

      // -------------------------------------------------------
      // Branch geofence coordinates required
      // -------------------------------------------------------
      if (
        branch.geofence_latitude === null ||
        branch.geofence_latitude === undefined ||
        branch.geofence_longitude === null ||
        branch.geofence_longitude === undefined
      ) {
        throw new ApiError(
          400,
          "Branch geofence location is not configured. Please contact HR."
        );
      }

      const branchLat = parseFloat(
        branch.geofence_latitude
      );

      const branchLng = parseFloat(
        branch.geofence_longitude
      );

      if (
        isNaN(branchLat) ||
        isNaN(branchLng) ||
        branchLat < -90 ||
        branchLat > 90 ||
        branchLng < -180 ||
        branchLng > 180
      ) {
        throw new ApiError(
          500,
          "Invalid branch geofence coordinates. Please contact HR."
        );
      }

      // -------------------------------------------------------
      // Branch radius
      // -------------------------------------------------------
      allowedRadius =
        Number(branch.geofence_radius_meters) || 50;

      if (allowedRadius <= 0) {
        throw new ApiError(
          500,
          "Invalid branch geofence radius. Please contact HR."
        );
      }

      // =======================================================
      // 10. HAVERSINE DISTANCE CALCULATION
      // =======================================================

      const earthRadius = 6371000; // meters

      const toRadians = (degrees) => {
        return (degrees * Math.PI) / 180;
      };

      const dLat = toRadians(
        branchLat - parsedLat
      );

      const dLng = toRadians(
        branchLng - parsedLng
      );

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(parsedLat)) *
          Math.cos(toRadians(branchLat)) *
          Math.sin(dLng / 2) ** 2;

      const c =
        2 *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        );

      distanceFromOffice = earthRadius * c;

      // =======================================================
      // 11. CHECK GEOFENCE
      // =======================================================

      if (distanceFromOffice > allowedRadius) {
        throw new ApiError(
          400,
          `You are ${Math.round(
            distanceFromOffice
          )} meters away from the office. Check-in is allowed only within ${allowedRadius} meters.`
        );
      }
    }

    // =========================================================
    // 12. CURRENT DATE
    // =========================================================
    const today = moment()
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD");

    // =========================================================
    // 13. FIND TODAY'S ATTENDANCE
    // =========================================================
    let attendance = await Attendance.findOne({
      where: {
        employee_id: employee.id,
        date: today
      }
    });

    // =========================================================
    // 14. CHECK DUPLICATE ACTIVE CHECK-IN
    // =========================================================
    if (attendance) {
      const checkInCount = await Punch.count({
        where: {
          attendance_id: attendance.id,
          type: "check_in"
        }
      });

      const checkOutCount = await Punch.count({
        where: {
          attendance_id: attendance.id,
          type: "check_out"
        }
      });

      // Employee already checked in and has not checked out
      if (checkInCount > checkOutCount) {
        throw new ApiError(
          400,
          "You are already checked in today. Please check out first."
        );
      }

      // =======================================================
      // PREVENT VERY FAST DUPLICATE CHECK-IN
      // =======================================================

      const lastPunch = await Punch.findOne({
        where: {
          attendance_id: attendance.id,
          type: "check_in"
        },
        order: [["time", "DESC"]]
      });

      if (lastPunch) {
        const secondsSinceLast = moment().diff(
          moment(lastPunch.time),
          "seconds"
        );

        if (secondsSinceLast < 5) {
          throw new ApiError(
            400,
            "Duplicate check-in detected. Please wait a moment and try again."
          );
        }
      }
    }

    // =========================================================
    // 15. CHECK LATE STATUS
    // =========================================================
    const checkInTime = moment().tz("Asia/Kolkata");

    const workStartHour =
      employee.work_start_hour ??
      DEFAULT_WORK_START_HOUR;

    const workStartMinute =
      employee.work_start_minute ??
      DEFAULT_WORK_START_MINUTE;

    const lateThreshold =
      employee.late_threshold_minutes ?? 0;

    const lateInfo = isLate(
      checkInTime.toDate(),
      workStartHour,
      workStartMinute,
      lateThreshold
    );

    const initialStatus =
      lateInfo.minutes >= 30
        ? "half-day"
        : "present";

    // =========================================================
    // 16. CREATE ATTENDANCE IF NOT EXISTS
    // =========================================================
    if (!attendance) {
      attendance = await Attendance.create({
        employee_id: employee.id,
        date: today,
        status: initialStatus,
        is_late: lateInfo.isLate,
        late_by_minutes: lateInfo.minutes,
        working_hours: 0
      });
    }

    // =========================================================
    // 17. SELFIE PATH
    // =========================================================
    const selfiePath = req.file.path.replace(
      /\\/g,
      "/"
    );

    // =========================================================
    // 18. CREATE PUNCH
    // =========================================================
    const punch = await Punch.create({
      attendance_id: attendance.id,
      type: "check_in",
      time: checkInTime.toDate(),
      selfie: selfiePath,

      // Employee's actual branch
      branch_id: employee.branch_id,

      // Actual employee GPS location
      latitude: parsedLat,
      longitude: parsedLng,

      address:
        address ||
        branch.geofence_address ||
        "GPS captured",

      // Face verification
      face_match_score: parseFloat(
        distance.toFixed(4)
      ),
      face_verified: true,

      // Late information
      is_late: lateInfo.isLate,
      late_by_minutes: lateInfo.minutes
    });

    // =========================================================
    // 19. CREATE LOCATION LOG
    // =========================================================
    // AttendanceLocationLog latitude/longitude are NOT NULL.
    // Therefore create the log only when location was captured.
    if (
      parsedLat !== null &&
      parsedLng !== null
    ) {
      await AttendanceLocationLog.create({
        attendance_id: attendance.id,
        employee_id: employee.id,

        latitude: parsedLat,
        longitude: parsedLng,

        address:
          address ||
          branch.geofence_address ||
          "GPS captured",

        accuracy_meters:
          accuracy_meters !== undefined &&
          accuracy_meters !== null &&
          accuracy_meters !== ""
            ? parseFloat(accuracy_meters)
            : null,

        source: "checkin",

        recorded_at:
          checkInTime.toDate()
      });
    }

    // =========================================================
    // 20. RESPONSE
    // =========================================================
    const statusNote = lateInfo.isLate
      ? `Late by ${lateInfo.minutes}m${
          lateInfo.minutes >= 30
            ? " — marked half-day"
            : ""
        }`
      : "On time";

    res.json(
      new ApiResponse(
        200,
        {
          attendanceId: attendance.id,

          punchId: punch.id,

          checkInTime:
            checkInTime.format("HH:mm:ss"),

          location:
            parsedLat !== null &&
            parsedLng !== null
              ? {
                  latitude: parsedLat,
                  longitude: parsedLng,
                  accuracy_meters:
                    accuracy_meters
                      ? parseFloat(
                          accuracy_meters
                        )
                      : null
                }
              : null,

          faceVerification: {
            verified: true,
            score: parseFloat(
              distance.toFixed(4)
            )
          },

          geofence:
            company.office_location_enabled
              ? {
                  enabled: true,
                  branchId: branch.id,
                  branchName: branch.name,
                  distanceMeters: Math.round(
                    distanceFromOffice
                  ),
                  allowedRadiusMeters:
                    allowedRadius
                }
              : {
                  enabled: false
                },

          late: {
            isLate: lateInfo.isLate,
            minutes: lateInfo.minutes
          }
        },
        `Checked in at ${checkInTime.format(
          "hh:mm A"
        )} ✓ ${statusNote}`
      )
    );
  } catch (error) {
    next(error);
  }
},
  // ─── CHECK OUT (No branch required) ────────────────────────────────────────────────────────────
  checkOut: async (req, res, next) => {
    try {
      const { latitude, longitude, address } = req.body;

      // Get employee
      const employee = await Employee.findOne({
        where: { user_id: req.user.id, is_active: true }
      });
      if (!employee) throw new ApiError(404, 'Employee record not found');

      // ── Check if checked in ────────────────────────────────────────────
      const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
      
      const attendance = await Attendance.findOne({
        where: { employee_id: employee.id, date: today }
      });
      if (!attendance) {
        throw new ApiError(400, 'No check-in found for today');
      }

      // Count check-ins and check-outs
      const checkInCount = await Punch.count({
        where: { attendance_id: attendance.id, type: 'check_in' }
      });
      const checkOutCount = await Punch.count({
        where: { attendance_id: attendance.id, type: 'check_out' }
      });

      if (checkInCount === 0) {
        throw new ApiError(400, 'No check-in found for today');
      }

      if (checkOutCount >= checkInCount) {
        throw new ApiError(400, 'You have already checked out. Please check in first.');
      }
const lastPunch = await Punch.findOne({
  where: { attendance_id: attendance.id, type: 'check_out' },
  order: [['time', 'DESC']]
});
if (lastPunch) {
  const secondsSinceLast = moment().diff(moment(lastPunch.time), 'seconds');
  if (secondsSinceLast < 5) {
    throw new ApiError(400, 'Duplicate check-out detected. Please wait a moment and try again.');
  }
}
      // ── Face verification ──────────────────────────────────────────────
      if (!req.file) throw new ApiError(400, 'Selfie is required for check-out');
      if (!employee.face_descriptor || employee.face_descriptor.length === 0) {
        throw new ApiError(400, 'No reference face on file.');
      }

      const selfieDescriptor = await getFaceDescriptor(req.file.path);
      if (!selfieDescriptor) {
        throw new ApiError(400, 'No face detected in selfie. Please retake the photo.');
      }

      const employeeDescriptor = JSON.parse(employee.face_descriptor);
      const distance = compareDescriptors(employeeDescriptor, selfieDescriptor);
      if (distance >= MATCH_THRESHOLD) {
        throw new ApiError(401, `Face verification failed (score: ${distance.toFixed(3)}). Access denied.`);
      }

      // ── Location validation ────────────────────────────────────────────
      if (!latitude || !longitude) {
        throw new ApiError(400, 'Location (latitude & longitude) is required');
      }

      const parsedLat = parseFloat(latitude);
      const parsedLng = parseFloat(longitude);

      // Validate coordinates are within valid range
      if (isNaN(parsedLat) || isNaN(parsedLng) || 
          parsedLat < -90 || parsedLat > 90 || 
          parsedLng < -180 || parsedLng > 180) {
        throw new ApiError(400, 'Invalid location coordinates');
      }

      // ── Insert check-out punch ────────────────────────────────────────
      const checkOutTime = moment().tz('Asia/Kolkata');
      const selfiePath = req.file.path.replace(/\\/g, '/');
      
      const punch = await Punch.create({
        attendance_id: attendance.id,
        type: 'check_out',
        time: checkOutTime.toDate(),
        selfie: selfiePath,
        branch_id: null, // No branch required
        latitude: parsedLat,
        longitude: parsedLng,
        address: address || 'GPS captured',
        face_match_score: parseFloat(distance.toFixed(4)),
        face_verified: true
      });

      // ── Log check-out location (end of trail) ───────────────────────────
      await AttendanceLocationLog.create({
        attendance_id: attendance.id,
        employee_id: employee.id,
        latitude: parsedLat,
        longitude: parsedLng,
        address: address || 'GPS captured',
        source: 'checkout',
        recorded_at: checkOutTime.toDate()
      });

      // ── Recalculate working hours ─────────────────────────────────────
      const punches = await Punch.findAll({
        where: { attendance_id: attendance.id },
        order: [['time', 'ASC']]
      });

      const checkIns = punches.filter(p => p.type === 'check_in');
      const checkOuts = punches.filter(p => p.type === 'check_out');

      const workStartHour = employee.work_start_hour ?? DEFAULT_WORK_START_HOUR;
      const workStartMinute = employee.work_start_minute ?? DEFAULT_WORK_START_MINUTE;

      const { workingHours, overtimeHours } = calculateWorkingHoursFromPunches(
        checkIns,
        checkOuts,
        workStartHour,
        workStartMinute,
        DEFAULT_WORK_END_HOUR,
        DEFAULT_WORK_END_MINUTE
      );

      // ── Update attendance record ──────────────────────────────────────
      const lateByMinutes = attendance.late_by_minutes || 0;
      const status = determineStatus(workingHours, lateByMinutes);

      await attendance.update({
        working_hours: workingHours,
        overtime_hours: overtimeHours,
        status: status
      });

      const statusLabel = status === 'half-day' ? ' — marked half-day' : '';
      res.json(new ApiResponse(
        200,
        { 
          attendanceId: attendance.id, 
          workingHours, 
          overtimeHours,
          location: { latitude: parsedLat, longitude: parsedLng }
        },
        `Checked out at ${checkOutTime.format('hh:mm A')}. Total: ${workingHours.toFixed(2)} hrs ✓ Face verified${statusLabel}`
      ));
    } catch (error) {
      next(error);
    }
  },

  // ─── GET ATTENDANCE (list) ─────────────────────────────────────────────────
  getAttendance: async (req, res, next) => {
    try {
      const { employeeId, month, year, startDate, endDate, page = 1, limit = 31 } = req.query;
      
      const where = {};
      const employeeWhere = {};

      if (employeeId) {
        where.employee_id = employeeId;
      } else if (req.user.role === 'employee') {
        const employee = await Employee.findOne({ where: { user_id: req.user.id } });
        if (employee) {
          where.employee_id = employee.id;
        }
      }

      if (month && year) {
        where.date = {
          [Op.gte]: moment(`${year}-${month}-01`).startOf('month').toDate(),
          [Op.lte]: moment(`${year}-${month}-01`).endOf('month').toDate()
        };
      } else if (startDate && endDate) {
        where.date = {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate)
        };
      }

      const offset = (page - 1) * limit;
      
      const { count, rows: records } = await Attendance.findAndCountAll({
        where,
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'employee_code', 'name', 'department', 'designation'],
            include: [
              {
                model: Branch,
                as: 'branch',
                attributes: ['id', 'name']
              }
            ]
          }
        ],
        order: [['date', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // Get punches for each attendance
      for (const record of records) {
  const punches = await Punch.findAll({
    where: { attendance_id: record.id },
    order: [['time', 'ASC']]
  });
  record.dataValues.checkIns = punches.filter(p => p.type === 'check_in').map(serializePunch);
  record.dataValues.checkOuts = punches.filter(p => p.type === 'check_out').map(serializePunch);
}

      res.json(new ApiResponse(200, { 
        records, 
        total: count, 
        page: parseInt(page), 
        limit: parseInt(limit) 
      }));
    } catch (error) {
      next(error);
    }
  },

  // ─── TODAY'S SUMMARY ──────────────────────────────────────────────────────
  getTodaySummary: async (req, res, next) => {
    try {
      const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

      // Get user's company
      const user = await User.findByPk(req.user.id);
      const companyId = user?.company_id;

      const employeeWhere = {};
      if (companyId) {
        employeeWhere.company_id = companyId;
      }

      const totalEmployees = await Employee.count({
        where: employeeWhere
      });

      const attendanceWhere = {
        date: today
      };

      if (companyId) {
        attendanceWhere['$employee.company_id$'] = companyId;
      }

      const summary = await Attendance.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('employee_id'))), 'totalEmployees'],
          [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "present" THEN 1 ELSE 0 END')), 'presentToday'],
          [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_late = 1 THEN 1 ELSE 0 END')), 'lateToday'],
          [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = "half-day" THEN 1 ELSE 0 END')), 'halfDayToday']
        ],
        where: attendanceWhere,
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: [],
            where: employeeWhere
          }
        ],
        raw: true
      });

      const result = summary[0] || {};
      res.json(new ApiResponse(200, {
        totalEmployees,
        presentToday: parseInt(result.presentToday) || 0,
        absentToday: totalEmployees - (parseInt(result.presentToday) || 0),
        lateToday: parseInt(result.lateToday) || 0,
        halfDayToday: parseInt(result.halfDayToday) || 0,
      }));
    } catch (error) {
      next(error);
    }
  },

  // ─── GET BY ID ────────────────────────────────────────────────────────────
  getAttendanceById: async (req, res, next) => {
    try {
      const attendance = await Attendance.findByPk(req.params.id, {
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'employee_code', 'name', 'department', 'designation']
          }
        ]
      });

      if (!attendance) throw new ApiError(404, 'Attendance record not found');

      // Check access
      if (req.user.role === 'employee') {
        const employee = await Employee.findOne({ where: { user_id: req.user.id } });
        if (!employee || attendance.employee_id !== employee.id) {
          throw new ApiError(403, 'Access denied');
        }
      }

     const punches = await Punch.findAll({
  where: { attendance_id: attendance.id },
  order: [['time', 'ASC']]
});
attendance.dataValues.checkIns = punches.filter(p => p.type === 'check_in').map(serializePunch);
attendance.dataValues.checkOuts = punches.filter(p => p.type === 'check_out').map(serializePunch);
      res.json(new ApiResponse(200, attendance));
    } catch (error) {
      next(error);
    }
  },

  // ─── ALL ATTENDANCE WITH SEARCH & FILTER ─────────────────────────────
  getAllAttendanceDetailed: async (req, res, next) => {
    try {
      const { search, month, year, startDate, endDate, page = 1, limit = 20 } = req.query;

      // Get user's company
      const user = await User.findByPk(req.user.id);
      const companyId = user?.company_id;

      const employeeWhere = {};
      if (companyId) {
        employeeWhere.company_id = companyId;
      }

      const attendanceWhere = {};

      if (search) {
        employeeWhere[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { employee_code: { [Op.like]: `%${search}%` } }
        ];
      }

      if (month && year) {
        attendanceWhere.date = {
          [Op.gte]: moment(`${year}-${month}-01`).startOf('month').toDate(),
          [Op.lte]: moment(`${year}-${month}-01`).endOf('month').toDate()
        };
      } else if (startDate && endDate) {
        attendanceWhere.date = {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate)
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows: records } = await Attendance.findAndCountAll({
        where: attendanceWhere,
        include: [
          {
            model: Employee,
            as: 'employee',
            where: employeeWhere,
            attributes: ['id', 'employee_code', 'name', 'department', 'designation'],
            include: [
              {
                model: Branch,
                as: 'branch',
                attributes: ['id', 'name']
              }
            ]
          }
        ],
        order: [['date', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // Get punches for each record
      for (const record of records) {
        const punches = await Punch.findAll({
          where: { attendance_id: record.id },
          include: [
            {
              model: Branch,
              as: 'branch',
              attributes: ['name']
            }
          ],
          order: [['time', 'ASC']]
        });
        
        record.dataValues.checkIns = punches.filter(p => p.type === 'check_in').map(p => ({
  time: p.time,
  selfie: p.selfie,
  location: { latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude), address: p.address },
  isLate: p.is_late === 1,
  lateByMinutes: p.late_by_minutes,
  branchName: p.branch?.name || null
}));

record.dataValues.checkOuts = punches.filter(p => p.type === 'check_out').map(p => ({
  time: p.time,
  selfie: p.selfie,
  location: { latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude), address: p.address },
  branchName: p.branch?.name || null
}));
      }

      res.json({
        success: true,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        data: records,
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

      const attendance = await Attendance.findByPk(id);
      if (!attendance) throw new ApiError(404, 'Attendance record not found');

      // Get employee for work schedule
      const employee = await Employee.findByPk(attendance.employee_id);
      if (!employee) throw new ApiError(404, 'Employee not found');

      const updateData = {};

      if (status) updateData.status = status;
      if (workingHours !== undefined) updateData.working_hours = workingHours;
      if (lateByMinutes !== undefined) updateData.late_by_minutes = lateByMinutes;
      if (isLate !== undefined) updateData.is_late = isLate;
      if (remarks) updateData.remarks = remarks;

      // Update check-in time
      if (checkInTime) {
        const [hours, minutes] = checkInTime.split(':');
        const checkInDateTime = moment.tz(attendance.date, 'Asia/Kolkata')
          .hours(parseInt(hours)).minutes(parseInt(minutes)).seconds(0).toDate();

        const workStartHour = employee?.work_start_hour ?? DEFAULT_WORK_START_HOUR;
        const workStartMinute = employee?.work_start_minute ?? DEFAULT_WORK_START_MINUTE;
        const lateThreshold = employee?.late_threshold_minutes ?? 0;
        const lateInfo = isLate(checkInDateTime, workStartHour, workStartMinute, lateThreshold);

        // Update first check-in
        const firstCheckIn = await Punch.findOne({
          where: { attendance_id: id, type: 'check_in' },
          order: [['time', 'ASC']]
        });
        if (firstCheckIn) {
          await firstCheckIn.update({
            time: checkInDateTime,
            is_late: lateInfo.isLate,
            late_by_minutes: lateInfo.minutes
          });
        }

        updateData.is_late = lateInfo.isLate;
        updateData.late_by_minutes = lateInfo.minutes;
      }

      // Update check-out time
      if (checkOutTime) {
        const [hours, minutes] = checkOutTime.split(':');
        const checkOutDateTime = moment.tz(attendance.date, 'Asia/Kolkata')
          .hours(parseInt(hours)).minutes(parseInt(minutes)).seconds(0).toDate();

        const firstCheckOut = await Punch.findOne({
          where: { attendance_id: id, type: 'check_out' },
          order: [['time', 'ASC']]
        });
        if (firstCheckOut) {
          await firstCheckOut.update({ time: checkOutDateTime });
        }
      }

      // Recalculate working hours if time was updated
      if ((checkInTime || checkOutTime)) {
        const punches = await Punch.findAll({
          where: { attendance_id: id },
          order: [['time', 'ASC']]
        });
        const checkIns = punches.filter(p => p.type === 'check_in');
        const checkOuts = punches.filter(p => p.type === 'check_out');

        if (checkIns.length > 0 && checkOuts.length > 0) {
          const workStartHour = employee?.work_start_hour ?? DEFAULT_WORK_START_HOUR;
          const workStartMinute = employee?.work_start_minute ?? DEFAULT_WORK_START_MINUTE;

          const { workingHours: wh, overtimeHours: oh } = calculateWorkingHoursFromPunches(
            checkIns,
            checkOuts,
            workStartHour,
            workStartMinute,
            DEFAULT_WORK_END_HOUR,
            DEFAULT_WORK_END_MINUTE
          );
          updateData.working_hours = wh;
          updateData.overtime_hours = oh;
          updateData.status = determineStatus(wh, attendance.late_by_minutes || 0);
        }
      }

      await attendance.update(updateData);
      const updated = await Attendance.findByPk(id);

      res.json(new ApiResponse(200, updated, 'Attendance updated successfully'));
    } catch (error) {
      next(error);
    }
  },

  // ─── CREATE ATTENDANCE (MANUAL) ────────────────────────────────────
  createAttendance: async (req, res, next) => {
    try {
      const { employeeId, date, status, workingHours, lateByMinutes, isLate: manualIsLate, checkInTime, checkOutTime, remarks } = req.body;

      // Check if attendance already exists
      const existing = await Attendance.findOne({
        where: { employee_id: employeeId, date: date }
      });
      if (existing) throw new ApiError(400, 'Attendance already exists for this date');

      // Get employee for work schedule
      const employee = await Employee.findByPk(employeeId);
      if (!employee) throw new ApiError(404, 'Employee not found');

      const workStartHour = employee.work_start_hour ?? DEFAULT_WORK_START_HOUR;
      const workStartMinute = employee.work_start_minute ?? DEFAULT_WORK_START_MINUTE;

      // Create attendance record
      const attendance = await Attendance.create({
        employee_id: employeeId,
        date: date,
        status: status || 'present',
        working_hours: workingHours || 0,
        overtime_hours: 0,
        is_late: manualIsLate || false,
        late_by_minutes: lateByMinutes || 0,
        remarks: remarks || null
      });

      // Add check-in punch if time provided
      if (checkInTime) {
        const [hours, minutes] = checkInTime.split(':');
        const checkInDateTime = moment.tz(date, 'Asia/Kolkata')
          .hours(parseInt(hours)).minutes(parseInt(minutes)).seconds(0).toDate();

        const lateThreshold = employee.late_threshold_minutes ?? 0;
        const lateInfo = isLate(checkInDateTime, workStartHour, workStartMinute, lateThreshold);

        await Punch.create({
          attendance_id: attendance.id,
          type: 'check_in',
          time: checkInDateTime,
          latitude: 0,
          longitude: 0,
          address: 'Manually added',
          branch_id: null,
          face_verified: false,
          is_late: lateInfo.isLate,
          late_by_minutes: lateInfo.minutes
        });
      }

      // Add check-out punch if time provided
      if (checkOutTime) {
        const [hours, minutes] = checkOutTime.split(':');
        const checkOutDateTime = moment.tz(date, 'Asia/Kolkata')
          .hours(parseInt(hours)).minutes(parseInt(minutes)).seconds(0).toDate();

        await Punch.create({
          attendance_id: attendance.id,
          type: 'check_out',
          time: checkOutDateTime,
          latitude: 0,
          longitude: 0,
          address: 'Manually added',
          branch_id: null,
          face_verified: false
        });
      }

      const created = await Attendance.findByPk(attendance.id);

      res.json(new ApiResponse(201, created, 'Attendance created successfully'));
    } catch (error) {
      next(error);
    }
  },

  // ─── DELETE ATTENDANCE ─────────────────────────────────────────────
  deleteAttendance: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Delete punches first
      await Punch.destroy({ where: { attendance_id: id } });
      
      const deleted = await Attendance.destroy({ where: { id } });
      if (deleted === 0) throw new ApiError(404, 'Attendance record not found');
      
      res.json(new ApiResponse(200, null, 'Attendance deleted successfully'));
    } catch (error) {
      next(error);
    }
  },

  // ─── BULK UPDATE ATTENDANCE ────────────────────────────────────────
  bulkUpdateAttendance: async (req, res, next) => {
    try {
      const { employeeId, month, year, status } = req.body;

      const where = {
        employee_id: employeeId,
        date: {
          [Op.gte]: moment(`${year}-${month}-01`).startOf('month').toDate(),
          [Op.lte]: moment(`${year}-${month}-01`).endOf('month').toDate()
        }
      };

      const [updatedCount] = await Attendance.update(
        { status: status },
        { where }
      );

      // If marking as absent or half-day, update working hours
      if (status === 'absent') {
        await Attendance.update(
          { working_hours: 0, is_late: false, late_by_minutes: 0 },
          { where }
        );
      } else if (status === 'half-day') {
        await Attendance.update(
          { working_hours: 4.5 },
          { 
            where: {
              ...where,
              [Op.or]: [
                { working_hours: 0 },
                { working_hours: null }
              ]
            }
          }
        );
      } else if (status === 'present') {
        await Attendance.update(
          { working_hours: 9 },
          { 
            where: {
              ...where,
              [Op.or]: [
                { working_hours: 0 },
                { working_hours: null }
              ]
            }
          }
        );
      }

      res.json(new ApiResponse(200, null, `Bulk updated ${updatedCount} records to ${status}`));
    } catch (error) {
      next(error);
    }
  },

trackLocation: async (req, res, next) => {
  try {
    const {
      latitude,
      longitude,
      address,
      accuracy,
      altitude,
      heading,
      speed,
      recorded_at,
      is_mocked,
    } = req.body;

    // =========================================================
    // 1. VALIDATE BASIC GPS DATA
    // =========================================================

    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude === null ||
      longitude === null ||
      latitude === "" ||
      longitude === ""
    ) {
      throw new ApiError(
        400,
        "Location (latitude & longitude) is required"
      );
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ApiError(
        400,
        "Invalid latitude or longitude"
      );
    }

    // Valid GPS coordinate ranges
    if (lat < -90 || lat > 90) {
      throw new ApiError(
        400,
        "Invalid latitude"
      );
    }

    if (lng < -180 || lng > 180) {
      throw new ApiError(
        400,
        "Invalid longitude"
      );
    }

    // =========================================================
    // 2. GPS ACCURACY
    // =========================================================

    let gpsAccuracy = null;

    if (
      accuracy !== undefined &&
      accuracy !== null &&
      accuracy !== ""
    ) {
      gpsAccuracy = Number(accuracy);

      if (!Number.isFinite(gpsAccuracy)) {
        gpsAccuracy = null;
      }
    }

    /**
     * Reject extremely inaccurate GPS points.
     *
     * 75 meters is a reasonable starting point.
     *
     * You can increase this to 100 if employees work
     * inside buildings where GPS accuracy is weaker.
     */
    if (
      gpsAccuracy !== null &&
      gpsAccuracy > 75
    ) {
      return res.json(
        new ApiResponse(
          200,
          {
            skipped: true,
            reason: "poor_accuracy",
            accuracy: gpsAccuracy,
          },
          "Location skipped because GPS accuracy is too low"
        )
      );
    }

    // =========================================================
    // 3. FIND EMPLOYEE
    // =========================================================

    const employee = await Employee.findOne({
      where: {
        user_id: req.user.id,
        is_active: true,
      },
    });

    if (!employee) {
      throw new ApiError(
        404,
        "Employee record not found"
      );
    }

    // =========================================================
    // 4. FIND TODAY'S ATTENDANCE
    // =========================================================

    const today = moment()
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD");

    const attendance =
      await Attendance.findOne({
        where: {
          employee_id: employee.id,
          date: today,
        },
      });

    if (!attendance) {
      throw new ApiError(
        400,
        "You are not checked in today"
      );
    }

    // =========================================================
    // 5. VERIFY EMPLOYEE IS CURRENTLY CHECKED IN
    // =========================================================

    const checkInCount =
      await Punch.count({
        where: {
          attendance_id: attendance.id,
          type: "check_in",
        },
      });

    const checkOutCount =
      await Punch.count({
        where: {
          attendance_id: attendance.id,
          type: "check_out",
        },
      });

    if (
      checkOutCount >= checkInCount
    ) {
      throw new ApiError(
        400,
        "You are currently checked out — location tracking is not active"
      );
    }

    // =========================================================
    // 6. GET LAST LOCATION
    // =========================================================

    const lastLog =
      await AttendanceLocationLog.findOne({
        where: {
          attendance_id: attendance.id,
        },
        order: [
          ["recorded_at", "DESC"],
        ],
      });

    // =========================================================
    // 7. GPS JUMP VALIDATION
    // =========================================================

    let calculatedSpeed = null;
    let distanceFromPrevious = null;

    if (lastLog) {
      const previousLat =
        Number(lastLog.latitude);

      const previousLng =
        Number(lastLog.longitude);

      const previousTime =
        new Date(
          lastLog.recorded_at
        ).getTime();

      const currentTime =
        recorded_at
          ? new Date(
              recorded_at
            ).getTime()
          : Date.now();

      const elapsedSeconds =
        Math.max(
          currentTime -
            previousTime,
          1000
        ) / 1000;

      // Haversine distance
      distanceFromPrevious =
        calculateDistance(
          previousLat,
          previousLng,
          lat,
          lng
        );

      // meters / second
      calculatedSpeed =
        distanceFromPrevious /
        elapsedSeconds;

      /**
       * Reject obvious GPS jumps.
       *
       * 100 m/s = 360 km/h.
       *
       * This is deliberately generous so normal
       * vehicle movement isn't rejected.
       */
      if (
        distanceFromPrevious > 1000 &&
        calculatedSpeed > 100
      ) {
        console.warn(
          "[Location] GPS jump rejected",
          {
            employeeId: employee.id,
            attendanceId:
              attendance.id,
            distance:
              distanceFromPrevious,
            speed:
              calculatedSpeed,
          }
        );

        return res.json(
          new ApiResponse(
            200,
            {
              skipped: true,
              reason:
                "gps_jump",
              distance:
                Math.round(
                  distanceFromPrevious
                ),
              calculatedSpeed:
                Number(
                  calculatedSpeed.toFixed(
                    2
                  )
                ),
            },
            "Location skipped because of an abnormal GPS jump"
          )
        );
      }
    }

    // =========================================================
    // 8. PREPARE OPTIONAL GPS DATA
    // =========================================================

    let gpsAltitude = null;
    let gpsHeading = null;
    let gpsSpeed = null;

    if (
      altitude !== undefined &&
      altitude !== null &&
      altitude !== ""
    ) {
      const value =
        Number(altitude);

      if (
        Number.isFinite(value)
      ) {
        gpsAltitude = value;
      }
    }

    if (
      heading !== undefined &&
      heading !== null &&
      heading !== ""
    ) {
      const value =
        Number(heading);

      if (
        Number.isFinite(value)
      ) {
        gpsHeading = value;
      }
    }

    if (
      speed !== undefined &&
      speed !== null &&
      speed !== ""
    ) {
      const value =
        Number(speed);

      if (
        Number.isFinite(value) &&
        value >= 0
      ) {
        gpsSpeed = value;
      }
    }

    // =========================================================
    // 9. RECORD TIME
    // =========================================================

    const now = moment()
      .tz("Asia/Kolkata");

    let recordedAt =
      now.toDate();

    /**
     * Use mobile GPS timestamp if supplied
     * and it is valid.
     */
    if (recorded_at) {
      const parsedDate =
        new Date(recorded_at);

      if (
        !Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        /**
         * Don't accept a timestamp too far
         * in the future.
         */
        const maxFuture =
          Date.now() + 60_000;

        if (
          parsedDate.getTime() <=
          maxFuture
        ) {
          recordedAt =
            parsedDate;
        }
      }
    }

    // =========================================================
    // 10. CREATE LOCATION LOG
    // =========================================================

    /**
     * IMPORTANT:
     *
     * There is intentionally NO 20-second debounce here.
     *
     * Your mobile app can now send approximately
     * every 5 seconds / 5 meters.
     */

    const locationData = {
      attendance_id:
        attendance.id,

      employee_id:
        employee.id,

      latitude: lat,

      longitude: lng,

      address:
        address || null,

      accuracy_meters:
        gpsAccuracy,

      source: "periodic",

      recorded_at:
        recordedAt,
    };

    /**
     * Only add these fields if your model/database
     * actually contains these columns.
     *
     * See the note below.
     */

    if (
      AttendanceLocationLog.rawAttributes
        ?.altitude !== undefined
    ) {
      locationData.altitude =
        gpsAltitude;
    }

    if (
      AttendanceLocationLog.rawAttributes
        ?.heading !== undefined
    ) {
      locationData.heading =
        gpsHeading;
    }

    if (
      AttendanceLocationLog.rawAttributes
        ?.speed !== undefined
    ) {
      locationData.speed =
        gpsSpeed !== null
          ? gpsSpeed
          : calculatedSpeed;
    }

    if (
      AttendanceLocationLog.rawAttributes
        ?.is_mocked !== undefined
    ) {
      locationData.is_mocked =
        Boolean(is_mocked);
    }

    const log =
      await AttendanceLocationLog.create(
        locationData
      );

    // =========================================================
    // 11. SOCKET.IO LIVE UPDATE
    // =========================================================

    /**
     * If Socket.IO is configured on your Express app,
     * immediately send the new location to the dashboard.
     *
     * This does NOT replace database storage.
     * It provides real-time updates to Leaflet.
     */

    const io =
      req.app.get("io");

    if (io) {
      io.emit(
        "employee-location-update",
        {
          employeeId:
            employee.id,

          attendanceId:
            attendance.id,

          employee: {
            id: employee.id,

            name:
              employee.name ||
              null,
          },

          latitude: lat,

          longitude: lng,

          accuracy:
            gpsAccuracy,

          altitude:
            gpsAltitude,

          heading:
            gpsHeading,

          speed:
            gpsSpeed !== null
              ? gpsSpeed
              : calculatedSpeed,

          distanceFromPrevious,

          recordedAt:
            log.recorded_at,

          source: "periodic",

          isMocked:
            Boolean(is_mocked),
        }
      );
    }

    // =========================================================
    // 12. RESPONSE
    // =========================================================

    return res.json(
      new ApiResponse(
        200,
        {
          id: log.id,

          attendanceId:
            attendance.id,

          employeeId:
            employee.id,

          latitude: lat,

          longitude: lng,

          accuracy:
            gpsAccuracy,

          recordedAt:
            log.recorded_at,

          distanceFromPrevious,

          calculatedSpeed,
        },
        "Location recorded"
      )
    );
  } catch (error) {
    next(error);
  }
},

  // ─── LOCATION TRAIL FOR A GIVEN ATTENDANCE ──────────────────────────────────
  getLocationTrail: async (req, res, next) => {
  try {
    const { attendanceId } = req.params;

    const attendance = await Attendance.findByPk(attendanceId);
    if (!attendance) throw new ApiError(404, 'Attendance record not found');

    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ where: { user_id: req.user.id } });
      if (!employee || attendance.employee_id !== employee.id) {
        throw new ApiError(403, 'Access denied');
      }
    }

    const logs = await AttendanceLocationLog.findAll({
      where: { attendance_id: attendanceId },
      order: [['recorded_at', 'ASC']],
      attributes: ['id', 'latitude', 'longitude', 'address', 'accuracy_meters', 'source', 'recorded_at']
    });

    const points = logs.map(l => ({
      id: l.id,
      latitude: parseFloat(l.latitude),
      longitude: parseFloat(l.longitude),
      address: l.address,
      accuracy_meters: l.accuracy_meters !== null ? parseFloat(l.accuracy_meters) : null,
      source: l.source,
      recorded_at: l.recorded_at
    }));

    res.json(new ApiResponse(200, { attendanceId: attendance.id, points }));
  } catch (error) {
    next(error);
  }
},

  // ─── LIVE LOCATIONS (all employees currently checked in, today) ───────────
  getLiveLocations: async (req, res, next) => {
    try {
      const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
      const companyId = req.user.company_id;

      const employeeWhere = { is_active: true };
      if (companyId) employeeWhere.company_id = companyId;

      const attendances = await Attendance.findAll({
        where: { date: today },
        include: [
          {
            model: Employee,
            as: 'employee',
            where: employeeWhere,
            attributes: ['id', 'employee_code', 'name', 'department', 'designation'],
            include: [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }],
          },
        ],
      });

      const results = [];
      for (const att of attendances) {
        const checkInCount = await Punch.count({ where: { attendance_id: att.id, type: 'check_in' } });
        const checkOutCount = await Punch.count({ where: { attendance_id: att.id, type: 'check_out' } });
        const stillCheckedIn = checkOutCount < checkInCount;

        // Prefer the most recent location log
        const lastLog = await AttendanceLocationLog.findOne({
          where: { attendance_id: att.id },
          order: [['recorded_at', 'DESC']],
        });

        let latitude, longitude, lastUpdated, source;
        if (lastLog) {
          latitude = lastLog.latitude;
          longitude = lastLog.longitude;
          lastUpdated = lastLog.recorded_at;
          source = lastLog.source;
        } else {
          const lastCheckIn = await Punch.findOne({
            where: { attendance_id: att.id, type: 'check_in' },
            order: [['time', 'DESC']],
          });
          if (lastCheckIn) {
            latitude = lastCheckIn.latitude;
            longitude = lastCheckIn.longitude;
            lastUpdated = lastCheckIn.time;
            source = 'checkin';
          }
        }

        if (latitude == null || longitude == null) continue;

        results.push({
  attendanceId: att.id,
  employeeId: att.employee.id,
  employeeCode: att.employee.employee_code,
  name: att.employee.name,
  department: att.employee.department,
  designation: att.employee.designation,
  branchName: att.employee.branch?.name || null,
  status: stillCheckedIn ? 'checked_in' : 'checked_out',
  latitude: parseFloat(latitude),
  longitude: parseFloat(longitude),
  lastUpdated,
  source,
});
      }

      res.json(new ApiResponse(200, { date: today, employees: results }));
    } catch (error) {
      next(error);
    }
  },
};

// Helper function: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
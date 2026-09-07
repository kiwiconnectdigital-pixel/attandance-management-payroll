// controllers/attendance.controller.js - Sequelize Version
const { Attendance, AttendanceLocationLog, Punch, Employee, Branch, User, sequelize } = require('../models');
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

module.exports = {
  // ─── CHECK IN ─────────────────────────────────────────────────────────────
  checkIn: async (req, res, next) => {
    try {
      const { latitude, longitude, address, branchId } = req.body;

      // Get employee with company info
      const employee = await Employee.findOne({
        where: { user_id: req.user.id, is_active: true },
        include: [
          { model: User, as: 'user', attributes: ['id', 'email'] },
          { model: Branch, as: 'branch', attributes: ['id', 'name'] }
        ]
      });

      if (!employee) throw new ApiError(404, 'Employee record not found');

      // ── Face verification ──────────────────────────────────────────────
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

      // ── Location / geofence ────────────────────────────────────────────
      if (!latitude || !longitude) {
        throw new ApiError(400, 'Location (latitude & longitude) is required');
      }
      if (!branchId) throw new ApiError(400, 'Please select a branch for check-in');

      const branch = await Branch.findOne({
        where: { id: branchId, company_id: employee.company_id, is_active: true }
      });
      if (!branch) throw new ApiError(404, 'Selected branch not found');

      // Check geofence
      if (branch.geofence_enabled && branch.geofence_latitude && branch.geofence_longitude) {
        const dist = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          branch.geofence_latitude,
          branch.geofence_longitude
        );
        if (dist > branch.geofence_radius_meters) {
          throw new ApiError(403, `You are outside the allowed geofence (${dist.toFixed(0)}m away)`);
        }
      }

      // ── Late calculation ───────────────────────────────────────────────
      const checkInTime = moment().tz('Asia/Kolkata');
      const workStartHour = employee.work_start_hour ?? DEFAULT_WORK_START_HOUR;
      const workStartMinute = employee.work_start_minute ?? DEFAULT_WORK_START_MINUTE;
      const lateThreshold = employee.late_threshold_minutes ?? 0;
      const lateInfo = isLate(checkInTime.toDate(), workStartHour, workStartMinute, lateThreshold);

      // ── Get or create attendance record ──────────────────────────────
      const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
      
      let attendance = await Attendance.findOne({
        where: { employee_id: employee.id, date: today }
      });

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

      // ── Insert check-in punch ─────────────────────────────────────────
      const selfiePath = req.file.path.replace(/\\/g, '/');
      const punch = await Punch.create({
        attendance_id: attendance.id,
        type: 'check_in',
        time: checkInTime.toDate(),
        selfie: selfiePath,
        branch_id: branchId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address,
        face_match_score: parseFloat(distance.toFixed(4)),
        face_verified: true,
        is_late: lateInfo.isLate,
        late_by_minutes: lateInfo.minutes
      });

      // ── Log check-in location (start of trail) ─────────────────────────
      await AttendanceLocationLog.create({
        attendance_id: attendance.id,
        employee_id: employee.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || null,
        source: 'checkin',
        recorded_at: checkInTime.toDate()
      });

      const statusNote = lateInfo.isLate
        ? `Late by ${lateInfo.minutes}m${lateInfo.minutes >= 30 ? ' — marked half-day' : ''}`
        : 'On time';

      res.json(new ApiResponse(
        200,
        { attendanceId: attendance.id, checkInTime: checkInTime.format('HH:mm:ss') },
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

      if (checkOutCount >= checkInCount) {
        throw new ApiError(400, 'Please check in before checking out again');
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

      // ── Location / geofence ────────────────────────────────────────────
      if (!latitude || !longitude) {
        throw new ApiError(400, 'Location (latitude & longitude) is required');
      }
      if (!branchId) throw new ApiError(400, 'Please select a branch for check-out');

      const branch = await Branch.findOne({
        where: { id: branchId, company_id: employee.company_id, is_active: true }
      });
      if (!branch) throw new ApiError(404, 'Selected branch not found');

      if (branch.geofence_enabled && branch.geofence_latitude && branch.geofence_longitude) {
        const dist = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          branch.geofence_latitude,
          branch.geofence_longitude
        );
        if (dist > branch.geofence_radius_meters) {
          throw new ApiError(403, `You are outside the allowed geofence (${dist.toFixed(0)}m away)`);
        }
      }

      // ── Insert check-out punch ────────────────────────────────────────
      const checkOutTime = moment().tz('Asia/Kolkata');
      const selfiePath = req.file.path.replace(/\\/g, '/');
      
      const punch = await Punch.create({
        attendance_id: attendance.id,
        type: 'check_out',
        time: checkOutTime.toDate(),
        selfie: selfiePath,
        branch_id: branchId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address,
        face_match_score: parseFloat(distance.toFixed(4)),
        face_verified: true
      });

      // ── Log check-out location (end of trail) ───────────────────────────
      await AttendanceLocationLog.create({
        attendance_id: attendance.id,
        employee_id: employee.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || null,
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
        { attendanceId: attendance.id, workingHours, overtimeHours },
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
        record.dataValues.checkIns = punches.filter(p => p.type === 'check_in');
        record.dataValues.checkOuts = punches.filter(p => p.type === 'check_out');
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
      attendance.dataValues.checkIns = punches.filter(p => p.type === 'check_in');
      attendance.dataValues.checkOuts = punches.filter(p => p.type === 'check_out');

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
          location: { latitude: p.latitude, longitude: p.longitude, address: p.address },
          isLate: p.is_late === 1,
          lateByMinutes: p.late_by_minutes,
          branchName: p.branch?.name || null
        }));
        
        record.dataValues.checkOuts = punches.filter(p => p.type === 'check_out').map(p => ({
          time: p.time,
          selfie: p.selfie,
          location: { latitude: p.latitude, longitude: p.longitude, address: p.address },
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

// ─── LOCATION PING (called every ~10 min while checked in) ────────────────
trackLocation: async (req, res, next) => {
  try {
    const { latitude, longitude, address, accuracy } = req.body;
    if (!latitude || !longitude) {
      throw new ApiError(400, 'Location (latitude & longitude) is required');
    }

    const employee = await Employee.findOne({
      where: { user_id: req.user.id, is_active: true }
    });
    if (!employee) throw new ApiError(404, 'Employee record not found');

    const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    const attendance = await Attendance.findOne({
      where: { employee_id: employee.id, date: today }
    });
    if (!attendance) throw new ApiError(400, 'You are not checked in today');

    // Only accept pings while an open (not-yet-checked-out) session exists
    const checkInCount = await Punch.count({ where: { attendance_id: attendance.id, type: 'check_in' } });
    const checkOutCount = await Punch.count({ where: { attendance_id: attendance.id, type: 'check_out' } });
    if (checkOutCount >= checkInCount) {
      throw new ApiError(400, 'You are currently checked out — location tracking is not active');
    }

    // Debounce: ignore pings that arrive well under the 10-min interval
    // (protects against client retries / clock drift)
    const lastLog = await AttendanceLocationLog.findOne({
      where: { attendance_id: attendance.id },
      order: [['recorded_at', 'DESC']]
    });
    const now = moment().tz('Asia/Kolkata');
    if (lastLog && now.diff(moment(lastLog.recorded_at), 'minutes') < 8) {
      return res.json(new ApiResponse(200, { skipped: true }, 'Ping too soon, previous log still fresh'));
    }

    const log = await AttendanceLocationLog.create({
      attendance_id: attendance.id,
      employee_id: employee.id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || null,
      accuracy_meters: accuracy ? parseFloat(accuracy) : null,
      source: 'periodic',
      recorded_at: now.toDate()
    });

    res.json(new ApiResponse(200, { id: log.id, recordedAt: log.recorded_at }, 'Location recorded'));
  } catch (error) {
    next(error);
  }
},

// ─── LOCATION TRAIL FOR A GIVEN ATTENDANCE (for reports) ──────────────────
getLocationTrail: async (req, res, next) => {
  try {
    const { attendanceId } = req.params;

    const attendance = await Attendance.findByPk(attendanceId);
    if (!attendance) throw new ApiError(404, 'Attendance record not found');

    // Access check for employees viewing their own trail
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

    res.json(new ApiResponse(200, { attendanceId: attendance.id, points: logs }));
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

      // Prefer the most recent location log (covers periodic pings too),
      // fall back to the last check-in punch's coordinates.
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

      if (latitude == null || longitude == null) continue; // nothing to plot

      results.push({
        attendanceId: att.id,
        employeeId: att.employee.id,
        employeeCode: att.employee.employee_code,
        name: att.employee.name,
        department: att.employee.department,
        designation: att.employee.designation,
        branchName: att.employee.branch?.name || null,
        status: stillCheckedIn ? 'checked_in' : 'checked_out',
        latitude,
        longitude,
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
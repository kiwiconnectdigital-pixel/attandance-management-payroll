const Employee = require('../models/Employee.model');
const User = require('../models/User.model');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const bcrypt = require('bcryptjs');
const path = require('path');
const { getFaceDescriptor } = require('../services/faceVerification.service');

module.exports = {
// @route GET /api/v1/employees
 getEmployees : async (req, res, next) => {
  try {
    const { branch, department, isActive, search, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (branch) filter.branch = branch;
    if (department) filter.department = department;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeCode: { $regex: search, $options: 'i' } },
      ];
    }
    
    // HR and employees can only see their own branch
    if (req.user.role === 'employee') {
      const emp = await Employee.findOne({ user: req.user._id });
      if (emp) filter.branch = emp.branch;
    }
    
    const skip = (page - 1) * limit;
    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate('branch', 'name city')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Employee.countDocuments(filter),
    ]);
    
    res.json(new ApiResponse(200, {
      employees,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    next(error);
  }
},

// @route GET /api/v1/employees/:id
 getEmployee :  async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('branch');
    if (!employee) throw new ApiError(404, 'Employee not found');
    res.json(new ApiResponse(200, employee));
  } catch (error) {
    next(error);
  }
},

// @route POST /api/v1/employees
 createEmployee : async (req, res, next) => {
  try {
    const {
      name, email, phone, department, designation,
      branch, dateOfJoining, panNumber, aadharNumber,
    } = req.body;

    const salary        = JSON.parse(req.body.salary        || '{"basic":0}');
    const bankDetails   = JSON.parse(req.body.bankDetails   || '{}');
    // ── Parse workStartTime — supports both JSON string and flat fields ──────
    let workStartTime = { hour: 9, minute: 0 };
    if (req.body.workStartTime) {
      const parsed = JSON.parse(req.body.workStartTime);
      workStartTime = {
        hour:   Math.min(23, Math.max(0, parseInt(parsed.hour   ?? 9,  10))),
        minute: Math.min(59, Math.max(0, parseInt(parsed.minute ?? 0,  10))),
      };
    }
    // ────────────────────────────────────────────────────────────────────────

    const existingEmp  = await Employee.findOne({ email });
    if (existingEmp)  throw new ApiError(400, 'Employee with this email already exists');

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new ApiError(400, 'A user account with this email already exists');

    // ── Face descriptor ──────────────────────────────────────────────────────
    let faceDescriptor = null;
    if (req.file) {
      const descriptor = await getFaceDescriptor(req.file.path);
      if (!descriptor) {
        throw new ApiError(400, 'No face detected in the uploaded photo. Please use a clear frontal face photo.');
      }
      faceDescriptor = Array.from(descriptor);
    }
    // ────────────────────────────────────────────────────────────────────────

    const employee = await Employee.create({
      name, email, phone, salary, department, designation,
      branch, dateOfJoining, bankDetails,
      panNumber, aadharNumber,
      workStartTime,                                          // ← new
      profileImage:   req.file ? req.file.path.replace(/\\/g, '/') : null,
      faceDescriptor,
    });

   const emailPrefix = email.split('@')[0];
const tempPassword = `Emp@${emailPrefix}`;


    const user = await User.create({
      name, email,
      password: tempPassword,
      role: 'employee',
      employeeId: employee._id,
      isActive: true,
    });

    employee.user = user._id;
    await employee.save();

    const { hour, minute } = workStartTime;
    const shiftLabel = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

    console.log(`\n✅ Employee Created`);
    console.log(`   Name:       ${name}`);
    console.log(`   Email:      ${email}`);
    console.log(`   Password:   ${tempPassword}`);
    console.log(`   Role:       employee`);
    console.log(`   Shift start: ${shiftLabel}\n`);          // ← new

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        employee,
        credentials: { email, tempPassword, role: 'employee' },
      },
    });
  } catch (error) {
    next(error);
  }
},
// @route PUT /api/v1/employees/:id
 updateEmployee: async (req, res, next) => {
  try {
    const updateData = { ...req.body };

    // ✅ Parse salary
    if (req.body.salary) {
      updateData.salary = JSON.parse(req.body.salary);
    }

    // ✅ Parse bankDetails
    if (req.body.bankDetails) {
      updateData.bankDetails = JSON.parse(req.body.bankDetails);
    }

    // ✅ Parse workStartTime (CRITICAL FIX)
    if (req.body.workStartTime) {
      const parsed = JSON.parse(req.body.workStartTime);

      updateData.workStartTime = {
        hour: Math.min(23, Math.max(0, parseInt(parsed.hour ?? 9, 10))),
        minute: Math.min(59, Math.max(0, parseInt(parsed.minute ?? 0, 10))),
      };
    }

    // ✅ Image
    if (req.file) {
      updateData.profileImage = req.file.path.replace(/\\/g, '/');
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('branch');

    if (!employee) throw new ApiError(404, 'Employee not found');

    res.json(new ApiResponse(200, employee, 'Employee updated'));
  } catch (error) {
    next(error);
  }
},

// @route DELETE /api/v1/employees/:id (soft delete)
 deleteEmployee : async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!employee) throw new ApiError(404, 'Employee not found');
    res.json(new ApiResponse(200, null, 'Employee deactivated'));
  } catch (error) {
    next(error);
  }
},

}


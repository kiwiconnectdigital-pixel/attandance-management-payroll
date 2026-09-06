// controllers/employee.controller.js - Sequelize Version
const { Employee, User, Branch, Company, sequelize } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const bcrypt = require('bcryptjs');
const { getFaceDescriptor } = require('../services/faceVerification.service');
const { Op } = require('sequelize');

module.exports = {
  // @route GET /api/v1/employees
  getEmployees: async (req, res, next) => {
    try {
      const { branch, department, isActive, search, page = 1, limit = 20 } = req.query;

      const where = {};
      const include = [
        {
          model: Branch,
          as: 'branch',
          attributes: ['id', 'name', 'code']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'role']
        }
      ];

      // Company filtering based on user role
      if (req.user.role === 'company_admin' || req.user.role === 'hr') {
        where.company_id = req.user.company_id;
      } else if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ where: { user_id: req.user.id } });
        if (emp) {
          where.branch_id = emp.branch_id;
        }
      }

      if (branch) {
        where.branch_id = branch;
      }
      if (department) {
        where.department = department;
      }
      if (isActive !== undefined) {
        where.is_active = isActive === 'true';
      }
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { employee_code: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: employees } = await Employee.findAndCountAll({
        where,
        include,
        attributes: { exclude: ['face_descriptor'] },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      res.json(new ApiResponse(200, {
        employees,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/employees/:id
  getEmployee: async (req, res, next) => {
    try {
      const employee = await Employee.findByPk(req.params.id, {
        include: [
          {
            model: Branch,
            as: 'branch',
            attributes: ['id', 'name', 'code']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'role']
          }
        ],
        attributes: { exclude: ['face_descriptor'] }
      });

      if (!employee) {
        throw new ApiError(404, 'Employee not found');
      }

      // Check access
      if (req.user.role === 'employee') {
        const emp = await Employee.findOne({ where: { user_id: req.user.id } });
        if (!emp || emp.id !== parseInt(req.params.id)) {
          throw new ApiError(403, 'Access denied');
        }
      }

      res.json(new ApiResponse(200, employee));
    } catch (error) {
      next(error);
    }
  },

  // @route POST /api/v1/employees
  createEmployee: async (req, res, next) => {
    try {
      const {
        name, email, phone, department, designation,
        branchId, dateOfJoining, dateOfBirth, gender,
        address, panNumber, aadharNumber,
        salaryBasic, salaryHra, salaryDa, salaryTa,
        workStartHour, workStartMinute, lateThresholdMinutes,
        bankAccountNumber, bankName, bankIfscCode,
        pfNumber, esicNumber, uanNumber
      } = req.body;

      const companyId = req.user.company_id || req.body.companyId;

      // Check if employee with this email already exists
      const existingEmp = await Employee.findOne({
        where: { email, company_id: companyId }
      });
      if (existingEmp) {
        throw new ApiError(400, 'Employee with this email already exists');
      }

      // Check if user account exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        throw new ApiError(400, 'A user account with this email already exists');
      }

      // Process face descriptor if photo uploaded
      let faceDescriptor = null;
      let profileImage = null;
      if (req.file) {
        const descriptor = await getFaceDescriptor(req.file.path);
        if (!descriptor) {
          throw new ApiError(400, 'No face detected in the uploaded photo. Please use a clear frontal face photo.');
        }
        faceDescriptor = Array.from(descriptor);
        profileImage = req.file.path.replace(/\\/g, '/');
      }

      // Create employee with transaction
      const result = await sequelize.transaction(async (t) => {
        // Create employee
        const employee = await Employee.create({
          company_id: companyId,
          branch_id: branchId,
          name,
          email,
          phone,
          department,
          designation,
          date_of_joining: dateOfJoining,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
          address: address || null,
          profile_image: profileImage,
          face_descriptor: faceDescriptor ? JSON.stringify(faceDescriptor) : null,
          photo: profileImage,
          salary_basic: parseFloat(salaryBasic) || 0,
          salary_hra: parseFloat(salaryHra) || 0,
          salary_da: parseFloat(salaryDa) || 0,
          salary_ta: parseFloat(salaryTa) || 0,
          work_start_hour: parseInt(workStartHour) || 9,
          work_start_minute: parseInt(workStartMinute) || 0,
          late_threshold_minutes: parseInt(lateThresholdMinutes) || 0,
          bank_account_number: bankAccountNumber || null,
          bank_name: bankName || null,
          bank_ifsc_code: bankIfscCode || null,
          pan_number: panNumber || null,
          aadhar_number: aadharNumber || null,
          pf_number: pfNumber || null,
          esic_number: esicNumber || null,
          uan_number: uanNumber || null,
          is_active: true
        }, { transaction: t });

        // Create user account
        const emailPrefix = email.split('@')[0];
        const tempPassword = `Emp@${emailPrefix}`;

        const user = await User.create({
          company_id: companyId,
          name,
          email,
          password: tempPassword,
          role: 'employee',
          is_active: true
        }, { transaction: t });

        // Update employee with user_id
        await employee.update({ user_id: user.id }, { transaction: t });

        return { employee, user, tempPassword };
      });

      const employee = await Employee.findByPk(result.employee.id, {
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: User, as: 'user', attributes: ['id', 'email'] }
        ]
      });

      const shiftLabel = `${String(parseInt(workStartHour) || 9).padStart(2,'0')}:${String(parseInt(workStartMinute) || 0).padStart(2,'0')}`;

      console.log(`\n✅ Employee Created`);
      console.log(`   Name:               ${name}`);
      console.log(`   Email:              ${email}`);
      console.log(`   Password:           ${result.tempPassword}`);
      console.log(`   Role:               employee`);
      console.log(`   Shift start:        ${shiftLabel}`);
      console.log(`   Late threshold:     ${parseInt(lateThresholdMinutes) || 0} min\n`);

      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: {
          employee,
          credentials: { email, tempPassword: result.tempPassword, role: 'employee' },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // @route PUT /api/v1/employees/:id
  updateEmployee: async (req, res, next) => {
    try {
      const { id } = req.params;

      const employee = await Employee.findByPk(id);
      if (!employee) {
        throw new ApiError(404, 'Employee not found');
      }

      const updateData = {};

      const fields = [
        'name', 'phone', 'department', 'designation',
        'date_of_joining', 'date_of_birth', 'gender', 'address',
        'salary_basic', 'salary_hra', 'salary_da', 'salary_ta',
        'work_start_hour', 'work_start_minute', 'late_threshold_minutes',
        'bank_account_number', 'bank_name', 'bank_ifsc_code',
        'pan_number', 'aadhar_number', 'pf_number', 'esic_number', 'uan_number',
        'branch_id', 'is_active'
      ];

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (req.file) {
        updateData.profile_image = req.file.path.replace(/\\/g, '/');
        // Also update face descriptor
        const descriptor = await getFaceDescriptor(req.file.path);
        if (descriptor) {
          updateData.face_descriptor = JSON.stringify(Array.from(descriptor));
        }
      }

      await employee.update(updateData);

      const updated = await Employee.findByPk(id, {
        include: [
          { model: Branch, as: 'branch', attributes: ['id', 'name'] },
          { model: User, as: 'user', attributes: ['id', 'email'] }
        ],
        attributes: { exclude: ['face_descriptor'] }
      });

      res.json(new ApiResponse(200, updated, 'Employee updated'));
    } catch (error) {
      next(error);
    }
  },

  // @route DELETE /api/v1/employees/:id (soft delete)
  deleteEmployee: async (req, res, next) => {
    try {
      const { id } = req.params;

      const employee = await Employee.findByPk(id);
      if (!employee) {
        throw new ApiError(404, 'Employee not found');
      }

      await employee.update({ is_active: false });

      // Also deactivate user
      if (employee.user_id) {
        await User.update({ is_active: false }, { where: { id: employee.user_id } });
      }

      res.json(new ApiResponse(200, null, 'Employee deactivated'));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/employees/me
  getMyProfile: async (req, res, next) => {
    try {
      const employee = await Employee.findOne({
        where: { user_id: req.user.id },
        include: [
          {
            model: Branch,
            as: 'branch',
            attributes: ['id', 'name', 'code']
          },
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'code']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email']
          }
        ],
        attributes: { exclude: ['face_descriptor'] }
      });

      if (!employee) {
        throw new ApiError(404, 'Employee profile not found');
      }

      res.json(new ApiResponse(200, employee));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/employees/leave-balance
  getLeaveBalance: async (req, res, next) => {
    try {
      const employee = await Employee.findOne({
        where: { user_id: req.user.id },
        attributes: ['id', 'leave_balance_cl', 'leave_balance_sl', 'leave_balance_pl']
      });

      if (!employee) {
        throw new ApiError(404, 'Employee not found');
      }

      res.json(new ApiResponse(200, {
        CL: employee.leave_balance_cl || 12,
        SL: employee.leave_balance_sl || 12,
        PL: employee.leave_balance_pl || 15
      }));
    } catch (error) {
      next(error);
    }
  }
};
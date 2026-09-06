// controllers/auth.controller.js - With Debug Logging
const jwt = require("jsonwebtoken");
const { User, Employee, Company, sequelize } = require('../models');
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

module.exports = {
  // @route POST /api/v1/auth/login
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      console.log('🔐 Login attempt for email:', email);
      console.log('📝 Password provided:', password ? 'Yes (length: ' + password.length + ')' : 'No');

      // Check if user exists with password
      const user = await User.scope('withPassword').findOne({
        where: { email: email.trim(), is_active: true }
      });

      console.log('👤 User found:', user ? 'Yes' : 'No');

      if (!user) {
        console.log('❌ User not found for email:', email);
        throw new ApiError(401, "Invalid email or password");
      }

      console.log('📧 User email:', user.email);
      console.log('🔑 Stored password hash:', user.password ? user.password.substring(0, 30) + '...' : 'No password');
      console.log('👤 User role:', user.role);
      console.log('✅ User active:', user.is_active);

      // Compare password
      const isPasswordValid = await user.comparePassword(password);
      console.log('🔐 Password valid:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('❌ Invalid password for email:', email);
        throw new ApiError(401, "Invalid email or password");
      }

      console.log('✅ Password valid for:', email);

      // Update last login
      await user.update({ last_login: new Date() });

      const token = generateToken(user.id);
      console.log('🎫 Token generated for user:', user.id);
      
      // Remove password from response
      const userData = user.toJSON();
      delete userData.password;

      console.log('✅ Login successful for:', email);

      res.json(new ApiResponse(200, { user: userData, token }, "Login successful"));
    } catch (error) {
      console.error('❌ Login error:', error.message);
      console.error('Stack:', error.stack);
      next(error);
    }
  },

  // @route POST /api/v1/auth/register (Super Admin only)
  register: async (req, res, next) => {
    try {
      const { name, email, password, role, companyId } = req.body;

      // Check if user already exists
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        throw new ApiError(400, "User with this email already exists");
      }

      const user = await User.create({
        name,
        email,
        password,
        role: role || 'employee',
        company_id: companyId || null,
        is_active: true
      });

      const token = generateToken(user.id);

      res.status(201).json(
        new ApiResponse(201, { user, token }, "User created")
      );
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/auth/me
  getMe: async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'employee_code', 'designation', 'department']
          },
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'code']
          }
        ]
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      res.json(new ApiResponse(200, user));
    } catch (error) {
      next(error);
    }
  },

  // @route PUT /api/v1/auth/change-password
  changePassword: async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.scope('withPassword').findByPk(req.user.id);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new ApiError(401, "Current password is incorrect");
      }

      user.password = newPassword;
      await user.save();

      res.json(new ApiResponse(200, null, "Password updated successfully"));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/auth/companies (Super Admin only)
  getCompanies: async (req, res, next) => {
    try {
      if (req.user.role !== 'super_admin') {
        throw new ApiError(403, "Access denied");
      }

      const companies = await Company.findAll({
        attributes: {
          include: [
            [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('users.id'))), 'admin_count'],
            [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('employees.id'))), 'employee_count']
          ]
        },
        include: [
          { model: User, as: 'users', attributes: [], where: { role: 'company_admin' }, required: false },
          { model: Employee, as: 'employees', attributes: [], required: false }
        ],
        group: ['companies.id'],
        order: [['name', 'ASC']]
      });

      res.json(new ApiResponse(200, companies));
    } catch (error) {
      next(error);
    }
  },

  // @route POST /api/v1/auth/companies (Super Admin only)
  createCompany: async (req, res, next) => {
    try {
      if (req.user.role !== 'super_admin') {
        throw new ApiError(403, "Access denied");
      }

      const { name, code, email, phone, address, city, state, pincode, gstNumber, panNumber } = req.body;

      // Check if company code or email already exists
      const existing = await Company.findOne({
        where: { [Op.or]: [{ code }, { email }] }
      });
      if (existing) {
        throw new ApiError(400, "Company with this code or email already exists");
      }

      const company = await Company.create({
        name,
        code,
        email,
        phone,
        address,
        city,
        state,
        pincode,
        gst_number: gstNumber,
        pan_number: panNumber,
        is_active: true
      });

      res.status(201).json(new ApiResponse(201, company, "Company created successfully"));
    } catch (error) {
      next(error);
    }
  },

  // @route POST /api/v1/auth/company-admin (Super Admin only)
  createCompanyAdmin: async (req, res, next) => {
    try {
      if (req.user.role !== 'super_admin') {
        throw new ApiError(403, "Access denied");
      }

      const { companyId, name, email, password } = req.body;

      // Check if company exists
      const company = await Company.findByPk(companyId);
      if (!company) {
        throw new ApiError(404, "Company not found");
      }

      // Check if user already exists
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        throw new ApiError(400, "User with this email already exists");
      }

      const user = await User.create({
        company_id: companyId,
        name,
        email,
        password,
        role: 'company_admin',
        is_active: true
      });

      res.status(201).json(
        new ApiResponse(201, user, "Company admin created successfully")
      );
    } catch (error) {
      next(error);
    }
  },

  // @route POST /api/v1/auth/create-test-user
  createTestUser: async (req, res, next) => {
    try {
      const { email, password, name, role } = req.body;

      // Check if user already exists
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.json(new ApiResponse(200, { message: "User already exists", user: existing }));
      }

      const user = await User.create({
        name: name || 'Test User',
        email,
        password,
        role: role || 'company_admin',
        is_active: true
      });

      res.status(201).json(new ApiResponse(201, { 
        message: "Test user created", 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        password: password
      }, "Test user created successfully"));
    } catch (error) {
      next(error);
    }
  }
};
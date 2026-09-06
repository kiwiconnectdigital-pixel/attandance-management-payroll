// controllers/user.controller.js - FIXED with correct field names
const { User, Company, sequelize } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

module.exports = {
  // @route GET /api/v1/users
  getAllUsers: async (req, res, next) => {
    try {
      const { role } = req.query;
      const whereClause = {
        is_deleted: false
      };

      if (role) {
        const roles = role.split(',');
        whereClause.role = {
          [Op.in]: roles
        };
      }

      const users = await User.findAll({
        where: whereClause,
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'code']
          }
        ],
        attributes: {
          exclude: ['password']
        },
        order: [['name', 'ASC']]
      });

      res.json(new ApiResponse(200, users, 'Users retrieved successfully'));
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      next(error);
    }
  },

  // @route GET /api/v1/users/:id
  getUserById: async (req, res, next) => {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'code']
          }
        ],
        attributes: {
          exclude: ['password']
        }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      res.json(new ApiResponse(200, user, 'User retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },

  // @route POST /api/v1/users
  createUser: async (req, res, next) => {
    try {
      // ✅ FIX: Use company_id (snake_case) not companyId
      const { name, email, password, role, company_id } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        throw new ApiError(400, 'Name, email and password are required');
      }

      if (password.length < 6) {
        throw new ApiError(400, 'Password must be at least 6 characters');
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email }
      });

      if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // ✅ FIX: Use company_id (snake_case)
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: role || 'company_admin',
        company_id: company_id || null,
        is_active: true,
        is_deleted: false
      });

      // Remove password from response
      const userResponse = user.toJSON();
      delete userResponse.password;

      res.status(201).json(new ApiResponse(201, userResponse, 'User created successfully'));
    } catch (error) {
      next(error);
    }
  },

  // @route PUT /api/v1/users/:id
  updateUser: async (req, res, next) => {
    try {
      // ✅ FIX: Use company_id (snake_case)
      const { name, email, role, company_id, is_active } = req.body;
      const userId = req.params.id;

      const user = await User.findByPk(userId);

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if email is being changed and already exists
      if (email && email !== user.email) {
        const existingUser = await User.findOne({
          where: { email }
        });
        if (existingUser) {
          throw new ApiError(400, 'Email already in use');
        }
      }

      // ✅ FIX: Use company_id (snake_case)
      await user.update({
        name: name || user.name,
        email: email || user.email,
        role: role || user.role,
        company_id: company_id !== undefined ? company_id : user.company_id,
        is_active: is_active !== undefined ? is_active : user.is_active
      });

      const updatedUser = await User.findByPk(userId, {
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'code']
          }
        ],
        attributes: {
          exclude: ['password']
        }
      });

      res.json(new ApiResponse(200, updatedUser, 'User updated successfully'));
    } catch (error) {
      next(error);
    }
  },

  // @route PATCH /api/v1/users/:id/status
  updateUserStatus: async (req, res, next) => {
    try {
      const { is_active } = req.body;

      if (is_active === undefined) {
        throw new ApiError(400, 'is_active field is required');
      }

      const user = await User.findByPk(req.params.id);

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      await user.update({ is_active });

      res.json(new ApiResponse(200, {
        id: user.id,
        name: user.name,
        is_active: user.is_active
      }, `User ${is_active ? 'activated' : 'deactivated'} successfully`));
    } catch (error) {
      next(error);
    }
  },

  // @route POST /api/v1/users/:id/reset-password
  resetPassword: async (req, res, next) => {
    try {
      const { password } = req.body;

      if (!password) {
        throw new ApiError(400, 'Password is required');
      }

      if (password.length < 6) {
        throw new ApiError(400, 'Password must be at least 6 characters');
      }

      const user = await User.findByPk(req.params.id);

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await user.update({ password: hashedPassword });

      res.json(new ApiResponse(200, null, 'Password reset successfully'));
    } catch (error) {
      next(error);
    }
  },

  // @route DELETE /api/v1/users/:id
  deleteUser: async (req, res, next) => {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Soft delete
      await user.update({ is_deleted: true });

      res.json(new ApiResponse(200, null, 'User deleted successfully'));
    } catch (error) {
      next(error);
    }
  },

  // @route GET /api/v1/users/stats
  getUserStats: async (req, res, next) => {
    try {
      const stats = await User.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN role = "company_admin" THEN 1 END')), 'adminCount'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN role = "hr" THEN 1 END')), 'hrCount'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN role = "employee" THEN 1 END')), 'employeeCount'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_active = true THEN 1 END')), 'activeCount'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_active = false THEN 1 END')), 'inactiveCount'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCount']
        ],
        where: {
          is_deleted: false
        },
        raw: true
      });

      res.json(new ApiResponse(200, stats[0] || {
        adminCount: 0,
        hrCount: 0,
        employeeCount: 0,
        activeCount: 0,
        inactiveCount: 0,
        totalCount: 0
      }, 'User statistics retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
};
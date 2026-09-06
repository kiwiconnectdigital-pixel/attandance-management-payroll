// middleware/auth.middleware.js - Sequelize Version
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

module.exports = {
  protect: async (req, res, next) => {
    try {
      let token;

      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
        throw new ApiError(401, 'Not authorized, no token');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'name', 'email', 'role', 'company_id', 'is_active']
      });

      if (!user) {
        throw new ApiError(401, 'User not found');
      }

      if (!user.is_active) {
        throw new ApiError(401, 'User account is deactivated');
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        next(new ApiError(401, 'Invalid token'));
      } else if (error.name === 'TokenExpiredError') {
        next(new ApiError(401, 'Token expired'));
      } else {
        next(error);
      }
    }
  },

  restrictTo: (...roles) => {
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        throw new ApiError(403, 'Access denied');
      }
      next();
    };
  },

  superAdminOnly: (req, res, next) => {
    if (req.user.role !== 'super_admin') {
      throw new ApiError(403, 'Super Admin access required');
    }
    next();
  },

  adminOrHR: (req, res, next) => {
    if (!['company_admin', 'hr'].includes(req.user.role)) {
      throw new ApiError(403, 'Admin or HR access required');
    }
    next();
  },

  adminOnly: (req, res, next) => {
    if (req.user.role !== 'company_admin') {
      throw new ApiError(403, 'Company Admin access required');
    }
    next();
  }
};
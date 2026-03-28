const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const Employee = require('../models/Employee.model');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// @route POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Invalid email or password');
    }
    
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    
    const token = generateToken(user._id);
    
    res.json(new ApiResponse(200, { user, token }, 'Login successful'));
  } catch (error) {
    next(error);
  }
};

// @route POST /api/v1/auth/register (admin only)
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    
    const user = await User.create({ name, email, password, role });
    const token = generateToken(user._id);
    
    res.status(201).json(new ApiResponse(201, { user, token }, 'User created'));
  } catch (error) {
    next(error);
  }
};

// @route GET /api/v1/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('employeeId');
    res.json(new ApiResponse(200, user));
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/v1/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');
    
    if (!(await user.comparePassword(currentPassword))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json(new ApiResponse(200, null, 'Password updated successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = { login, register, getMe, changePassword };
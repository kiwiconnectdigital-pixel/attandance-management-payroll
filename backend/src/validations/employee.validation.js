const { body } = require('express-validator');
const { validate } = require('./auth.validation');

// Re-export the validate runner for use in other validation files
const validationChains = {
  createEmployee: [
    body('name')
      .trim()
      .notEmpty().withMessage('Employee name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),

    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid 10-digit Indian mobile number'),

    body('department')
      .trim()
      .notEmpty().withMessage('Department is required'),

    body('designation')
      .trim()
      .notEmpty().withMessage('Designation is required'),

    body('branch')
      .notEmpty().withMessage('Branch is required')
      .isMongoId().withMessage('Invalid branch ID'),

    body('dateOfJoining')
      .notEmpty().withMessage('Date of joining is required')
      .isISO8601().withMessage('Invalid date format'),

    body('salary')
      .notEmpty().withMessage('Salary details are required')
      .custom((value) => {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsed.basic || parsed.basic < 0) throw new Error('Basic salary is required and must be positive');
        return true;
      }),
  ],

  updateEmployee: [
    body('name').optional().trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

    body('email').optional().trim()
      .isEmail().withMessage('Please provide a valid email').normalizeEmail(),

    body('phone').optional().trim()
      .matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number'),

    body('branch').optional()
      .isMongoId().withMessage('Invalid branch ID'),
  ],
};

// Reuse the same runner pattern from auth.validation
const { body: _b, validationResult } = require('express-validator');

const runValidation = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const validateEmployee = (ruleName) => {
  const chain = validationChains[ruleName];
  if (!chain) throw new Error(`No validation chain defined for: "${ruleName}"`);
  return [...chain, runValidation];
};

module.exports = { validateEmployee };
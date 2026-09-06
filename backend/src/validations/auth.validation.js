const { body, validationResult } = require('express-validator');

/**
 * Reusable validation runner middleware
 * Collects all validation errors and returns a 400 response if any exist
 */
const runValidation = (req, res, next) => {
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

/**
 * Validation chains for each auth route
 */
const validationChains = {

  // ── Login ────────────────────────────────────────────────────────────────
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],

  // ── Register (admin only) ────────────────────────────────────────────────
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address')
      .normalizeEmail(),

    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6, max: 32 }).withMessage('Password must be between 6 and 32 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character (!@#$%^&*)'),

    body('role')
      .notEmpty().withMessage('Role is required')
      .isIn(['company_admin', 'hr', 'employee']).withMessage('Role must be one of: company_admin, hr, employee'),
  ],

  // ── Change Password ───────────────────────────────────────────────────────
  changePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Current password is required'),

    body('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 6, max: 32 }).withMessage('New password must be between 6 and 32 characters')
      .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
      .matches(/[0-9]/).withMessage('New password must contain at least one number')
      .matches(/[!@#$%^&*]/).withMessage('New password must contain at least one special character (!@#$%^&*)')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password must be different from current password');
        }
        return true;
      }),

    body('confirmPassword')
      .notEmpty().withMessage('Please confirm your new password')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],

};

/**
 * Main export: validate(ruleName) returns [validationChain[], runValidation]
 * Usage in routes: router.post('/login', validate('login'), loginController)
 */
const validate = (ruleName) => {
  const chain = validationChains[ruleName];
  if (!chain) throw new Error(`No validation chain defined for: "${ruleName}"`);
  return [...chain, runValidation];
};

module.exports = { validate };
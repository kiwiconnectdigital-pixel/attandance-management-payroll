const { body, query } = require('express-validator');

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

const validationChains = {
  checkIn: [
    body('latitude')
      .notEmpty().withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude value'),

    body('longitude')
      .notEmpty().withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude value'),

    body('address')
      .optional()
      .trim()
      .isLength({ max: 300 }).withMessage('Address too long'),
  ],

  checkOut: [
    body('latitude')
      .notEmpty().withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),

    body('longitude')
      .notEmpty().withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],

  getAttendance: [
    query('month').optional()
      .isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),

    query('year').optional()
      .isInt({ min: 2000, max: 2100 }).withMessage('Invalid year'),

    query('page').optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

    query('limit').optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
};

const validateAttendance = (ruleName) => {
  const chain = validationChains[ruleName];
  if (!chain) throw new Error(`No validation chain defined for: "${ruleName}"`);
  return [...chain, runValidation];
};

module.exports = { validateAttendance };
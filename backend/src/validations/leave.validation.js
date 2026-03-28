const { body } = require('express-validator');

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
  applyLeave: [
    body('leaveType')
      .notEmpty().withMessage('Leave type is required')
      .isIn(['CL', 'SL', 'PL']).withMessage('Leave type must be CL, SL, or PL'),

    body('startDate')
      .notEmpty().withMessage('Start date is required')
      .isISO8601().withMessage('Invalid start date format')
      .custom((value) => {
        if (new Date(value) < new Date().setHours(0, 0, 0, 0)) {
          throw new Error('Start date cannot be in the past');
        }
        return true;
      }),

    body('endDate')
      .notEmpty().withMessage('End date is required')
      .isISO8601().withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (new Date(value) < new Date(req.body.startDate)) {
          throw new Error('End date must be on or after start date');
        }
        return true;
      }),

    body('reason')
      .trim()
      .notEmpty().withMessage('Reason for leave is required')
      .isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters'),
  ],

  reviewLeave: [
    body('status')
      .notEmpty().withMessage('Review status is required')
      .isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),

    body('reviewRemarks')
      .optional()
      .trim()
      .isLength({ max: 300 }).withMessage('Remarks must not exceed 300 characters'),
  ],
};

const validateLeave = (ruleName) => {
  const chain = validationChains[ruleName];
  if (!chain) throw new Error(`No validation chain defined for: "${ruleName}"`);
  return [...chain, runValidation];
};

module.exports = { validateLeave };
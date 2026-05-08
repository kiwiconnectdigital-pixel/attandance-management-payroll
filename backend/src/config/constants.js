module.exports = {
  ROLES: {
    ADMIN: 'admin',
    HR: 'hr',
    EMPLOYEE: 'employee',
  },

  LEAVE_TYPES: {
    CL: 'CL', // Casual Leave
    SL: 'SL', // Sick Leave
    PL: 'PL', // Privilege Leave
    HD: 'HD', // Half-Day Leave
  },

  LEAVE_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
  },

  ATTENDANCE_STATUS: {
    PRESENT: 'present',
    ABSENT: 'absent',
    HALF_DAY: 'half-day',
    ON_LEAVE: 'on-leave',
    HOLIDAY: 'holiday',
    WEEKEND: 'weekend',
  },

  PAYROLL_STATUS: {
    DRAFT: 'draft',
    PROCESSED: 'processed',
    PAID: 'paid',
  },

  // Standard working hours per day
  STANDARD_WORK_HOURS: 9,

  // Leave balance reset month (January = 1)
  LEAVE_RESET_MONTH: 1,

  // Annual leave entitlements
  ANNUAL_LEAVE_DEFAULTS: {
    CL: 12,
    SL: 12,
    PL: 15,
  },

  // Overtime multiplier (2x standard hourly rate)
  OVERTIME_MULTIPLIER: 2,

  // File upload allowed MIME types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],

  // Pagination defaults
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};
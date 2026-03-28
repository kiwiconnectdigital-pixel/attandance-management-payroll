const moment = require('moment');

/**
 * Get the number of working days between two dates
 * Excludes Sundays by default (can extend for custom holidays)
 */
const getWorkingDays = (startDate, endDate, excludeSundays = true) => {
  let count = 0;
  const current = moment(startDate).clone();
  const end = moment(endDate);

  while (current.isSameOrBefore(end, 'day')) {
    const dayOfWeek = current.day();
    if (!excludeSundays || dayOfWeek !== 0) {
      count++;
    }
    current.add(1, 'day');
  }
  return count;
};

/**
 * Format currency to Indian Rupee string
 */
const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Generate a random alphanumeric string of given length
 */
const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/**
 * Get month name from month number
 */
const getMonthName = (month, year) => {
  return moment(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');
};

/**
 * Safely parse JSON, return fallback on failure
 */
const safeJSONParse = (str, fallback = {}) => {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch {
    return fallback;
  }
};

/**
 * Paginate a mongoose query
 */
const paginate = (query, page = 1, limit = 20) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return query.skip(skip).limit(parseInt(limit));
};

module.exports = {
  getWorkingDays,
  formatINR,
  generateRandomString,
  getMonthName,
  safeJSONParse,
  paginate,
};
const moment = require('moment');

const WORK_START_HOUR   = 9;
const WORK_START_MINUTE = 0;
const STANDARD_HOURS    = 8;

/**
 * Check if an employee checked in late.
 * @param {Date}   checkInTime  - Actual check-in timestamp
 * @param {number} startHour    - Employee's shift start hour   (default: 9)
 * @param {number} startMinute  - Employee's shift start minute (default: 0)
 */
const isLate = (checkInTime, startHour = WORK_START_HOUR, startMinute = WORK_START_MINUTE) => {
  const workStart = moment(checkInTime).startOf('day')
    .add(startHour,   'hours')
    .add(startMinute, 'minutes');
  const diff = moment(checkInTime).diff(workStart, 'minutes');
  return { isLate: diff > 0, minutes: Math.max(0, diff) };
};

/**
 * Calculate total working hours from arrays of check-ins and check-outs.
 * Pairs them in order: checkIns[0]↔checkOuts[0], checkIns[1]↔checkOuts[1], etc.
 * @param {Array}  checkIns     - Array of check-in punch objects  ({ time, ... })
 * @param {Array}  checkOuts    - Array of check-out punch objects ({ time, ... })
 * @param {number} standardHrs  - Override standard hours for OT calc (default: 8)
 */
const calculateWorkingHoursFromPunches = (checkIns, checkOuts, standardHrs = STANDARD_HOURS) => {
  let totalMinutes = 0;
  const pairs = Math.min(checkIns.length, checkOuts.length);

  for (let i = 0; i < pairs; i++) {
    const diff = moment(checkOuts[i].time).diff(moment(checkIns[i].time), 'minutes');
    if (diff > 0) totalMinutes += diff;
  }

  const workingHours  = totalMinutes / 60;
  const overtimeHours = Math.max(0, workingHours - standardHrs);
  return { workingHours, overtimeHours };
};

module.exports = { isLate, calculateWorkingHoursFromPunches, WORK_START_HOUR, WORK_START_MINUTE, STANDARD_HOURS };
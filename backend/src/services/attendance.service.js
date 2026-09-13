const moment = require("moment-timezone");

const WORK_START_HOUR = 9;
const WORK_START_MINUTE = 0;
const STANDARD_HOURS = 8;
const HALF_DAY_HOURS = 5;
const LATE_THRESHOLD_MINUTES = 30;

const isLate = (checkInTime, startHour, startMinute, thresholdMinutes = 0) => {
  const IST = "Asia/Kolkata";
  const checkIn = moment.utc(checkInTime).tz(IST);
  const workStart = checkIn
    .clone()
    .hour(startHour)
    .minute(startMinute)
    .second(0)
    .millisecond(0);

  const diff = checkIn.diff(workStart, "minutes");

  return {
    isLate: diff > thresholdMinutes,
    minutes: Math.max(0, diff - thresholdMinutes),
  };
};

const calculateWorkingHoursFromPunches = (
  checkIns,
  checkOuts,
  standardHrs = STANDARD_HOURS,
) => {
  let totalMinutes = 0;
  const pairs = Math.min(checkIns.length, checkOuts.length);

  for (let i = 0; i < pairs; i++) {
    const diff = moment(checkOuts[i].time).diff(
      moment(checkIns[i].time),
      "minutes",
    );
    if (diff > 0) totalMinutes += diff;
  }

  const workingHours = totalMinutes / 60;
  const overtimeHours = Math.max(0, workingHours - standardHrs);
  return { workingHours, overtimeHours };
};

const determineStatus = (workingHours, lateByMinutes) => {
  if (workingHours < HALF_DAY_HOURS) return "half-day";
  if (lateByMinutes >= LATE_THRESHOLD_MINUTES) return "half-day";
  return "present";
};

module.exports = {
  isLate,
  calculateWorkingHoursFromPunches,
  determineStatus,
  WORK_START_HOUR,
  WORK_START_MINUTE,
  STANDARD_HOURS,
  HALF_DAY_HOURS,
  LATE_THRESHOLD_MINUTES,
};

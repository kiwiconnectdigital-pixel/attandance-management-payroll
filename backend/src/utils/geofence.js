/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in METERS
 *
 * @param {number} lat1 - Employee latitude
 * @param {number} lon1 - Employee longitude
 * @param {number} lat2 - Office latitude
 * @param {number} lon2 - Office longitude
 * @returns {number} distance in meters
 */
const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
};

/**
 * Check if employee is within the allowed geofence
 *
 * @param {object} employeeCoords - { latitude, longitude }
 * @param {object} geofence       - branch geofence settings
 * @returns {{ allowed: boolean, distance: number, message: string }}
 */
const checkGeofence = (employeeCoords, geofence) => {
  // If geofence is disabled for this branch, always allow
  if (!geofence?.enabled) {
    return { allowed: true, distance: 0, message: 'Geofence not enabled' };
  }

  // If geofence is enabled but office coords not configured
  if (!geofence.latitude || !geofence.longitude) {
    return {
      allowed: false,
      distance: 0,
      message: 'Office location not configured. Contact admin.',
    };
  }

  // If employee coords are missing or zero
  const empLat = parseFloat(employeeCoords.latitude);
  const empLon = parseFloat(employeeCoords.longitude);

  if (!empLat || !empLon || isNaN(empLat) || isNaN(empLon)) {
    return {
      allowed: false,
      distance: null,
      message: 'Your GPS location could not be determined. Enable location access and try again.',
    };
  }

  const distance = getDistanceInMeters(
    empLat,
    empLon,
    geofence.latitude,
    geofence.longitude
  );

  const radius = geofence.radiusMeters || 100;

  if (distance <= radius) {
    return {
      allowed: true,
      distance: Math.round(distance),
      message: `Within office zone (${Math.round(distance)}m from office)`,
    };
  }

  return {
    allowed: false,
    distance: Math.round(distance),
    message:
      `You are ${Math.round(distance)}m away from the office. ` +
      `Attendance is only allowed within ${radius}m of ` +
      `${geofence.address || 'the office location'}.`,
  };
};

module.exports = { getDistanceInMeters, checkGeofence };
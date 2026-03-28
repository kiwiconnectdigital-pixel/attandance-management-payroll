/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Check if employee's location is within branch geofence.
 * Returns { allowed: true } or { allowed: false, message, distanceMeters }
 */
const checkGeofence = (branch, latitude, longitude) => {
  const geo = branch.geofence;

  // Geofence disabled — always allow
  if (!geo?.enabled) return { allowed: true };

  if (!geo.latitude || !geo.longitude) {
    return { allowed: false, message: 'Geofence is enabled but office location is not configured. Contact admin.' };
  }

  const distance = Math.round(
    getDistanceMeters(geo.latitude, geo.longitude, latitude, longitude)
  );

  if (distance > geo.radiusMeters) {
    return {
      allowed: false,
      distanceMeters: distance,
      message: `You are ${distance}m away from the office. Must be within ${geo.radiusMeters}m of ${geo.address || 'office location'}.`,
    };
  }

  return { allowed: true, distanceMeters: distance };
};

module.exports = { checkGeofence };
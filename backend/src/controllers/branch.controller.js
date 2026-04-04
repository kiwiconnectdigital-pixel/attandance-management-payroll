const Branch = require("../models/Branch.model");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { geocodeFromText } = require("../services/geocoding.service");

const buildBranchLocationText = (payload = {}) => {
  const parts = [payload.address, payload.city, payload.state, payload.pincode]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return parts.join(", ");
};

const tryResolveGeofenceFromText = async (payload = {}) => {
  const geofence = payload.geofence || {};
  const hasLatitude =
    geofence.latitude !== undefined &&
    geofence.latitude !== null &&
    geofence.latitude !== "";
  const hasLongitude =
    geofence.longitude !== undefined &&
    geofence.longitude !== null &&
    geofence.longitude !== "";

  // Debug: if coordinates already exist, skip external lookup to avoid accidental overrides.
  if (hasLatitude && hasLongitude) return payload;

  // Resolution priority: explicit UI text -> geofence address -> branch address fields.
  const locationQuery =
    String(payload.locationQuery || "").trim() ||
    String(geofence.address || "").trim() ||
    buildBranchLocationText(payload);

  if (!locationQuery) return payload;

  const geo = await geocodeFromText(locationQuery);
  // Debug: unresolved text keeps payload unchanged, so geofence can still be saved manually.
  if (!geo) return payload;

  return {
    ...payload,
    geofence: {
      enabled: geofence.enabled ?? false,
      radiusMeters: geofence.radiusMeters ?? 100,
      address: geofence.address || geo.displayName || locationQuery,
      latitude: geo.latitude,
      longitude: geo.longitude,
    },
  };
};

// @desc Get all branches
exports.getBranches = async (req, res, next) => {
  try {
    const branches = await Branch.find({ isActive: true }).populate(
      "manager",
      "name email",
    );
    res.json(new ApiResponse(200, branches));
  } catch (error) {
    next(error);
  }
};

// @desc Create branch
exports.createBranch = async (req, res, next) => {
  try {
    // Auto-derive geofence coordinates when only location text is provided.
    const payload = await tryResolveGeofenceFromText({ ...req.body });
    delete payload.locationQuery;

    const branch = await Branch.create(payload);
    res.status(201).json(new ApiResponse(201, branch, "Branch created"));
  } catch (error) {
    next(error);
  }
};

// @desc Update branch
exports.updateBranch = async (req, res, next) => {
  try {
    const existing = await Branch.findById(req.params.id);
    if (!existing) throw new ApiError(404, "Branch not found");

    const merged = {
      ...existing.toObject(),
      ...req.body,
      geofence: {
        ...(existing.geofence || {}),
        ...(req.body.geofence || {}),
      },
    };

    const payload = await tryResolveGeofenceFromText(merged);
    // Remove immutable/system-managed fields before passing merged object to update.
    delete payload.locationQuery;
    delete payload._id;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.__v;

    const branch = await Branch.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    res.json(new ApiResponse(200, branch, "Branch updated"));
  } catch (error) {
    next(error);
  }
};

// @desc Delete (soft delete)
exports.deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!branch) throw new ApiError(404, "Branch not found");
    res.json(new ApiResponse(200, null, "Branch deactivated"));
  } catch (error) {
    next(error);
  }
};

// @desc Update geofence settings
exports.updateGeofence = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) throw new ApiError(404, "Branch not found");

    const mergedPayload = {
      ...branch.toObject(),
      geofence: {
        ...(branch.geofence || {}),
        ...(req.body || {}),
      },
      // Text query from UI helps backend recover when lat/lng inputs are empty.
      locationQuery: req.body?.locationQuery,
    };

    const payload = await tryResolveGeofenceFromText(mergedPayload);
    const nextGeofence = payload.geofence || {};

    const updated = await Branch.findByIdAndUpdate(
      req.params.id,
      {
        geofence: {
          enabled: nextGeofence.enabled ?? false,
          latitude: nextGeofence.latitude ?? null,
          longitude: nextGeofence.longitude ?? null,
          radiusMeters: nextGeofence.radiusMeters ?? 100,
          address: nextGeofence.address || "",
        },
      },
      { new: true, runValidators: true },
    );

    res.json(new ApiResponse(200, updated, "Geofence updated"));
  } catch (error) {
    next(error);
  }
};

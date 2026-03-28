const Branch = require('../models/Branch.model');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

module.exports = {
 getBranches: async (req, res, next) => {
    try {
      const branches = await Branch.find({ isActive: true })
        .populate('manager', 'name email');

      return res.json(new ApiResponse(200, branches));

    } catch (error) {
      return next(error);
    }
  },

// @desc Create branch
createBranch : async (req, res, next) => {
  try {
    const branch = await Branch.create(req.body);
    res.status(201).json(new ApiResponse(201, branch, 'Branch created'));
  } catch (error) {
    next(error);
  }
},

// @desc Update branch
updateBranch : async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!branch) throw new ApiError(404, 'Branch not found');
    res.json(new ApiResponse(200, branch, 'Branch updated'));
  } catch (error) {
    next(error);
  }
},

// @desc Delete (soft delete)
deleteBranch : async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!branch) throw new ApiError(404, 'Branch not found');
    res.json(new ApiResponse(200, null, 'Branch deactivated'));
  } catch (error) {
    next(error);
  }
},

// @desc Update geofence settings
updateGeofence : async (req, res, next) => {
  try {
    const { enabled, latitude, longitude, radiusMeters, address } = req.body;
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { geofence: { enabled, latitude, longitude, radiusMeters, address } },
      { new: true }
    );
    if (!branch) throw new ApiError(404, 'Branch not found');
    res.json(new ApiResponse(200, branch, 'Geofence updated'));
  } catch (error) {
    next(error);
  }
},

}
// @desc Get all branches
exports.getBranches = async (req, res, next) => {
  try {
    const branches = await Branch.find({ isActive: true })
      .populate('manager', 'name email');
    res.json(new ApiResponse(200, branches));
  } catch (error) {
    next(error);
  }
};

// @desc Create branch
exports.createBranch = async (req, res, next) => {
  try {
    const branch = await Branch.create(req.body);
    res.status(201).json(new ApiResponse(201, branch, 'Branch created'));
  } catch (error) {
    next(error);
  }
};

// @desc Update branch
exports.updateBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!branch) throw new ApiError(404, 'Branch not found');
    res.json(new ApiResponse(200, branch, 'Branch updated'));
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
      { new: true }
    );
    if (!branch) throw new ApiError(404, 'Branch not found');
    res.json(new ApiResponse(200, null, 'Branch deactivated'));
  } catch (error) {
    next(error);
  }
};

// @desc Update geofence settings
exports.updateGeofence = async (req, res, next) => {
  try {
    const { enabled, latitude, longitude, radiusMeters, address } = req.body;
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { geofence: { enabled, latitude, longitude, radiusMeters, address } },
      { new: true }
    );
    if (!branch) throw new ApiError(404, 'Branch not found');
    res.json(new ApiResponse(200, branch, 'Geofence updated'));
  } catch (error) {
    next(error);
  }
};
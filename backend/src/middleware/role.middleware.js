const ApiError = require('../utils/ApiError');

/**
 * Role-based access control guard
 * Usage: authorize('admin', 'hr')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Role '${req.user.role}' is not authorized to access this route`));
    }
    next();
  };
};

module.exports = { authorize };
const ApiError = require("../utils/ApiError");

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (err.name === "CastError") {
    error = new ApiError(400, "Resource not found");
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new ApiError(400, `${field} already exists`);
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(400, messages.join(", "));
  }

  if (err.name === "JsonWebTokenError")
    error = new ApiError(401, "Invalid token");
  if (err.name === "TokenExpiredError")
    error = new ApiError(401, "Token expired");

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = { errorHandler };

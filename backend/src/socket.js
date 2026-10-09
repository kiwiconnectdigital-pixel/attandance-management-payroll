const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { User } = require("./models");

let io = null;

/**
 * Initializes the Socket.IO server, attached to the same HTTP server as
 * Express. Every connecting client must send a valid JWT (the same one
 * used for the REST API) as `auth.token`. Once verified, the socket joins
 * a private room named `user:<id>`, so notifications can be pushed to one
 * specific user without broadcasting to everyone.
 */
const initSocket = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findByPk(decoded.id, {
        attributes: ["id", "name", "role", "company_id", "is_active"],
      });

      if (!user || !user.is_active) {
        return next(new Error("Invalid or inactive user"));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);

    socket.on("disconnect", () => {
      // no-op, room membership is cleaned up automatically
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized yet");
  }
  return io;
};

/**
 * Pushes a real-time event to one specific user, if they currently have a
 * socket connection open. Safe to call even if Socket.IO failed to
 * initialize or the user isn't connected -- it just silently does nothing.
 */
const emitToUser = (userId, event, payload) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
};

module.exports = { initSocket, getIO, emitToUser };
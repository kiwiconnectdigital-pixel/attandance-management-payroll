import { io } from "socket.io-client";

let socket = null;

const getSocketUrl = () => {
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5500/api/v1";

  return baseUrl.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
};

/**
 * Connects (or returns the existing connection) using the current auth
 * token. Safe to call multiple times -- it won't open duplicate sockets.
 */
export const connectSocket = () => {
  const token = localStorage.getItem("token");

  if (!token) return null;

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
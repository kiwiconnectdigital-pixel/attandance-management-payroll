const express = require("express");
const router = express.Router();
const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  updatePreference,
  getPreference,
} = require("../controllers/notification.controller");

const { protect } = require("../middleware/auth.middleware");

router.use(protect);

router.get("/", getMyNotifications);
router.get("/unread-count", getUnreadCount);
router.get("/preference", getPreference);
router.patch("/preference", updatePreference);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);

module.exports = router;
const { Notification, User } = require("../models");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

module.exports = {
  getMyNotifications: async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const { count, rows } = await Notification.findAndCountAll({
        where: { user_id: req.user.id, is_deleted: false },
        order: [["created_at", "DESC"]],
        limit,
        offset: (page - 1) * limit,
      });

      res.json(
        new ApiResponse(200, {
          total: count,
          page,
          limit,
          notifications: rows,
        }),
      );
    } catch (error) {
      next(error);
    }
  },

  getUnreadCount: async (req, res, next) => {
    try {
      const count = await Notification.count({
        where: { user_id: req.user.id, is_read: false, is_deleted: false },
      });

      res.json(new ApiResponse(200, { count }));
    } catch (error) {
      next(error);
    }
  },

  markAsRead: async (req, res, next) => {
    try {
      const { id } = req.params;

      const notification = await Notification.findOne({
        where: { id, user_id: req.user.id },
      });

      if (!notification) {
        throw new ApiError(404, "Notification not found");
      }

      await notification.update({ is_read: true, read_at: new Date() });

      res.json(new ApiResponse(200, notification, "Marked as read"));
    } catch (error) {
      next(error);
    }
  },

  markAllAsRead: async (req, res, next) => {
    try {
      await Notification.update(
        { is_read: true, read_at: new Date() },
        { where: { user_id: req.user.id, is_read: false } },
      );

      res.json(new ApiResponse(200, null, "All notifications marked as read"));
    } catch (error) {
      next(error);
    }
  },

  updatePreference: async (req, res, next) => {
    try {
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        throw new ApiError(400, "enabled must be a boolean");
      }

      if (req.user.role !== "company_admin") {
        throw new ApiError(
          403,
          "Only company admins can manage notification preferences",
        );
      }

      const user = await User.findByPk(req.user.id);
      await user.update({ notifications_enabled: enabled });

      res.json(
        new ApiResponse(
          200,
          { notifications_enabled: user.notifications_enabled },
          enabled ? "Notifications enabled" : "Notifications disabled",
        ),
      );
    } catch (error) {
      next(error);
    }
  },

  getPreference: async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: ["notifications_enabled"],
      });

      res.json(
        new ApiResponse(200, {
          notifications_enabled: user?.notifications_enabled || false,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
};
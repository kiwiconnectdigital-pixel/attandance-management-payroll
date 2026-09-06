// src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const Controller = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// ✅ All routes require authentication and superadmin authorization
router.use(protect, authorize('super_admin'));

// GET /api/v1/users - Get all users (with filters)
router.get('/', Controller.getAllUsers);

// GET /api/v1/users/:id - Get single user
router.get('/:id', Controller.getUserById);

// POST /api/v1/users - Create new user
router.post('/', Controller.createUser);

// PUT /api/v1/users/:id - Update user
router.put('/:id', Controller.updateUser);

// PATCH /api/v1/users/:id/status - Update user status
router.patch('/:id/status', Controller.updateUserStatus);

// POST /api/v1/users/:id/reset-password - Reset user password
router.post('/:id/reset-password', Controller.resetPassword);

// DELETE /api/v1/users/:id - Delete user
router.delete('/:id', Controller.deleteUser);

module.exports = router;
const express = require('express');
const router = express.Router();
const { login, register, getMe, changePassword } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { body } = require('express-validator');
const { validate } = require('../validations/auth.validation');

router.post('/login', validate('login'), login);
router.post('/register', protect, authorize('admin'), validate('register'), register);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;
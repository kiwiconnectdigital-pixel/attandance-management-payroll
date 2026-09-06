const express = require('express');
const router = express.Router();
const Controller = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { body } = require('express-validator');
const { validate } = require('../validations/auth.validation');

router.post('/login', validate('login'), Controller.login);
router.post('/register', protect, authorize('company_admin'), validate('register'), Controller.register);
router.get('/me', protect, Controller.getMe);
router.put('/change-password', protect, Controller.changePassword);

module.exports = router;
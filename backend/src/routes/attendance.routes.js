const express = require('express');
const router = express.Router();
const Controller = require('../controllers/attendance.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

router.post(
  '/checkin',
  (req, res, next) => { req.uploadFolder = 'selfies'; next(); },
  upload.single('selfie'),Controller.checkIn
);
router.post(
  '/checkout',
  (req, res, next) => { req.uploadFolder = 'selfies'; next(); },
  upload.single('selfie'),Controller.checkOut
);
router.get('/', Controller.getAttendance);
router.get('/today-summary', authorize('admin', 'hr'), Controller.getTodaySummary);
router.get('/:id', protect, Controller.getAttendanceById);
module.exports = router;
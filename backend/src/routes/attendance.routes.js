const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getAttendance, getTodaySummary } = require('../controllers/attendance.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

router.post(
  '/checkin',
  (req, res, next) => { req.uploadFolder = 'selfies'; next(); },
  upload.single('selfie'),
  checkIn
);
router.post(
  '/checkout',
  (req, res, next) => { req.uploadFolder = 'selfies'; next(); },
  upload.single('selfie'),
  checkOut
);
router.get('/', getAttendance);
router.get('/today-summary', authorize('admin', 'hr'), getTodaySummary);

module.exports = router;
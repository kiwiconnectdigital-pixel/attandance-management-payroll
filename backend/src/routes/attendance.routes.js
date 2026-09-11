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
router.get(
  '/all-detailed',
  authorize('company_admin', 'hr'),
  Controller.getAllAttendanceDetailed
);
router.get('/', Controller.getAttendance);
router.get('/today-summary', authorize('company_admin', 'hr'), Controller.getTodaySummary);
router.get('/live-locations', authorize('company_admin', 'hr'), Controller.getLiveLocations);
router.get('/:id', protect, Controller.getAttendanceById);
router.put('/:id',  Controller.updateAttendance);
router.post('/create',  Controller.createAttendance);
router.delete('/:id',  Controller.deleteAttendance);
router.post('/bulk-update',  Controller.bulkUpdateAttendance);
router.post('/location-ping', Controller.trackLocation);
router.get('/:attendanceId/location-trail', Controller.getLocationTrail);
module.exports = router;
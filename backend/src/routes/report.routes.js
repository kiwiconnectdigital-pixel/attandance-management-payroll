const express = require('express');
const router = express.Router();
const { attendanceReportPDF, attendanceReportExcel, payrollReportPDF } = require('../controllers/report.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect, authorize('admin', 'hr'));

router.get('/attendance/pdf', attendanceReportPDF);
router.get('/attendance/excel', attendanceReportExcel);
router.get('/payroll/pdf', payrollReportPDF);

module.exports = router;
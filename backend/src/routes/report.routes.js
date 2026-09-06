const express = require('express');
const router = express.Router();
const Controller = require('../controllers/report.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect, authorize('company_admin', 'hr'));

router.get('/attendance/pdf', Controller.attendanceReportPDF);
router.get('/attendance/excel', Controller.attendanceReportExcel);
router.get('/payroll/pdf', Controller.payrollReportPDF);

module.exports = router;
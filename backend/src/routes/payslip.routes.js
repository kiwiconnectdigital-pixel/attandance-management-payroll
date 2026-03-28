const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const Controller = require('../controllers/payslip.controller');

router.use(protect);

// Generate Payslip
router.post('/generate/:payrollId', authorize('admin', 'hr'), Controller.generatePayslip);

// Get Payslips
router.get('/', Controller.getPayslips);

module.exports = router;
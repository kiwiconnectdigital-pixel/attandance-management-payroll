const express = require('express');
const router = express.Router();
const Controller = require('../controllers/payroll.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);

router.get('/', Controller.getPayrolls);
router.post('/process', authorize('company_admin', 'hr'), Controller.processPayroll);
router.put('/:id/mark-paid', authorize('company_admin'), Controller.markPaid);

module.exports = router;
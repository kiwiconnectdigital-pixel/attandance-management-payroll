const express = require('express');
const router = express.Router();
const Controller = require('../controllers/payroll.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);

router.get('/', Controller.getPayrolls);
router.post('/process', authorize('admin', 'hr'), Controller.processPayroll);
router.put('/:id/mark-paid', authorize('admin'), Controller.markPaid);

module.exports = router;
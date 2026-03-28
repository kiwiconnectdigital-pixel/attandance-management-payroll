const express = require('express');
const router = express.Router();
const { processPayroll, getPayrolls, markPaid } = require('../controllers/payroll.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);

router.get('/', getPayrolls);
router.post('/process', authorize('admin', 'hr'), processPayroll);
router.put('/:id/mark-paid', authorize('admin'), markPaid);

module.exports = router;
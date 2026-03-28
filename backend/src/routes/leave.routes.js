const express = require('express');
const router = express.Router();
const { applyLeave, reviewLeave, getLeaves } = require('../controllers/leave.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);

router.route('/').get(getLeaves).post(applyLeave);
router.put('/:id/review', authorize('admin', 'hr'), reviewLeave);

module.exports = router;
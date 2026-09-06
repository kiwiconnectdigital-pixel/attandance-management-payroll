const express = require('express');
const router = express.Router();
const Controller = require('../controllers/leave.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);

router.route('/').get(Controller.getLeaves).post(Controller.applyLeave);
router.put('/:id/review', authorize('company_admin', 'hr'), Controller.reviewLeave);

module.exports = router;
const express = require('express');
const router = express.Router();

const Controller= require('../controllers/branch.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);

router.get('/', getBranches);
router.post('/', authorize('admin'), Controller.createBranch);
router.put('/:id', authorize('admin'), Controller.updateBranch);
router.delete('/:id', authorize('admin'), Controller.deleteBranch);
router.put('/:id/geofence', authorize('admin'), Controller.updateGeofence);

module.exports = router;
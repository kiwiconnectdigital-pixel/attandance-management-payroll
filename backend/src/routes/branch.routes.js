const express = require('express');
const router = express.Router();

const {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  updateGeofence
} = require('../controllers/branch.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(protect);

router.get('/', getBranches);
router.post('/', authorize('admin'), createBranch);
router.put('/:id', authorize('admin'), updateBranch);
router.delete('/:id', authorize('admin'), deleteBranch);
router.put('/:id/geofence', authorize('admin'), updateGeofence);

module.exports = router;
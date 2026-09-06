const express = require('express');
const router  = express.Router();
const {
  createHoliday,
  getHolidays,
  getHoliday,
  updateHoliday,
  deleteHoliday,
  bulkCreateHolidays,
} = require('../controllers/holiday.controller');

const { authorize } = require('../middleware/role.middleware');
const { protect } = require('../middleware/auth.middleware');

// All routes require login
router.use(protect);

// Public (all roles can view holidays)
router.get('/',    getHolidays);
router.get('/:id', getHoliday);

// Admin only — create / update / delete
router.post(  '/',      authorize('company_admin', 'hr'), createHoliday);
router.post(  '/bulk',  authorize('company_admin', 'hr'), bulkCreateHolidays);
router.put(   '/:id',   authorize('company_admin', 'hr'), updateHoliday);
router.delete('/:id',   authorize('company_admin', 'hr'), deleteHoliday);

module.exports = router;

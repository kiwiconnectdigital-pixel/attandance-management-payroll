const express = require('express');
const router = express.Router();
const { getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employee.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

router
  .route('/')
  .get(getEmployees)
  .post(
    authorize('admin', 'hr'),
    (req, res, next) => { req.uploadFolder = 'profiles'; next(); },
    upload.single('profileImage'),
    createEmployee
  );

router
  .route('/:id')
  .get(getEmployee)
  .put(
    authorize('admin', 'hr'),
    (req, res, next) => { req.uploadFolder = 'profiles'; next(); },
    upload.single('profileImage'),
    updateEmployee
  )
  .delete(authorize('admin'), deleteEmployee);

module.exports = router;
// src/routes/company.routes.js
const express = require('express');
const router = express.Router();
const { protect, superAdminOnly,adminOnly } = require('../middleware/auth.middleware');
const {
  createCompany,
  createCompanyAdmin,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyAdmins,
  toggleCompanyStatus
} = require('../controllers/company.controller');
const upload = require('../middleware/upload.middleware');

// All routes require authentication and super admin role
router.use(protect);
// router.use(superAdminOnly);

// Company management
router.post('/',superAdminOnly, createCompany);
router.get('/',superAdminOnly, getCompanies);
router.get('/:id', getCompanyById);
router.put('/:id',upload.single("logo"),adminOnly, updateCompany);
router.delete('/:id',superAdminOnly, deleteCompany);
router.patch('/:id/toggle-status', superAdminOnly,toggleCompanyStatus);

// Company admin management
router.post('/:companyId/admins', superAdminOnly,createCompanyAdmin);
router.get('/:companyId/admins', superAdminOnly,getCompanyAdmins);

module.exports = router;
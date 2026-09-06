// src/routes/company.routes.js
const express = require('express');
const router = express.Router();
const { protect, superAdminOnly } = require('../middleware/auth.middleware');
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

// All routes require authentication and super admin role
router.use(protect);
router.use(superAdminOnly);

// Company management
router.post('/', createCompany);
router.get('/', getCompanies);
router.get('/:id', getCompanyById);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);
router.patch('/:id/toggle-status', toggleCompanyStatus);

// Company admin management
router.post('/:companyId/admins', createCompanyAdmin);
router.get('/:companyId/admins', getCompanyAdmins);

module.exports = router;
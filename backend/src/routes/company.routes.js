const express = require("express");
const router = express.Router();
const {
  protect,
  superAdminOnly,
  adminOnly,
} = require("../middleware/auth.middleware");
const {
  createCompany,
  createCompanyAdmin,
  getCompanies,
  getCompanyById,
  updateCompany,
  updateLogo,
  deleteCompany,
  getCompanyAdmins,
  toggleCompanyStatus,
  updateEmployeeTracking,
  updateEmployeeLimit,
  updateOfficeLocation,
} = require("../controllers/company.controller");
const upload = require("../middleware/upload.middleware");

router.use(protect);

router.post("/", superAdminOnly, createCompany);
router.get("/", superAdminOnly, getCompanies);
router.get("/:id", getCompanyById);
router.put(
  "/:id",
  superAdminOnly,
  upload.single("logo"),
  updateCompany
);

router.put(
  "/onlyCompany/:id",
  upload.single("logo"),
  updateLogo
);
router.patch("/:id/employee-tracking", superAdminOnly, updateEmployeeTracking);

router.patch("/:id/employee-limit", superAdminOnly, updateEmployeeLimit);

router.patch("/:id/office-location", superAdminOnly, updateOfficeLocation);
router.delete("/:id", superAdminOnly, deleteCompany);
router.patch("/:id/toggle-status", superAdminOnly, toggleCompanyStatus);

router.post("/:companyId/admins", superAdminOnly, createCompanyAdmin);
router.get("/:companyId/admins", superAdminOnly, getCompanyAdmins);

module.exports = router;

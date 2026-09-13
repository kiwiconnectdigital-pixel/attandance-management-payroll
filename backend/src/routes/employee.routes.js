const express = require("express");

const router = express.Router();

const Controller = require("../controllers/employee.controller");

const { protect ,superAdminOnly, adminOnly, adminOrHR } = require("../middleware/auth.middleware");

const { authorize } = require("../middleware/role.middleware");

const upload = require("../middleware/upload.middleware");

router.use(protect);

router.get(
  "/my-profile",
  Controller.getMyProfile
);

router.get(
  "/my-leave-balance",
  Controller.getLeaveBalance
);

router.get(
  "/company/:companyId",
  // superAdminOnly, adminOnly, adminOrHR,
  // authorize("company_admin", "hr", "super_admin"),
  Controller.getEmployeesByCompanyId
);

router.get(
  "/",
  Controller.getEmployees
);

router.post(
  "/",
  authorize("company_admin", "hr", "super_admin"),
  (req, res, next) => {
    req.uploadFolder = "profiles";
    next();
  },
  upload.single("profileImage"),
  Controller.createEmployee
);

router.get(
  "/:id",
  Controller.getEmployee
);

router.put(
  "/:id",
  authorize("company_admin", "hr", "super_admin"),
  (req, res, next) => {
    req.uploadFolder = "profiles";
    next();
  },
  upload.single("profileImage"),
  Controller.updateEmployee
);

router.delete(
  "/:id",
  authorize("company_admin", "super_admin"),
  Controller.deleteEmployee
);

module.exports = router;


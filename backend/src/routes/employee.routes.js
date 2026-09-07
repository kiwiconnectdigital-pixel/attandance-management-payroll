const express = require("express");
const router = express.Router();
const Controller = require("../controllers/employee.controller");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");
const upload = require("../middleware/upload.middleware");

router.use(protect);

router
  .route("/")
  .get(Controller.getEmployees)
  .post(
    authorize("company_admin", "hr","super_admin"),
    (req, res, next) => {
      req.uploadFolder = "profiles";
      next();
    },
    upload.single("profileImage"),
    Controller.createEmployee,
  );

router
  .route("/:id")
  .get(Controller.getEmployee)
  .put(
    authorize("company_admin", "hr","super_admin"),
    (req, res, next) => {
      req.uploadFolder = "profiles";
      next();
    },
    upload.single("profileImage"),
    Controller.updateEmployee,
  )
  .delete(authorize("company_admin","super_admin"), Controller.deleteEmployee);

module.exports = router;

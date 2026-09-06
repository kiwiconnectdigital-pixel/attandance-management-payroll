const express = require("express");
const router = express.Router();

const Controller = require("../controllers/branch.controller");

const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

router.use(protect);

router.get("/", Controller.getBranches);
router.post("/", authorize("company_admin"), Controller.createBranch);
router.put("/:id", authorize("company_admin"), Controller.updateBranch);
router.delete("/:id", authorize("company_admin"), Controller.deleteBranch);
router.put("/:id/geofence", authorize("company_admin"), Controller.updateGeofence);

module.exports = router;

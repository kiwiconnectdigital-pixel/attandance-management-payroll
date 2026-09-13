const express = require("express");
const router = express.Router();
const Controller = require("../controllers/user.controller");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");

router.use(protect, authorize("super_admin"));

router.get("/", Controller.getAllUsers);

router.get("/:id", Controller.getUserById);

router.post("/", Controller.createUser);

router.put("/:id", Controller.updateUser);

router.patch("/:id/status", Controller.updateUserStatus);

router.post("/:id/reset-password", Controller.resetPassword);

router.delete("/:id", Controller.deleteUser);

module.exports = router;

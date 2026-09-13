const express = require("express");
const router = express.Router();
const {
  createHoliday,
  getHolidays,
  getHoliday,
  updateHoliday,
  deleteHoliday,
  bulkCreateHolidays,
} = require("../controllers/holiday.controller");

const { authorize } = require("../middleware/role.middleware");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

router.get("/", getHolidays);
router.get("/:id", getHoliday);

router.post("/", authorize("company_admin", "hr"), createHoliday);
router.post("/bulk", authorize("company_admin", "hr"), bulkCreateHolidays);
router.put("/:id", authorize("company_admin", "hr"), updateHoliday);
router.delete("/:id", authorize("company_admin", "hr"), deleteHoliday);

module.exports = router;

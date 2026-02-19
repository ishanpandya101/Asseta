const express = require("express");
const { getAllVendors, createVendor, updateVendor, deleteVendor } = require("../controllers/vendorController");
const router = express.Router();

router.get("/", getAllVendors);
router.post("/", createVendor);
router.put("/:id", updateVendor);
router.delete("/:id", deleteVendor);

module.exports = router;

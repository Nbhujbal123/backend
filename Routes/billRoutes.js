// Backend/Routes/billRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllBills,
  getUnpaidBills,
  payBill,
  getBillById,
  getPaidBillsByCustomer,
} = require("../controllers/billController");

// Routes
router.get("/", getAllBills);
router.get("/unpaid", getUnpaidBills);
router.get("/paid/:customerId", getPaidBillsByCustomer);
router.put("/pay/:billId", payBill);
router.get("/:billId", getBillById);

module.exports = router;

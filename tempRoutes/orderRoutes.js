// Backend/Routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const {
  createOrder,
  getAllOrders,
  getOrdersByUser,
  getOrdersByEmail,
  getOrderById,
  updateOrderStatus,
} = require("../controllers/orderController");

// Routes

router.post("/", createOrder);
router.get("/", getAllOrders);
router.get("/admin", getAllOrders);
router.get("/user/:userId", getOrdersByUser);
router.get("/email/:email", getOrdersByEmail); // keep for compatibility
router.get("/:orderId", getOrderById); // keep for compatibility
router.put("/:id/status", updateOrderStatus);

module.exports = router;

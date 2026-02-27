// Backend/controllers/orderController.js
const Order = require("../model/orderModel");
const Bill = require("../model/billModel");
const User = require("../model/userModel");

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const { user, items, totalAmount } = req.body;

    const newOrder = new Order({
      user,
      items,
      total: totalAmount,
    });

    await newOrder.save();
    console.log("Order saved:", newOrder);

    res
      .status(201)
      .json({ message: "Order created successfully", order: newOrder });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating order", error: error.message });
  }
};

// Get orders for a user
exports.getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Fetching orders for user:", userId);
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
    console.log("Orders found:", orders);
    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: error.message });
  }
};

// Get all orders for a customer by email (deprecated, but keep for compatibility)
exports.getOrdersByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    console.log("Fetching orders for email:", email);
    const orders = await Order.find({
      "customer.email": new RegExp(`^${email}$`, "i"),
    }).sort({
      createdAt: -1,
    });
    console.log("Orders found:", orders);
    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: error.message });
  }
};

// Get all orders (for admin)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: error.message });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching order", error: error.message });
  }
};

// Update order status by id (for admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus: status },
      { new: true }
    ).populate("user", "name");
    if (!updatedOrder)
      return res.status(404).json({ message: "Order not found" });

    // If order is delivered and not already billed, update bill
    if (status === "DELIVERED" && !updatedOrder.isBilled) {
      console.log(
        `Order ${updatedOrder._id} status changed to DELIVERED. Processing billing for customer ${updatedOrder.user}`
      );
      const userDoc = updatedOrder.user;
      if (userDoc) {
        console.log(
          `Finding UNPAID bill for customer ${userDoc._id} (${userDoc.name})`
        );
        let bill = await Bill.findOne({
          customerId: userDoc._id,
          status: "UNPAID",
        });
        const billItems = updatedOrder.items.map((item) => ({
          productId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        }));

        if (bill) {
          console.log(
            `Found existing UNPAID bill ${bill._id}. Appending ${billItems.length} items.`
          );
          // Append items and recalculate total
          bill.items.push(...billItems);
          bill.totalAmount = bill.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          await bill.save();
          console.log(
            `Bill ${bill._id} updated. New total: ₹${bill.totalAmount}`
          );
        } else {
          console.log(
            `No UNPAID bill found. Creating new bill for customer ${userDoc.name}`
          );
          // Create new bill
          const newBill = new Bill({
            customerId: userDoc._id,
            customerName: userDoc.name,
            items: billItems,
            totalAmount: updatedOrder.total,
          });
          await newBill.save();
          console.log(
            `New bill created: ${newBill._id} for ₹${newBill.totalAmount}`
          );
        }

        // Mark order as billed
        await Order.findByIdAndUpdate(updatedOrder._id, { isBilled: true });
        console.log(`Order ${updatedOrder._id} marked as isBilled: true`);
      } else {
        console.log(`User document not found for order ${updatedOrder._id}`);
      }
    } else {
      console.log(
        `Order ${updatedOrder._id} status: ${status}, isBilled: ${updatedOrder.isBilled} - No billing action needed`
      );
    }

    res.json({ message: "Order status updated", order: updatedOrder });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating order", error: error.message });
  }
};

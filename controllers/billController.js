// Backend/controllers/billController.js
const Bill = require("../model/billModel");

// Get all bills
exports.getAllBills = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });
    res.json(bills);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching bills", error: error.message });
  }
};

// Get unpaid bills only
exports.getUnpaidBills = async (req, res) => {
  try {
    console.log("Fetching unpaid bills...");
    const bills = await Bill.find({ status: "UNPAID" })
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });
    console.log(`Found ${bills.length} unpaid bills`);
    res.json(bills);
  } catch (error) {
    console.error("Error fetching unpaid bills:", error);
    res
      .status(500)
      .json({ message: "Error fetching unpaid bills", error: error.message });
  }
};

// Mark bill as paid
exports.payBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const updatedBill = await Bill.findByIdAndUpdate(
      billId,
      { status: "PAID" },
      { new: true }
    );
    if (!updatedBill) {
      return res.status(404).json({ message: "Bill not found" });
    }
    res.json({ message: "Bill marked as paid", bill: updatedBill });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating bill", error: error.message });
  }
};

// Get paid bills for a customer
exports.getPaidBillsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    console.log("Fetching paid bills for customer:", customerId);
    const bills = await Bill.find({ customerId, status: "PAID" }).sort({
      createdAt: -1,
    });
    console.log(`Found ${bills.length} paid bills for customer ${customerId}`);
    res.json(bills);
  } catch (error) {
    console.error("Error fetching paid bills:", error);
    res
      .status(500)
      .json({ message: "Error fetching paid bills", error: error.message });
  }
};

// Get bill by ID
exports.getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId).populate(
      "customerId",
      "name email"
    );
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }
    res.json(bill);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching bill", error: error.message });
  }
};

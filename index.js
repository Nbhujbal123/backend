const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

// Routes
const authRoutes = require("./Routes/authRoutes");
const menuRoutes = require("./Routes/menuRoutes");
const orderRoutes = require("./Routes/orderRoutes");
const billRoutes = require("./Routes/billRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

/* ===================== CORS FIX ===================== */

app.use(cors({
  origin: true,        // Allow all origins dynamically
  credentials: true
}));

// Handle preflight properly
app.options("*", cors());

/* ==================================================== */

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/bills", billRoutes);

// Health Check
app.get("/", (req, res) => {
  res.status(200).send("🚀 Server is running fine!");
});

console.log("Mongo URI Loaded:", process.env.MONGO_URI?.startsWith("mongodb"));

const startServer = async () => {
  console.log("Connecting to MongoDB Atlas...");
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      family: 4,
    });

    console.log("MongoDB Atlas Connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("MongoDB Atlas Connection Failed:", error.message);
    process.exit(1);
  }
};

startServer();
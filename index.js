const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

// ✅ CREATE EXPRESS APP (THIS WAS MISSING)
const app = express();

const PORT = process.env.PORT || 5000;

/* ===================== ROUTE IMPORTS ===================== */
// ⚠️ Make sure these paths are correct according to your folder structure
const authRoutes = require("./Routes/authRoutes");
const menuRoutes = require("./Routes/menuRoutes");
const orderRoutes = require("./Routes/orderRoutes");
const billRoutes = require("./Routes/billRoutes");
/* ========================================================= */


/* ================= ENVIRONMENT VALIDATION ================= */

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnvVars.join(", "));
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
} else {
  console.log("✅ All required environment variables are configured");
}

console.log("=== Server Configuration ===");
console.log("Port:", PORT);
console.log("Node Environment:", process.env.NODE_ENV || "development");
console.log("Mongo URI Loaded:", !!process.env.MONGO_URI);
console.log("JWT_SECRET Loaded:", !!process.env.JWT_SECRET);
console.log("EMAIL_USER Loaded:", !!process.env.EMAIL_USER);
console.log("EMAIL_PASS Loaded:", !!process.env.EMAIL_PASS);
console.log("===========================");

/* ======================= MIDDLEWARE ======================= */

// ✅ CORS FIX (Important for Netlify → Render connection)
app.use(cors({
  origin: true,
  credentials: true
}));

app.options("*", cors());

app.use(express.json());

/* ========================= ROUTES ========================= */

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/bills", billRoutes);

// Health Check
app.get("/", (req, res) => {
  res.status(200).send("🚀 Server is running fine!");
});

/* ======================= START SERVER ===================== */

const startServer = async () => {
  try {
    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(process.env.MONGO_URI, {
      family: 4,
    });

    console.log("✅ MongoDB Atlas Connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ MongoDB Atlas Connection Failed:", error.message);
    process.exit(1);
  }
};

startServer();
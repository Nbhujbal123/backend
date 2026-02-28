// Backend/controllers/authController.js
const User = require("../model/userModel");
const bcrypt = require("bcryptjs");
const { Resend } = require("resend");
const jwt = require("jsonwebtoken");

// 🔹 Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// 🔹 Verify Resend API connection on startup
if (process.env.RESEND_API_KEY) {
  resend.apiKeys.list()
    .then(() => {
      console.log("✅ Resend API is ready to send emails");
    })
    .catch((error) => {
      console.log("⚠️ Resend API verification failed:", error.message);
    });
}

// 🔹 Generate random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 🔹 Send OTP email helper with proper error handling using Resend
const sendOtpEmail = async (email, otp, subject) => {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ Email service not configured: RESEND_API_KEY is missing");
    throw new Error("Email service is not configured. Check RESEND_API_KEY in environment variables.");
  }

  try {
    const data = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #FF6A00;">RestoM App</h2>
          <p>Your OTP is: <strong style="font-size: 24px; color: #333;">${otp}</strong></p>
          <p style="color: #666;">This OTP will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });
    console.log("✅ OTP email sent successfully:", data.id);
    return { sent: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Failed to send OTP email:", error.message);
    throw error;
  }
};

// ========== SIGNUP ==========
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, mobile, password } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedMobile = (phone || mobile || "").toString().trim();

    console.log("📝 Signup attempt for:", normalizedEmail);

    // Validation - 400 for validation errors
    if (!name || !normalizedEmail || !normalizedMobile || !password) {
      console.log("❌ Signup failed: Missing required fields");
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      console.log("❌ Signup failed: Password too short");
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(normalizedEmail)) {
      console.log("❌ Signup failed: Invalid email format");
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if email already exists - 409 for conflict
    let user = await User.findOne({ email: normalizedEmail });
    if (user && user.isVerified) {
      console.log("❌ Signup failed: Email already registered -", normalizedEmail);
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password using bcrypt
    console.log("🔐 Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("✅ Password hashed successfully");
    
    // Generate OTP
    const otp = generateOTP();
    console.log(`📧 OTP for ${normalizedEmail}: ${otp}`); // For debugging - remove in production

    if (!user) {
      // Create new user
      user = new User({
        name,
        email: normalizedEmail,
        mobile: normalizedMobile,
        password: hashedPassword,
        otp,
        otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
        isVerified: false,
      });
      console.log("✅ Creating new user:", normalizedEmail);
    } else {
      // Update existing unverified user
      user.name = name;
      user.mobile = normalizedMobile;
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000;
      user.isVerified = false;
      console.log("✅ Updating existing unverified user:", normalizedEmail);
    }

    await user.save();
    console.log("✅ User saved to database:", normalizedEmail);

    // Send OTP email - if it fails, still return success
    try {
      await sendOtpEmail(normalizedEmail, otp, "Verify your email - RestoM");
      console.log("✅ OTP sent successfully to:", normalizedEmail);
      return res.status(201).json({ message: "OTP sent to your email" });
    } catch (emailError) {
      // Log the email error but don't break the flow
      console.error("❌ Signup OTP email send failed:", emailError.message);
      // Return success response but include warning message
      return res.status(201).json({ message: "Signup successful but OTP email failed" });
    }
  } catch (error) {
    console.error("❌ Signup error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ========== VERIFY OTP ==========
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Validation
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedOtp = (otp || "").toString().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otp !== normalizedOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    
    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Verify user
    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    console.log("✅ Email verified successfully for:", normalizedEmail);
    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("❌ OTP verification error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ========== LOGIN ==========
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();
    console.log("🔐 Login attempt for:", normalizedEmail);
    
    const user = await User.findOne({ email: normalizedEmail });
    
    // Check if user exists - return 404
    if (!user) {
      console.log("❌ Login failed: User not found -", normalizedEmail);
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log("✅ User found:", normalizedEmail, "| isVerified:", user.isVerified);
    
    // Check if email is verified - return 401 instead of 403
    if (!user.isVerified) {
      console.log("❌ Login failed: Email not verified -", normalizedEmail);
      return res.status(401).json({ message: "Email not verified" });
    }

    // Compare password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      console.log("❌ Login failed: Password mismatch for -", normalizedEmail);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Validate JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is not configured!");
      return res.status(500).json({ message: "Server configuration error" });
    }

    // Generate JWT token using process.env.JWT_SECRET
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("✅ Login successful:", normalizedEmail);
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.mobile,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ========== FORGOT PASSWORD ==========
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Don't reveal if user exists or not - return same message
      return res.status(200).json({ message: "If the email exists, OTP will be sent" });
    }

    // Generate OTP
    const otp = generateOTP();
    console.log(`📧 Password Reset OTP for ${normalizedEmail}: ${otp}`); // For debugging - remove in production
    
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send OTP email
    try {
      await sendOtpEmail(normalizedEmail, otp, "Reset your password - RestoM");
      return res.status(200).json({ message: "OTP sent to your email" });
    } catch (emailError) {
      console.error("❌ Forgot password OTP email send failed:", emailError.message);
      return res.status(502).json({
        message: "Failed to send OTP email. Please check email configuration.",
      });
    }
  } catch (error) {
    console.error("❌ Forgot password error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ========== VERIFY RESET OTP ==========
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedOtp = (otp || "").toString().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otp !== normalizedOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    
    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    return res.status(200).json({ message: "OTP verified" });
  } catch (error) {
    console.error("❌ Reset OTP verification error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ========== RESET PASSWORD ==========
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    console.log("✅ Password reset successful for:", normalizedEmail);
    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("❌ Password reset error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

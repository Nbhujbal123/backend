// Backend/controllers/authController.js
const User = require("../model/userModel");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

// 🔹 Setup email transporter with Gmail SMTP
const EMAIL_USER = process.env.EMAIL_USER?.trim();
const EMAIL_PASS = process.env.EMAIL_PASS?.replace(/\s+/g, "");

// Create transporter with Gmail service
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// 🔹 Verify transporter on startup (optional - for debugging)
if (EMAIL_USER && EMAIL_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.log("⚠️ Email transporter verification failed:", error.message);
    } else {
      console.log("✅ Email transporter is ready to send emails");
    }
  });
}

// 🔹 Generate random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 🔹 Send OTP email helper with proper error handling
const sendOtpEmail = async (email, otp, subject) => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("❌ Email service not configured: EMAIL_USER or EMAIL_PASS is missing");
    throw new Error("Email service is not configured. Check EMAIL_USER/EMAIL_PASS in environment variables.");
  }

  const mailOptions = {
    from: `"RestoM App" <${EMAIL_USER}>`,
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
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP email sent successfully:", info.messageId);
    return { sent: true, messageId: info.messageId };
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

    // Validation - 400 for validation errors
    if (!name || !normalizedEmail || !normalizedMobile || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if email already exists - 409 for conflict
    let user = await User.findOne({ email: normalizedEmail });
    if (user && user.isVerified) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password and generate OTP
    const hashedPassword = await bcrypt.hash(password, 10);
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
      });
    } else {
      // Update existing unverified user
      user.name = name;
      user.mobile = normalizedMobile;
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000;
    }

    await user.save();

    // Send OTP email with proper error handling
    try {
      await sendOtpEmail(normalizedEmail, otp, "Verify your email - RestoM");
      return res.status(201).json({ message: "OTP sent to your email" });
    } catch (emailError) {
      console.error("❌ Signup OTP email send failed:", emailError.message);
      // Return clear error message - don't crash
      return res.status(502).json({
        message: "Signup successful, but failed to send OTP email. Please check email configuration or try again.",
      });
    }
  } catch (error) {
    console.error("❌ Signup error:", error.message);
    return res.status(500).json({ message: "Server error during signup" });
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
    return res.status(500).json({ message: "Server error during OTP verification" });
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
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("✅ User logged in:", normalizedEmail);
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
    return res.status(500).json({ message: "Server error during login" });
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
    return res.status(500).json({ message: "Server error during forgot password" });
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
    return res.status(500).json({ message: "Server error during OTP verification" });
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
    return res.status(500).json({ message: "Server error during password reset" });
  }
};

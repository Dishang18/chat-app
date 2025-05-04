// controllers/authController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { setOtp, getOtp, deleteOtp } from "../utils/otpStore.js";

// Use your SMS API here
const sendOtpToPhone = async (phone, otp) => {
  // e.g., using Twilio or a dummy service
  console.log(`Sending OTP ${otp} to phone ${phone}`);
};

export const registerStepOne = async (req, res) => {
  const { email, username, password, preferredLanguage } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Temporarily store user data in frontend or use sessions/cache
    res.status(200).json({
      message: "Step 1 successful. Proceed to phone verification.",
      tempUser: { email, username, password: hashedPassword, preferredLanguage }
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const sendOtp = async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  setOtp(phone, otp);
  await sendOtpToPhone(phone, otp);

  res.status(200).json({ message: "OTP sent" });
};

export const verifyOtpAndRegister = async (req, res) => {
  const { email, username, password, preferredLanguage, phone, otp } = req.body;

  const storedOtp = getOtp(phone);
  if (!storedOtp || storedOtp !== otp) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  try {
    const user = new User({ email, username, password, preferredLanguage, phone, isVerified: true });
    await user.save();
    deleteOtp(phone);
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
};

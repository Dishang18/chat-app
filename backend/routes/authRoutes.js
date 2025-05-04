// routes/authRoutes.js
import express from "express";
import {
  registerStepOne,
  sendOtp,
  verifyOtpAndRegister,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup/step1", registerStepOne);
router.post("/signup/send-otp", sendOtp);
router.post("/signup/verify-otp", verifyOtpAndRegister);

export default router;

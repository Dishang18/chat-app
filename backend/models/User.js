// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String, // hashed
  preferredLanguage: String, // e.g., 'en', 'hi'
  phone: String,
  isVerified: { type: Boolean, default: false },
});

export default mongoose.model("User", userSchema);

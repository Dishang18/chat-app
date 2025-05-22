import mongoose from "mongoose";
import { v4 as uuidv4 } from 'uuid'; // Import UUID

const userSchema = new mongoose.Schema({
  uid: { 
    type: String, 
    unique: true, 
    default: () => uuidv4() // Generate UUID for each user
  },
  name:{
    type:String
  },
  bio:{
    type:String,
    default:"Hey i am Using Samvad"
  },
  username: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // hashed
  preferredLanguage: { type: String, required: true }, // e.g., 'en', 'hi'
  phone: { type: String, required: true },
  isVerified: { type: Boolean, default: true }, // default true for simple signup
  online: { type: Boolean, default: false }, // <-- Add this line
  profilepic: { type: String, default: "https://ui-avatars.com/api/?name=USer&background=22d3ee&color=fff" },
});

export default mongoose.model("User", userSchema);
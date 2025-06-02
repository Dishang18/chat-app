import express from "express";
import User from "../models/User.js";

export const userController = {
  async getAllUsers(req, res) {
    try {
      
      const users = await User.find({}, "username online profilepic").limit(10);
      res.status(200).json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async updateProfilePic(req, res) {
    try {
      if (!req.file || !req.file.id) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      // Construct the URL to access the image (you may need to adjust the base URL)
      const url = `${
        process.env.BASE_URL || "http://localhost:9000"
      }/user/profile-pic/${req.file.id}`;
      // Optionally update user profile here if you want
      await User.findByIdAndUpdate(req.userData.userId, { profilepic: url });
      console.log("Profile picture updated:", url);
      res.json({ url });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to upload profile picture" });
    }
  },
};

export default userController;

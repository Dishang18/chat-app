import express from 'express';
import uploadMiddleware from '../middlewares/upload.js';
import UserController, { userController } from '../controllers/userController.js';
import { authenticateUser} from '../middlewares/auth.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

const router = express.Router();

// Profile pic upload route
router.post(
  '/user/upload-profile-pic',
  authenticateUser,
  ...uploadMiddleware.single('file'),
  userController.updateProfilePic
);

router.get('/user', UserController.getAllUsers);

router.get('/user/profile-pic/:id', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
    const fileId = new mongoose.Types.ObjectId(req.params.id);

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('error', () => res.status(404).json({ error: 'Not found' }));
    downloadStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

router.put(
  '/user/update-profile',
  authenticateUser,
  async (req, res) => {
    try {
      const userId = req.userData.userId; // authenticateUser sets req.userData
      const update = req.body;
      delete update.password;
      delete update.email;
      const updatedUser = await mongoose.model('User').findByIdAndUpdate(
        userId,
        update,
        { new: true }
      );
      res.json(updatedUser);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);
router.get('/user/me', authenticateUser, async (req, res) => {
  const user = await User.findById(req.userData.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user._id,
    username: user.username,
    email: user.email,
    preferredLanguage: user.preferredLanguage,
    profilepic: user.profilepic, // <-- add this line
    // add other fields as needed
  });
});

export default router;
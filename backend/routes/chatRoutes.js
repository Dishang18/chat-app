import express from 'express';
import mongoose from 'mongoose';
import {
  getConversations,
  getMessages,
  findOrCreateConversation,
  sendMessage,
  getMessagesBetweenUsers,clearChat as clearchat,
  uploadImageMessage
, sendAudioMessage,
  getChatUsersWithUnseen
} from '../controllers/chatController.js';
import upload from '../middlewares/upload.js';

const router = express.Router();

// router.get('/conversations/:userId', getConversations);
// router.get('/messages/:conversationId', getMessages);
// router.post('/conversations/findOrCreate', findOrCreateConversation);
// router.post('/messages', sendMessage);
// router.get('/messages', getMessagesBetweenUsers);

// In your routes file
router.get('/messages/between', getMessagesBetweenUsers);
router.get('/messages/:conversationId', getMessages);
router.post('/messages', sendMessage);
router.post('/conversations/findOrCreate', findOrCreateConversation);
router.get('/conversations/:userId', getConversations);
router.post('/messages/clear', clearchat);
router.post(
  '/messages/image',
  upload.single('image'),
  uploadImageMessage
);

router.post(
  '/messages/audio',
  ...upload.audio.single('audio'),
  sendAudioMessage
);

router.get('/images/:id', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
    const fileId = new mongoose.Types.ObjectId(req.params.id);

    const files = await db.collection('uploads.files').find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    res.set('Content-Type', files[0].contentType);
    bucket.openDownloadStream(fileId).pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

router.get('/chat-users/:userId', getChatUsersWithUnseen);

export default router;
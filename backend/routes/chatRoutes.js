import express from 'express';
import {
  getConversations,
  getMessages,
  findOrCreateConversation,
  sendMessage,
  getMessagesBetweenUsers
} from '../controllers/chatController.js';

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

export default router;
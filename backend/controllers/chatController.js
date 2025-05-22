import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';

// Get all conversations for a user
export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.params.userId })
      .populate('participants', 'username email')
      .populate({
        path: 'lastMessage',
        select: 'originalText translatedText sender receiver timestamp'
      })
      .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

// Get messages for a conversation
export const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId })
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

// Find or create a conversation between two users
export const findOrCreateConversation = async (req, res) => {
  const { user1, user2 } = req.body;
  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [user1, user2], $size: 2 }
    });

    if (!conversation) {
      conversation = new Conversation({ participants: [user1, user2] });
      await conversation.save();
    }
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: "Failed to find or create conversation" });
  }
};

// Send message
// Send message with improved error handling
export const sendMessage = async (req, res) => {
  try {
    const { conversationId, sender, receiver, originalText, translatedText, originalLanguage, translatedLanguage, text, createdAt } = req.body;

    // Validate required fields
    if (!conversationId) {
      console.error("Missing conversationId in request:", req.body);
      return res.status(400).json({ error: "conversationId is required" });
    }
    
    if (!sender || !receiver) {
      console.error("Missing sender or receiver in request:", req.body);
      return res.status(400).json({ error: "sender and receiver are required" });
    }

    console.log("Creating message with data:", {
      conversationId,
      sender,
      receiver,
      text: originalText || text
    });

    // Accept both text or originalText for compatibility with your frontend
    const message = new Message({
      conversationId,
      sender,
      receiver,
      originalText: originalText || text,
      translatedText,
      originalLanguage: originalLanguage || "en",
      translatedLanguage,
      timestamp: createdAt || Date.now()
    });
    
    // Save the message
    await message.save();
    console.log("Message saved with ID:", message._id);

    // Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: Date.now(),
      $addToSet: { participants: [sender, receiver] }
    });

    res.json(message);
  } catch (err) {
    console.error("Error in sendMessage:", err);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        error: "Validation error", 
        details: err.message 
      });
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({ 
        error: "Invalid ID format", 
        details: err.message 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to send message",
      details: err.message
    });
  }
};

// Get all messages between two users (regardless of conversation)
export const getMessagesBetweenUsers = async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) return res.status(400).json({ error: "user1 and user2 are required" });
  try {
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};
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
  console.log("Finding or creating conversation between:", user1, user2);
  if (!user1 || !user2) { 
    return res.status(400).json({ error: "Both user1 and user2 are required" });
  }
  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [user1, user2], $size: 2 }
    });

    if (!conversation) {
      conversation = new Conversation({ participants: [user1, user2] });
      await conversation.save();
    }
    console.log("Conversation found or created:", conversation._id);
    console.log("Participants:", conversation.participants);
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

    // Add this mapping to ensure type is set for image messages
    const mapped = messages.map(msg => {
      const obj = msg.toObject();
      if (obj.image && obj.image.id) {
        obj.type = "image";
      }
      return obj;
    });

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

export const clearChat = async (req, res) => {
  try {
    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ error: "conversationId is required" });
    // Make sure to convert conversationId to ObjectId
    await Message.deleteMany({ conversationId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear chat" });
  }
};

export const uploadImageMessage = async (req, res) => {
  try {
    const { conversationId, sender, receiver } = req.body;
    if (!req.file || !conversationId || !sender || !receiver) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const message = await Message.create({
      conversationId,
      sender,
      receiver,
      originalText: '[Image]',
      translatedText: '',
      originalLanguage: 'en',
      translatedLanguage: '',
      timestamp: Date.now(),
      image: {
        id: req.file.id,
        filename: req.file.filename,
        contentType: req.file.mimetype
      }
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: Date.now(),
      $addToSet: { participants: [sender, receiver] }
    });

    res.json({
      success: true,
      message: "Image uploaded and message saved",
      data: message
    });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
};

export const sendAudioMessage = async (req, res) => {
  try {
    const { conversationId, sender, receiver } = req.body;
    if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

    const message = await Message.create({
      conversationId,
      sender,
      receiver,
      originalText: '[Audio]',
      translatedText: '',
      originalLanguage: 'en',
      translatedLanguage: '',
      timestamp: Date.now(),
      type: 'audio',
      audio: {
        id: req.file.id,
        filename: req.file.filename,
        contentType: req.file.mimetype
      }
    });
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: "Failed to send audio message" });
  }
};

// Get all users who have chatted with current user, with unseen count
export const getChatUsersWithUnseen = async (req, res) => {
  try {
    const userId = req.params.userId;
    const conversations = await Conversation.find({ participants: userId }).populate('participants', 'username profilepic');
    const userMap = {};

    for (const conv of conversations) {
      const otherUser = conv.participants.find(p => p._id.toString() !== userId);
      if (!otherUser) continue;
      const unseenCount = await Message.countDocuments({
        conversationId: conv._id,
        receiver: userId,
        seen: false
      });
      // If user already exists, sum unseen
      if (userMap[otherUser._id]) {
        userMap[otherUser._id].unseen += unseenCount;
      } else {
        userMap[otherUser._id] = {
          _id: otherUser._id,
          username: otherUser.username,
          profilepic: otherUser.profilepic,
          unseen: unseenCount
        };
      }
    }

    res.json(Object.values(userMap));
  } catch (err) {
    console.error("Error in getChatUsersWithUnseen:", err);
    res.status(500).json({ error: err.message || "Failed to fetch chat users" });
  }
};
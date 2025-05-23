import { Server } from 'socket.io';
import { translateText } from '../services/translateService.js';
import User from '../models/User.js';
import axios from 'axios';

const onlineUsers = new Map(); // userId -> {socketId, lastSeen}
const cleanupInterval = 60000; // 1 minute

async function checkLibreTranslateConnection() {
  try {
    const res = await axios.get("http://localhost:5001/languages");
    if (Array.isArray(res.data)) {
      console.log("LibreTranslate server is UP and reachable.");
    } else {
      console.log("LibreTranslate server responded, but unexpected data:", res.data);
    }
  } catch (err) {
    console.error("Cannot connect to LibreTranslate server:", err.message);
  }
}

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    path: "/socket.io",
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 30000,
    transports: ['polling', 'websocket']
  });

  console.log("Socket.IO server initialized with path:", "/socket.io");
  checkLibreTranslateConnection();

  setInterval(() => {
    const now = Date.now();
    for (const [userId, userInfo] of onlineUsers.entries()) {
      const lastSeen = new Date(userInfo.lastSeen).getTime();
      if (now - lastSeen > 5 * 60 * 1000) {
        console.log(`Cleaning up stale connection for user ${userId}`);
        onlineUsers.delete(userId);
        io.emit('online_users', Array.from(onlineUsers.keys()));
      }
    }
  }, cleanupInterval);

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('user_connected', (userId) => {
      if (!userId) return;
      onlineUsers.set(userId, {
        socketId: socket.id,
        lastSeen: new Date().toISOString()
      });
      socket.emit('online_users', Array.from(onlineUsers.keys()));
      socket.broadcast.emit('user_online', userId);
      socket.join(`user:${userId}`);
    });

    socket.on('heartbeat', (userId) => {
      if (userId && onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = new Date().toISOString();
      }
    });

    // --- MAIN MESSAGE HANDLER ---
    socket.on('private_message', async (messageData) => {
      try {
        let sender, receiver, message, conversationId;

        if (messageData.from && messageData.to) {
          sender = messageData.from;
          receiver = messageData.to;
          message = messageData.message;
        } else if (messageData.sender && messageData.receiver) {
          sender = messageData.sender;
          receiver = messageData.receiver;
          message = messageData.originalText || messageData.text || messageData.message;
        } else {
          socket.emit('error_message', { error: 'Invalid message format' });
          return;
        }

        conversationId = messageData.conversationId;
        if (!sender || !receiver || !message) {
          socket.emit('error_message', { error: 'Missing required message fields' });
          return;
        }

        // --- TRANSLATION LOGIC ---
        let translatedMessage = message;
        let receiverUser = null;
        try {
          receiverUser = await User.findById(receiver);
          if (
            receiverUser &&
            receiverUser.preferredLanguage &&
            receiverUser.preferredLanguage !== 'en'
          ) {
            translatedMessage = await translateText(
              message,
              'en',
              receiverUser.preferredLanguage
            );
            console.log(
              `Translated message for user ${receiver} (${receiverUser.preferredLanguage}): "${translatedMessage}"`
            );
          }
        } catch (err) {
          console.error('Translation failed:', err.message);
          translatedMessage = message; // fallback
        }

        // --- STORE BOTH VERSIONS IN DB (pseudo code, replace with your DB logic) ---
        // await Message.create({
        //   from: sender,
        //   to: receiver,
        //   conversationId,
        //   originalText: message,
        //   translatedText: translatedMessage,
        //   createdAt: new Date()
        // });

        // --- EMIT TO RECEIVER (translated) ---
        const receiverMsg = {
          _id: messageData._id || `temp-${Date.now()}`,
          sender,
          receiver,
          from: sender,
          to: receiver,
          originalText: message,
          text: translatedMessage,
          conversationId,
          createdAt: messageData.createdAt || new Date().toISOString(),
          timestamp: messageData.timestamp || new Date().toISOString()
        };
        const targetUserInfo = onlineUsers.get(receiver);
        if (targetUserInfo) {
          io.to(targetUserInfo.socketId).emit('private_message', receiverMsg);
          io.to(`user:${receiver}`).emit('private_message', receiverMsg);
        }

        // --- EMIT TO SENDER (original) ---
        const senderMsg = {
          ...receiverMsg,
          text: message,
          originalText: undefined // or message, if you want
        };
        io.to(socket.id).emit('private_message', senderMsg);

        // Optionally: emit delivery status
        socket.emit('message_delivered', {
          messageId: receiverMsg._id,
          receiver,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error processing private message:', error);
        socket.emit('error_message', { error: 'Server error processing message' });
      }
    });

    socket.on('disconnect', (reason) => {
      let disconnectedUserId = null;
      for (let [userId, userInfo] of onlineUsers.entries()) {
        if (userInfo.socketId === socket.id) {
          disconnectedUserId = userId;
          break;
        }
      }
      if (disconnectedUserId) {
        setTimeout(() => {
          const userInfo = onlineUsers.get(disconnectedUserId);
          if (userInfo && userInfo.socketId === socket.id) {
            onlineUsers.delete(disconnectedUserId);
            io.emit('online_users', Array.from(onlineUsers.keys()));
            io.emit('user_offline', disconnectedUserId);
          }
        }, 5000);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      socket.emit('error_message', { error: 'Socket error occurred' });
    });

    socket.emit('welcome', { message: 'Connected to chat server', socketId: socket.id });
  });

  io.getOnlineUsers = () => Array.from(onlineUsers.keys());
  return io;
};

export default initializeSocket;
import { Server } from 'socket.io';

// Map to track online users
const onlineUsers = new Map(); // userId -> {socketId, lastSeen}

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.IO server instance
 */
const initializeSocket = (server) => {
  // Create Socket.IO server
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173", // frontend URL
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000, // Increase timeout for better connection stability
    transports: ['websocket', 'polling'] // Prefer websocket but fallback to polling
  });

  // Connection handling
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User connects and authenticates
    socket.on('user_connected', (userId) => {
      if (!userId) {
        console.log("User connected with no ID, ignoring");
        return;
      }
      
      console.log(`User ${userId} connected with socket ${socket.id}`);
      onlineUsers.set(userId, {
        socketId: socket.id,
        lastSeen: new Date().toISOString()
      });
      
      // Notify all clients about online users
      io.emit('online_users', Array.from(onlineUsers.keys()));
      
      // Join a personal room for targeted messages
      socket.join(`user:${userId}`);
    });

    // Private message handling
    socket.on('private_message', (messageData) => {
      console.log('Private message received:', messageData);
      
      // Extract sender and receiver IDs regardless of format
      let sender, receiver, message, conversationId;
      
      // Handle different message formats for flexibility
      if (messageData.from && messageData.to) {
        sender = messageData.from;
        receiver = messageData.to;
        message = messageData.message;
      } else if (messageData.sender && messageData.receiver) {
        sender = messageData.sender;
        receiver = messageData.receiver;
        message = messageData.originalText || messageData.text || messageData.message;
      } else {
        console.log("Invalid message format:", messageData);
        return;
      }
      
      conversationId = messageData.conversationId;
      
      // Standardized message object that works with all clients
      const standardizedMessage = {
        _id: messageData._id || `temp-${Date.now()}`,
        sender: sender,
        receiver: receiver,
        from: sender,
        to: receiver,
        originalText: message,
        text: message,
        message: message, // For compatibility
        conversationId: conversationId,
        createdAt: messageData.createdAt || new Date().toISOString(),
        timestamp: messageData.timestamp || new Date().toISOString()
      };
      
      // Get target user's socket info
      const targetUserInfo = onlineUsers.get(receiver);
      
      if (targetUserInfo) {
        const targetSocketId = targetUserInfo.socketId;
        console.log(`Sending message to user ${receiver} via socket ${targetSocketId}`);
        
        // Three ways to ensure message delivery:
        // 1. Direct to socket ID
        io.to(targetSocketId).emit('private_message', standardizedMessage);
        
        // 2. To user's room (more reliable if they have multiple tabs/devices)
        io.to(`user:${receiver}`).emit('private_message', standardizedMessage);
        
        // 3. Acknowledge successful delivery
        socket.emit('message_delivered', {
          messageId: standardizedMessage._id,
          receiver: receiver,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log(`User ${receiver} is not online. Message will be delivered when they connect.`);
        // Acknowledge message is sent but not delivered
        socket.emit('message_sent', {
          messageId: standardizedMessage._id,
          receiver: receiver,
          delivered: false,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Track user activity
    socket.on('user_activity', (userId) => {
      if (userId && onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = new Date().toISOString();
      }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      let disconnectedUserId = null;
      
      // Find the user who disconnected
      for (let [userId, userInfo] of onlineUsers.entries()) {
        if (userInfo.socketId === socket.id) {
          disconnectedUserId = userId;
          break;
        }
      }
      
      if (disconnectedUserId) {
        console.log(`User ${disconnectedUserId} disconnected`);
        
        // Remove from online users map
        onlineUsers.delete(disconnectedUserId);
        
        // Notify all clients about updated online users
        io.emit('online_users', Array.from(onlineUsers.keys()));
        
        // Emit specific user_offline event
        io.emit('user_offline', disconnectedUserId);
      } else {
        console.log('Unknown socket disconnected:', socket.id);
      }
    });
    
    // Typing indicators
    socket.on('typing', ({userId, receiverId, isTyping}) => {
      const targetUserInfo = onlineUsers.get(receiverId);
      if (targetUserInfo) {
        io.to(targetUserInfo.socketId).emit('typing_indicator', {
          userId: userId,
          isTyping: isTyping
        });
      }
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Export a function to get online users for other parts of your application
  io.getOnlineUsers = () => {
    return Array.from(onlineUsers.keys());
  };

  return io;
};

export default initializeSocket;
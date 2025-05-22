import { Server } from 'socket.io';

// Map to track online users with heartbeat
const onlineUsers = new Map(); // userId -> {socketId, lastSeen}

// Clean up stale connections periodically
const cleanupInterval = 60000; // 1 minute

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.IO server instance
 */
const initializeSocket = (server) => {
  // Create Socket.IO server with improved settings
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000"], // Allow multiple origins
      methods: ["GET", "POST"],
      credentials: true
    },
    // IMPORTANT FIX: Add path property to match client
    path: "/socket.io", // Standard path - this is the default, but explicitly setting it
    pingTimeout: 60000, // 60 seconds - Increase timeout for better connection stability
    pingInterval: 25000, // 25 seconds - More frequent pings
    connectTimeout: 30000, // 30 seconds - Longer connect timeout
    transports: ['polling', 'websocket'] // Try polling first, then websocket
  });

  // Log server init
  console.log("Socket.IO server initialized with path:", "/socket.io");
  
  // Periodically clean up stale connections
  setInterval(() => {
    const now = Date.now();
    for (const [userId, userInfo] of onlineUsers.entries()) {
      const lastSeen = new Date(userInfo.lastSeen).getTime();
      // Remove users inactive for more than 5 minutes
      if (now - lastSeen > 5 * 60 * 1000) {
        console.log(`Cleaning up stale connection for user ${userId}`);
        onlineUsers.delete(userId);
        io.emit('online_users', Array.from(onlineUsers.keys()));
      }
    }
  }, cleanupInterval);

  // Connection handling
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Log connection details for debugging
    console.log('Connection details:', {
      transport: socket.conn.transport.name,
      address: socket.handshake.address,
      query: socket.handshake.query,
      auth: socket.handshake.auth
    });

    // User connects and authenticates
    socket.on('user_connected', (userId) => {
      if (!userId) {
        console.log("User connected with no ID, ignoring");
        return;
      }
      
      console.log(`User ${userId} connected with socket ${socket.id}`);
      
      // Store user connection info
      onlineUsers.set(userId, {
        socketId: socket.id,
        lastSeen: new Date().toISOString()
      });
      
      // Send current user the list of online users
      socket.emit('online_users', Array.from(onlineUsers.keys()));
      
      // Let other users know this user is online
      socket.broadcast.emit('user_online', userId);
      
      // Join a personal room for targeted messages
      socket.join(`user:${userId}`);
    });

    // Rest of your socket event handlers remain the same...
    // Heartbeat to keep connection alive and update last seen
    socket.on('heartbeat', (userId) => {
      if (userId && onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = new Date().toISOString();
      }
    });

    // Private message handling with better error handling
    socket.on('private_message', (messageData) => {
      try {
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
          socket.emit('error_message', { error: 'Invalid message format' });
          return;
        }
        
        conversationId = messageData.conversationId;
        
        // Validate required fields
        if (!sender || !receiver || !message) {
          console.log("Missing required message fields");
          socket.emit('error_message', { error: 'Missing required message fields' });
          return;
        }
        
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
          
          // Try multiple delivery methods
          io.to(targetSocketId).emit('private_message', standardizedMessage);
          io.to(`user:${receiver}`).emit('private_message', standardizedMessage);
          
          socket.emit('message_delivered', {
            messageId: standardizedMessage._id,
            receiver: receiver,
            timestamp: new Date().toISOString()
          });
          
          socket.to(`user:${sender}`).emit('private_message', standardizedMessage);
        } else {
          console.log(`User ${receiver} is not online. Message will be delivered when they connect.`);
          socket.emit('message_sent', {
            messageId: standardizedMessage._id,
            receiver: receiver,
            delivered: false,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error processing private message:', error);
        socket.emit('error_message', { error: 'Server error processing message' });
      }
    });

    // Enhanced disconnect handling
    socket.on('disconnect', (reason) => {
      console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`);
      
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
        
        // For immediate disconnects, remove after a grace period
        setTimeout(() => {
          const userInfo = onlineUsers.get(disconnectedUserId);
          // Only delete if this is still the socket that disconnected
          if (userInfo && userInfo.socketId === socket.id) {
            onlineUsers.delete(disconnectedUserId);
            io.emit('online_users', Array.from(onlineUsers.keys()));
            io.emit('user_offline', disconnectedUserId);
          }
        }, 5000); // 5 second grace period
      }
    });
    
    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      socket.emit('error_message', { error: 'Socket error occurred' });
    });
    
    // Send a welcome message when connected
    socket.emit('welcome', { message: 'Connected to chat server', socketId: socket.id });
  });

  // Export functions for application use
  io.getOnlineUsers = () => {
    return Array.from(onlineUsers.keys());
  };

  return io;
};

export default initializeSocket;
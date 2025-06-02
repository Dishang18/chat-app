import { Server } from "socket.io";
import { translateText } from "../services/translateService.js";
import User from "../models/User.js";
import axios from "axios";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

const onlineUsers = new Map(); // userId -> {socketId, lastSeen}
const cleanupInterval = 60000; // 1 minute

async function checkLibreTranslateConnection() {
  try {
    const res = await axios.get("http://localhost:5001/languages");
    if (Array.isArray(res.data)) {
      console.log("LibreTranslate server is UP and reachable.");
    } else {
      console.log(
        "LibreTranslate server responded, but unexpected data:",
        res.data
      );
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
      credentials: true,
    },
    path: "/socket.io",
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 30000,
    transports: ["polling", "websocket"],
  });

  console.log("Socket.IO server initialized with path:", "/socket.io");
  checkLibreTranslateConnection();

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("user_connected", (userId) => {
      if (!userId) return;
      onlineUsers.set(userId, {
        socketId: socket.id,
        lastSeen: new Date().toISOString(),
      });
      socket.emit("online_users", Array.from(onlineUsers.keys()));
      socket.broadcast.emit("user_online", userId);
      socket.join(`user:${userId}`);
    });

    socket.on("heartbeat", (userId) => {
      if (userId && onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = new Date().toISOString();
      }
    });

    // --- MAIN MESSAGE HANDLER ---
    socket.on("private_message", async (messageData) => {
      try {
        let sender, receiver, message, conversationId;

        if (messageData.from && messageData.to) {
          sender = messageData.from;
          receiver = messageData.to;
          message = messageData.message;
        } else if (messageData.sender && messageData.receiver) {
          sender = messageData.sender;
          receiver = messageData.receiver;
          message =
            messageData.originalText || messageData.text || messageData.message;
        } else {
          socket.emit("error_message", { error: "Invalid message format" });
          return;
        }

        conversationId = messageData.conversationId;
        if (!sender || !receiver || !message) {
          socket.emit("error_message", {
            error: "Missing required message fields",
          });
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
            receiverUser.preferredLanguage !== "en"
          ) {
            translatedMessage = await translateText(
              message,
              "en",
              receiverUser.preferredLanguage
            );
            console.log(
              `Translated message for user ${receiver} (${receiverUser.preferredLanguage}): "${translatedMessage}"`
            );
          }
        } catch (err) {
          console.error("Translation failed:", err.message);
          translatedMessage = message; // fallback
        }

        const savedMessage = await Message.create({
          sender,
          receiver,
          from: sender,
          to: receiver,
          conversationId,
          originalText: message,
          translatedText: translatedMessage,
          originalLanguage: "en", // or detect dynamically
          translatedLanguage: receiverUser?.preferredLanguage || "en",
          createdAt: new Date(),
        });
        console.log("Message saved to database:", {
          sender,
          receiver,
          conversationId,
          originalText: message,
          translatedText: translatedMessage,
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          $set: {
            lastMessage: savedMessage._id,
            updatedAt: new Date(),
          },
          $addToSet: { participants: sender, participants: receiver },
        });
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
          timestamp: messageData.timestamp || new Date().toISOString(),
        };
        const targetUserInfo = onlineUsers.get(receiver);
        if (targetUserInfo) {
          io.to(targetUserInfo.socketId).emit("private_message", receiverMsg);
          io.to(`user:${receiver}`).emit("private_message", receiverMsg);
        }
        // Optionally: emit delivery status
        socket.emit("message_delivered", {
          messageId: receiverMsg._id,
          receiver,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error processing private message:", error);
        socket.emit("error_message", {
          error: "Server error processing message",
        });
      }
    });
    socket.on("image_message", async (msg) => {
      try {
        // msg should be the message object returned from /messages/image POST
        const { receiver } = msg;
        const targetUserInfo = onlineUsers.get(receiver);
        if (targetUserInfo) {
          io.to(targetUserInfo.socketId).emit("private_message", {
            ...msg,
            type: "image",
          });
        }
        // Optionally emit to sender for instant UI update
        socket.emit("private_message", { ...msg, type: "image" });
      } catch (err) {
        console.error("Error emitting image message:", err);
      }
    });
    // Mark messages as seen
    // ...existing code...
    socket.on("mark_seen", async ({ conversationId, userId }) => {
      try {
        // Update all messages in this conversation sent to this user as seen
        await Message.updateMany(
          { conversationId, receiver: userId, seen: false },
          { $set: { seen: true } }
        );
        // Optionally update Conversation's readBy
        await Conversation.findByIdAndUpdate(conversationId, {
          $addToSet: { readBy: userId },
        });

        // Find the conversation to get both participants
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.participants) {
          // Find the other user in the conversation
          const otherUserId = conversation.participants.find(
            (id) => id.toString() !== userId.toString()
          );
          if (otherUserId) {
            // Notify the other user (the sender) that messages are seen
            io.to(`user:${otherUserId}`).emit("messages_seen", {
              conversationId,
              userId,
            });
          }
        }
      } catch (err) {
        console.error("Error marking messages as seen:", err);
      }
    });

    socket.on("disconnect", (reason) => {
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
            io.emit("online_users", Array.from(onlineUsers.keys()));
            io.emit("user_offline", disconnectedUserId);
          }
        }, 5000);
      }
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
      socket.emit("error_message", { error: "Socket error occurred" });
    });

    socket.emit("welcome", {
      message: "Connected to chat server",
      socketId: socket.id,
    });
  });

  io.getOnlineUsers = () => Array.from(onlineUsers.keys());
  return io;
};

export default initializeSocket;

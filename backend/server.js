import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import cors from 'cors';
import userRoute from "./routes/userRoutes.js";
import http from 'http';
import chatRoutes from './routes/chatRoutes.js';
import initializeSocket from './socket/index.js'; // Import socket module

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with the HTTP server
const io = initializeSocket(server);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    onlineUsers: io.getOnlineUsers().length,
    socketServer: 'active'
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api", userRoute);  
app.use('/api', chatRoutes);

// Connect to DB and start server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}!!!`);
    // console.log(`Socket.IO server available at: http://localhost:${PORT}`);
    // console.log(`Health check available at: http://localhost:${PORT}/api/health`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
});
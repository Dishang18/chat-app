import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import cors from 'cors';


dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
connectDB();
// Routes
app.use("/auth", authRoutes);

// Connect to DB and start server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}!!!`);
  });
});

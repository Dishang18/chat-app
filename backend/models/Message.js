import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  originalText: { type: String, required: true },
  translatedText: { type: String }, // Store translated message if needed
  originalLanguage: { type: String, required: true }, // e.g., 'en'
  translatedLanguage: { type: String }, // e.g., 'hi'
  timestamp: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false }
});

export default mongoose.model("Message", messageSchema);
// ===== File: backend/models/Conversation.js =====
const mongoose = require("mongoose");

// Each conversation has two or more members (user IDs)
const ConversationSchema = new mongoose.Schema(
  {
    members: {
      type: Array, // array of user IDs
      required: true,
    },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

module.exports = mongoose.model("Conversation", ConversationSchema);

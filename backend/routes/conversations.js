// ===== File: backend/routes/conversations.js =====
const router = require("express").Router();
const Conversation = require("../models/Conversation");
const auth = require("../middleware/auth");

// Create a new conversation (between two users)
router.post("/", auth, async (req, res) => {
  const { senderId, receiverId } = req.body;

  try {
    // check if conversation already exists
    const existingConversation = await Conversation.findOne({
      members: { $all: [senderId, receiverId] },
    });

    if (existingConversation)
      return res.status(200).json(existingConversation);

    const newConversation = new Conversation({
      members: [senderId, receiverId],
    });

    const savedConversation = await newConversation.save();
    res.status(200).json(savedConversation);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get all conversations of a user
router.get("/:userId", auth, async (req, res) => {
  try {
    const conversation = await Conversation.find({
      members: { $in: [req.params.userId] },
    });
    res.status(200).json(conversation);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;

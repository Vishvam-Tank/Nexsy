// backend/routes/messages.js
const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// GET last 200 messages (most recent last)
router.get("/", async (req, res) => {
  try {
    const msgs = await Message.find().sort({ createdAt: 1 }).limit(200); // ascending
    res.json(msgs);
  } catch (err) {
    console.error("GET /api/messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

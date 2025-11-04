// ===== File: backend/routes/authRoutes.js =====
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// -----------------------------
// Register Route
// -----------------------------
router.post("/register", async (req, res) => {
  console.log("📥 Incoming body:", req.body);
  try {
    const { username, password } = req.body;

    // Check if all fields are filled
    if (!username || !password)
      return res.status(400).json({ message: "All fields are required" });

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      username,
      password: hashedPassword,
    });

    // Save to DB
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------------
// Login Route
// -----------------------------
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check fields
    if (!username || !password)
      return res.status(400).json({ message: "All fields are required" });

    // Check if user exists
    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ message: "Invalid username or password" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid username or password" });

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

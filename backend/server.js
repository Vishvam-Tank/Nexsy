// backend/server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();

// CORS configuration
app.use(cors({
  origin: [
    "http://localhost:5173", 
    "http://127.0.0.1:5173", 
    "http://localhost:3000",
    "https://nexsy-chat-app.vercel.app", // Your Vercel domain
    "https://*.vercel.app"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// MongoDB connection with better error handling
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatdb";

console.log("🔗 Connecting to MongoDB...");

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ MongoDB connected successfully");
})
.catch((err) => {
  console.error("❌ MongoDB connection error:", err.message);
  console.log("💡 Tip: Make sure your IP is whitelisted in MongoDB Atlas");
  process.exit(1);
});

// Models
const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String },
    password: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    text: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent'
    },
    deliveredAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Use existing models or create new ones
const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

// Auth routes
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      username, 
      email: email || `${username}@example.com`, 
      password: hashedPassword 
    });
    
    await user.save();
    
    res.status(201).json({ 
      success: true,
      message: "User registered successfully" 
    });
    
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Update user status
    await User.findByIdAndUpdate(user._id, { 
      isOnline: true,
      lastSeen: new Date()
    });

    // Generate token
    const token = jwt.sign(
      { username: user.username }, 
      process.env.JWT_SECRET || "fallback_secret_key", 
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: { username: user.username }
    });
    
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, 'username isOnline lastSeen')
      .sort({ username: 1 })
      .lean();
    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Auth middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Get messages for current user
app.get("/api/messages", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user.username;
    
    const messages = await Message.find({
      $or: [
        { sender: currentUser },
        { receiver: currentUser }
      ],
      isDeleted: false
    }).sort({ createdAt: 1 }).lean();

    res.json({ 
      success: true,
      messages 
    });
    
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// Create HTTP server
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173", 
      "http://localhost:3000",
      "https://nexsy-chat-app.vercel.app",
      "https://*.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Online users tracking
const onlineUsers = new Map(); // socketId -> username
const userSockets = new Map(); // username -> Set(socketIds)

io.on("connection", (socket) => {
  console.log("🟢 New connection:", socket.id);

  socket.on("registerUser", async (data) => {
    const username = data?.username;
    if (!username) return;

    console.log("👤 User registered:", username);

    // Track user connection
    onlineUsers.set(socket.id, username);
    
    if (!userSockets.has(username)) {
      userSockets.set(username, new Set());
    }
    userSockets.get(username).add(socket.id);

    // Update user status in database
    try {
      await User.findOneAndUpdate(
        { username }, 
        { isOnline: true, lastSeen: new Date() }
      );
    } catch (error) {
      console.error("Error updating user status:", error);
    }

    // Broadcast updated user list
    const onlineUsernames = Array.from(new Set(onlineUsers.values()));
    io.emit("onlineUsers", onlineUsernames);
    
    console.log("📊 Online users:", onlineUsernames);
  });

  socket.on("send_message", async (data) => {
    try {
      const { sender, receiver, text } = data;
      
      if (!sender || !receiver || !text) {
        socket.emit("error", { message: "Missing required fields" });
        return;
      }

      console.log("📤 Message from:", sender, "to:", receiver);

      // Save message to database
      const message = new Message({ sender, receiver, text });
      const savedMessage = await message.save();

      const messageData = {
        _id: savedMessage._id,
        sender: savedMessage.sender,
        receiver: savedMessage.receiver,
        text: savedMessage.text,
        status: savedMessage.status,
        createdAt: savedMessage.createdAt
      };

      // Send to receiver if online
      const receiverSockets = userSockets.get(receiver);
      if (receiverSockets) {
        receiverSockets.forEach(sid => {
          io.to(sid).emit("receive_message", messageData);
        });
        
        // Update message status to delivered
        await Message.findByIdAndUpdate(savedMessage._id, {
          status: 'delivered',
          deliveredAt: new Date()
        });
        messageData.status = 'delivered';
      }

      // Send confirmation to sender
      const senderSockets = userSockets.get(sender);
      if (senderSockets) {
        senderSockets.forEach(sid => {
          io.to(sid).emit("message_sent", messageData);
        });
      }

    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("disconnect", async () => {
    const username = onlineUsers.get(socket.id);
    console.log("🔴 User disconnected:", username);

    if (username) {
      onlineUsers.delete(socket.id);
      
      const userSocketSet = userSockets.get(username);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(username);
          
          // Update user as offline in database
          try {
            await User.findOneAndUpdate(
              { username }, 
              { isOnline: false, lastSeen: new Date() }
            );
          } catch (error) {
            console.error("Error updating user status:", error);
          }
        }
      }

      // Broadcast updated user list
      const onlineUsernames = Array.from(new Set(onlineUsers.values()));
      io.emit("onlineUsers", onlineUsernames);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
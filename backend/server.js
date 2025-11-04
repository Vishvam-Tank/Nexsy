// backend/server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration for production - UPDATED WITH YOUR RENDER URL
app.use(cors({
  origin: [
    "http://localhost:5173", 
    "http://127.0.0.1:5173", 
    "http://localhost:3000",
    "https://nexsy-1.onrender.com", // Your Render backend URL
    "https://nexsy-chat.vercel.app", // Your future Vercel frontend
    "https://*.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in environment variables");
  process.exit(1);
}

console.log("🔗 Connecting to MongoDB...");

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully!");
  })
  .catch((error) => {
    console.error("❌ MongoDB Connection Failed:", error.message);
    console.log("💡 Tips: Check your password in .env file and IP whitelist in MongoDB Atlas");
    process.exit(1);
  });

// Database Models
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String, required: true },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
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
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

// ==================== API ROUTES ====================

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    service: "Nexsy Chat Backend",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
    url: "https://nexsy-1.onrender.com"
  });
});

// User Registration
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ 
      username, 
      password: hashedPassword 
    });
    
    await user.save();

    res.status(201).json({ 
      success: true,
      message: "Registration successful! You can now login." 
    });
    
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// User Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Update user status
    await User.findByIdAndUpdate(user._id, { 
      isOnline: true,
      lastSeen: new Date()
    });

    // Generate JWT token
    const token = jwt.sign(
      { username: user.username }, 
      process.env.JWT_SECRET, 
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: { username: user.username }
    });
    
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Get all users for chat list
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

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access token required" });
  }

  const token = authHeader.split(" ")[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Get user's messages
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

// ==================== SOCKET.IO ====================

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "https://nexsy-1.onrender.com", // Your Render backend
      "https://nexsy-chat.vercel.app", // Your Vercel frontend
      "https://*.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Track online users
const onlineUsers = new Map(); // socketId -> username
const userSockets = new Map(); // username -> Set(socketIds)

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Register user when they join
  socket.on("registerUser", async (data) => {
    const username = data?.username;
    if (!username) return;

    console.log("👤 User registered:", username);

    // Track connection
    onlineUsers.set(socket.id, username);
    
    if (!userSockets.has(username)) {
      userSockets.set(username, new Set());
    }
    userSockets.get(username).add(socket.id);

    // Update database status
    try {
      await User.findOneAndUpdate(
        { username }, 
        { isOnline: true, lastSeen: new Date() }
      );
    } catch (error) {
      console.error("Error updating user status:", error);
    }

    // Broadcast updated online list
    const onlineUsernames = Array.from(new Set(onlineUsers.values()));
    io.emit("onlineUsers", onlineUsernames);
    
    console.log("📊 Online users:", onlineUsernames.length);
  });

  // Handle sending messages
  socket.on("send_message", async (data) => {
    try {
      const { sender, receiver, text } = data;
      
      if (!sender || !receiver || !text) {
        socket.emit("error", { message: "Missing message data" });
        return;
      }

      console.log("📤 Message from", sender, "to", receiver);

      // Save to database
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
      if (receiverSockets && receiverSockets.size > 0) {
        receiverSockets.forEach(sid => {
          io.to(sid).emit("receive_message", messageData);
        });
        
        // Update status to delivered
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

  // Mark messages as seen
  socket.on("mark_messages_seen", async (data) => {
    try {
      const { sender, receiver } = data;
      
      await Message.updateMany(
        {
          sender: sender,
          receiver: receiver,
          status: { $in: ['sent', 'delivered'] }
        },
        {
          status: 'seen',
          seenAt: new Date()
        }
      );

      // Notify sender
      const senderSockets = userSockets.get(sender);
      if (senderSockets) {
        senderSockets.forEach(sid => {
          io.to(sid).emit("messages_seen", { sender, receiver });
        });
      }

    } catch (error) {
      console.error("Mark messages seen error:", error);
    }
  });

  // Handle typing indicator
  socket.on("typing", (data) => {
    const { sender, receiver } = data;
    if (!sender || !receiver) return;

    const receiverSockets = userSockets.get(receiver);
    if (receiverSockets) {
      receiverSockets.forEach(sid => {
        io.to(sid).emit("typing", { sender });
      });
    }
  });

  // Handle disconnection
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
          
          // Update database status
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

      // Broadcast updated online list
      const onlineUsernames = Array.from(new Set(onlineUsers.values()));
      io.emit("onlineUsers", onlineUsernames);
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Nexsy Backend running on port ${PORT}`);
  console.log(`📍 Health: https://nexsy-1.onrender.com/api/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Backend URL: https://nexsy-1.onrender.com`);
});

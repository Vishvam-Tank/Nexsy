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
app.use(cors());
app.use(express.json());

const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatdb";
mongoose
  .connect(MONGO)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

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
const User = mongoose.models.User || mongoose.model("User", UserSchema);

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
const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

const DeletedSchema = new mongoose.Schema(
  {
    originalMessageId: { type: mongoose.Schema.Types.ObjectId, required: false },
    sender: String,
    receiver: String,
    text: String,
    sentAt: Date,
    deletedAt: Date,
  },
  { timestamps: true }
);
const DeletedMessage =
  mongoose.models.DeletedMessage || mongoose.model("DeletedMessage", DeletedSchema);

// Auth routes
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "username & password required" });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: "username already taken" });

    const hash = await bcrypt.hash(password, 10);
    const u = new User({ username, email, password: hash });
    await u.save();
    return res.status(201).json({ message: "registered" });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ message: "server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "username & password required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "invalid credentials" });

    // Update user as online
    await User.findOneAndUpdate({ username }, { 
      isOnline: true,
      lastSeen: new Date()
    });

    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
    return res.json({ 
      token, 
      user: { username: user.username }
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "server error" });
  }
});

// Get all users for "All Chats" section
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, 'username isOnline lastSeen').sort({ username: 1 });
    res.json(users);
  } catch (err) {
    console.error("fetch users error:", err);
    res.status(500).json({ message: "server error" });
  }
});

// Fixed Auth middleware
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "no token" });
  
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ message: "invalid token format" });
  }
  
  const token = parts[1];
  jwt.verify(token, process.env.JWT_SECRET || "secret", (err, decoded) => {
    if (err) return res.status(403).json({ message: "invalid token" });
    req.user = decoded;
    next();
  });
}

// Get messages for current user
app.get("/api/messages", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const msgs = await Message.find({ 
      $or: [
        { sender: currentUser },
        { receiver: currentUser }
      ],
      isDeleted: false 
    }).sort({ createdAt: 1 }).lean();
    
    res.json({ messages: msgs });
  } catch (err) {
    console.error("fetch messages error:", err);
    res.status(500).json({ message: "server error" });
  }
});

// HTTP server + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"], 
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Online users management
const onlineUsers = new Map(); // socketId -> username
const userSockets = new Map(); // username -> Set(socketIds)

io.on("connection", (socket) => {
  console.log("🟢 socket connected:", socket.id);

  // Register user
  socket.on("registerUser", async (payload) => {
    const username = payload?.username;
    if (!username) return;

    console.log("👤 User registered:", username, "socket:", socket.id);

    onlineUsers.set(socket.id, username);
    
    if (!userSockets.has(username)) {
      userSockets.set(username, new Set());
    }
    userSockets.get(username).add(socket.id);

    // Update user as online in database
    await User.findOneAndUpdate({ username }, { 
      isOnline: true,
      lastSeen: new Date()
    });

    // Get all users for sidebar (both online and offline)
    const allUsers = await User.find({}, 'username isOnline lastSeen').sort({ username: 1 });
    const onlineUsernames = Array.from(new Set(Array.from(onlineUsers.values())));
    
    // Broadcast to all clients
    io.emit("onlineUsers", onlineUsernames);
    io.emit("allUsers", allUsers);
    
    console.log("📊 Online users:", onlineUsernames);
  });

  // Send private message
  socket.on("send_message", async (data) => {
    try {
      const sender = data.sender;
      const receiver = data.receiver;
      const text = data.text;

      console.log("📤 Private message from:", sender, "to:", receiver, "text:", text);

      if (!sender || !receiver || !text) {
        console.error("Missing sender, receiver or text");
        socket.emit("error", { message: "Missing required fields" });
        return;
      }

      // Save message to database
      const msgDoc = new Message({ 
        sender, 
        receiver, 
        text,
        status: 'sent'
      });
      const savedMsg = await msgDoc.save();
      const messageData = {
        _id: savedMsg._id,
        sender: savedMsg.sender,
        receiver: savedMsg.receiver,
        text: savedMsg.text,
        status: savedMsg.status,
        createdAt: savedMsg.createdAt
      };

      console.log("💬 Message saved to DB:", messageData);

      // Find receiver sockets
      const receiverSockets = userSockets.get(receiver);
      const senderSockets = userSockets.get(sender);

      // If receiver is online, update status to delivered
      if (receiverSockets && receiverSockets.size > 0) {
        await Message.findByIdAndUpdate(savedMsg._id, {
          status: 'delivered',
          deliveredAt: new Date()
        });
        messageData.status = 'delivered';
        messageData.deliveredAt = new Date();
      }

      console.log("📨 Sending private message");
      console.log("Receiver sockets:", receiverSockets);

      // Send to receiver if online
      if (receiverSockets) {
        receiverSockets.forEach(sid => {
          console.log("Sending to receiver socket:", sid);
          io.to(sid).emit("receive_message", messageData);
          // Play notification sound for receiver
          io.to(sid).emit("play_notification", { sender });
        });
      } else {
        console.log("❌ Receiver not online:", receiver);
      }

      // Send confirmation to sender
      if (senderSockets) {
        senderSockets.forEach(sid => {
          console.log("Sending confirmation to sender socket:", sid);
          io.to(sid).emit("message_sent", messageData);
        });
      } else {
        socket.emit("message_sent", messageData);
      }

    } catch (err) {
      console.error("send_message error:", err);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // FIXED: Mark messages as seen - No more infinite loops
  socket.on("mark_messages_seen", async (data) => {
    try {
      const { sender, receiver } = data;
      
      // Check if there are actually unread messages to avoid infinite loops
      const unreadMessages = await Message.find({
        sender: sender,
        receiver: receiver,
        status: { $in: ['sent', 'delivered'] }
      });

      if (unreadMessages.length === 0) {
        return; // No unread messages, exit early
      }

      console.log("👀 Marking messages as seen from:", sender, "to:", receiver, "count:", unreadMessages.length);

      // Update all messages from sender to receiver that are not seen
      const result = await Message.updateMany(
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

      console.log("✅ Messages marked as seen:", result.modifiedCount);

      if (result.modifiedCount > 0) {
        // Notify the sender that their messages were seen
        const senderSockets = userSockets.get(sender);
        if (senderSockets) {
          const updatedMessages = await Message.find({
            sender: sender,
            receiver: receiver,
            status: 'seen'
          }).sort({ createdAt: -1 }).limit(5).lean();

          senderSockets.forEach(sid => {
            io.to(sid).emit("messages_seen", {
              sender: sender,
              receiver: receiver,
              messages: updatedMessages
            });
          });
        }
      }

    } catch (err) {
      console.error("mark_messages_seen error:", err);
    }
  });

  // Update message status to delivered
  socket.on("message_delivered", async (data) => {
    try {
      const { messageId } = data;
      console.log("📬 Message delivered:", messageId);

      await Message.findByIdAndUpdate(messageId, {
        status: 'delivered',
        deliveredAt: new Date()
      });

      // Notify sender
      const message = await Message.findById(messageId);
      if (message) {
        const senderSockets = userSockets.get(message.sender);
        if (senderSockets) {
          senderSockets.forEach(sid => {
            io.to(sid).emit("message_status_updated", {
              messageId: messageId,
              status: 'delivered'
            });
          });
        }
      }
    } catch (err) {
      console.error("message_delivered error:", err);
    }
  });

  // Update last seen when user is active
  socket.on("update_last_seen", async (data) => {
    try {
      const { username } = data;
      await User.findOneAndUpdate({ username }, { 
        lastSeen: new Date()
      });
      
      // Broadcast updated user list
      const allUsers = await User.find({}, 'username isOnline lastSeen').sort({ username: 1 });
      io.emit("allUsers", allUsers);
    } catch (err) {
      console.error("update_last_seen error:", err);
    }
  });

  // Typing indicator for private chat
  socket.on("typing", (data) => {
    const sender = data?.sender;
    const receiver = data?.receiver;

    if (!sender || !receiver) return;

    console.log("⌨️ Typing indicator from:", sender, "to:", receiver);

    // Send typing indicator to the specific receiver
    const receiverSockets = userSockets.get(receiver);
    if (receiverSockets) {
      receiverSockets.forEach(sid => {
        io.to(sid).emit("typing", { sender, receiver });
      });
    }
  });

  // Delete message
  socket.on("delete_message", async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      // Archive message
      await DeletedMessage.create({
        originalMessageId: message._id,
        sender: message.sender,
        receiver: message.receiver,
        text: message.text,
        sentAt: message.createdAt,
        deletedAt: new Date(),
      });

      // Soft delete
      await Message.findByIdAndUpdate(messageId, {
        isDeleted: true,
        deletedAt: new Date()
      });

      // Notify all clients to remove the message
      io.emit("message_deleted", { messageId });

    } catch (err) {
      console.error("delete_message error:", err);
    }
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    const username = onlineUsers.get(socket.id);
    console.log("🔴 socket disconnected:", socket.id, "user:", username);

    if (username) {
      onlineUsers.delete(socket.id);
      
      const userSocketSet = userSockets.get(username);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(username);
          
          // Update user as offline in database
          await User.findOneAndUpdate({ username }, { 
            isOnline: false,
            lastSeen: new Date()
          });
        }
      }

      // Get updated user list
      const allUsers = await User.find({}, 'username isOnline lastSeen').sort({ username: 1 });
      const onlineUsernames = Array.from(new Set(Array.from(onlineUsers.values())));
      
      // Broadcast to all clients
      io.emit("onlineUsers", onlineUsernames);
      io.emit("allUsers", allUsers);
      
      console.log("📊 Online users after disconnect:", onlineUsernames);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
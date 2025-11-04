// client/src/pages/Chat.jsx
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { API_URL, SOCKET_URL } from "../config";
import "./chat.css";

const socket = io(SOCKET_URL, { autoConnect: false });

// NEW: Notification sound with better handling
const playNotificationSound = () => {
  // Create audio context for better cross-browser support
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.7;
    
    // Try to play with user gesture fallback
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.log('Audio play failed, trying fallback:', err);
        // Fallback: create a new audio element each time
        const fallbackAudio = new Audio('/notification.mp3');
        fallbackAudio.volume = 0.5;
        fallbackAudio.play().catch(e => console.log('Fallback audio also failed:', e));
      });
    }
  } catch (err) {
    console.log('Audio error:', err);
  }
};

// Time formatting helpers
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now - time) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const formatLastSeen = (user) => {
  if (!user) return 'Unknown';
  if (user.isOnline) return 'Online';
  if (user.lastSeen) return `Last seen ${formatTimeAgo(user.lastSeen)}`;
  return 'Offline';
};

const formatSeenTime = (timestamp) => {
  if (!timestamp) return '';
  return `Seen ${formatTimeAgo(timestamp)}`;
};

const formatTime = (m) => {
  const time = m.createdAt ? new Date(m.createdAt) : new Date();
  return time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function Chat() {
  const currentUser = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  const [allMessages, setAllMessages] = useState([]);
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [text, setText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [typingUser, setTypingUser] = useState("");
  const [showProfileFull, setShowProfileFull] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedUserData, setSelectedUserData] = useState(null);

  const endRef = useRef(null);
  const lastSeenUpdateRef = useRef(null);

  // Helper functions
  const senderOf = (m) => m.sender;
  const receiverOf = (m) => m.receiver;
  const idOf = (m) => m._id || m.id || `${m.sender}-${m.receiver}-${m.createdAt}`;

  // Filter messages for the selected conversation
  const getConversationMessages = (messages, user1, user2) => {
    return messages.filter(msg => 
      (msg.sender === user1 && msg.receiver === user2) ||
      (msg.sender === user2 && msg.receiver === user1)
    );
  };

  // Calculate unread counts
  const calculateUnreadCounts = (messages, currentUser) => {
    const counts = {};
    messages.forEach(msg => {
      if (msg.receiver === currentUser && msg.status !== 'seen') {
        counts[msg.sender] = (counts[msg.sender] || 0) + 1;
      }
    });
    return counts;
  };

  // FIXED: Mark messages as seen - prevents infinite loops
  const markMessagesAsSeen = (sender, receiver) => {
    if (sender && receiver) {
      // Only mark as seen if there are actually unread messages
      const unreadCount = unreadCounts[sender] || 0;
      if (unreadCount > 0) {
        socket.emit("mark_messages_seen", { sender, receiver });
        
        // Optimistically update local state
        setAllMessages(prev => prev.map(msg => 
          (msg.sender === sender && msg.receiver === receiver && msg.status !== 'seen') 
            ? { ...msg, status: 'seen', seenAt: new Date() }
            : msg
        ));
        
        // Clear unread count for this user
        setUnreadCounts(prev => ({ ...prev, [sender]: 0 }));
      }
    }
  };

  // Update last seen periodically
  const updateLastSeen = () => {
    if (currentUser) {
      socket.emit("update_last_seen", { username: currentUser });
    }
  };

  useEffect(() => {
    console.log("🔵 Chat mounted - User:", currentUser);
    
    if (!token || !currentUser) {
      window.location.href = "/login";
      return;
    }

    // Connect socket
    if (!socket.connected) {
      console.log("🔵 Connecting socket...");
      socket.connect();
      socket.emit("registerUser", { username: currentUser });
    }

    // Load all messages for the current user
    axios.get(`${API_URL}/messages`, { 
      headers: { Authorization: `Bearer ${token}` } 
    })
    .then((res) => {
      const data = res.data?.messages ?? [];
      console.log("📥 Loaded messages from server:", data.length);
      setAllMessages(data);
      
      // Calculate initial unread counts
      const counts = calculateUnreadCounts(data, currentUser);
      setUnreadCounts(counts);
    })
    .catch((err) => {
      console.error("Could not load messages:", err);
    });

    // Load all users for "All Chats" section
    axios.get(`${API_URL}/users`)
    .then((res) => {
      const users = res.data.filter(user => user.username !== currentUser);
      setAllUsers(users);
    })
    .catch((err) => {
      console.error("Failed to load users:", err);
    });

    // Online users
    socket.on("onlineUsers", (users) => {
      console.log("👥 Online users received:", users);
      if (Array.isArray(users)) {
        const filteredUsers = users.filter(user => user && user !== currentUser);
        setOnlineUsers(filteredUsers);
      }
    });

    // All users (for "All Chats" section)
    socket.on("allUsers", (users) => {
      const filteredUsers = users.filter(user => user.username !== currentUser);
      setAllUsers(filteredUsers);
    });

    // Receive private messages
    socket.on("receive_message", (msg) => {
      console.log("📨 Private message received:", msg);
      
      // Only add if it's a message for current user
      if (msg.receiver === currentUser || msg.sender === currentUser) {
        setAllMessages(prev => {
          const existingIds = new Set(prev.map(m => idOf(m)));
          if (existingIds.has(idOf(msg))) return prev;
          
          const newMessages = [...prev, msg];
          
          // Update unread counts if message is for current user
          if (msg.receiver === currentUser && msg.status !== 'seen') {
            setUnreadCounts(prevCounts => ({
              ...prevCounts,
              [msg.sender]: (prevCounts[msg.sender] || 0) + 1
            }));
          }
          
          return newMessages;
        });

        // FIXED: Play notification sound even when tab is not active
        if (msg.receiver === currentUser && msg.sender !== selectedUser) {
          // Use visibility API to handle different tab states
          if (document.visibilityState === 'visible') {
            // Tab is active, play sound immediately
            playNotificationSound();
          } else {
            // Tab is not active, still try to play sound
            playNotificationSound();
            
            // Also show browser notification if permitted
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`New message from ${msg.sender}`, {
                body: msg.text,
                icon: avatarFor(msg.sender)
              });
            }
          }
        }

        // Confirm delivery if message is received
        if (msg.receiver === currentUser && msg.status === 'sent') {
          socket.emit("message_delivered", { messageId: msg._id });
        }
      }
    });

    // NEW: Play notification sound event from server
    socket.on("play_notification", (data) => {
      if (data.sender !== selectedUser) {
        playNotificationSound();
      }
    });

    // Message sent confirmation
    socket.on("message_sent", (msg) => {
      console.log("✅ Message sent confirmation:", msg);
      setAllMessages(prev => {
        const existingIds = new Set(prev.map(m => idOf(m)));
        if (existingIds.has(idOf(msg))) return prev;
        return [...prev, msg];
      });
    });

    // Message status updated
    socket.on("message_status_updated", ({ messageId, status }) => {
      console.log("🔄 Message status updated:", messageId, status);
      setAllMessages(prev => prev.map(msg => 
        idOf(msg) === messageId ? { ...msg, status } : msg
      ));
    });

    // Messages seen event
    socket.on("messages_seen", ({ sender, receiver, messages }) => {
      console.log("👀 Messages seen by:", receiver, "from:", sender);
      
      if (receiver === currentUser) {
        // Update messages with seen status
        const seenMessageIds = messages.map(m => idOf(m));
        setAllMessages(prev => prev.map(msg => 
          seenMessageIds.includes(idOf(msg)) 
            ? { ...msg, status: 'seen', seenAt: msg.seenAt || new Date() }
            : msg
        ));
      }
    });

    // Message deleted
    socket.on("message_deleted", ({ messageId }) => {
      console.log("🗑️ Message deleted:", messageId);
      setAllMessages(prev => prev.filter(m => idOf(m) !== messageId));
    });

    // Typing indicator
    socket.on("typing", ({ sender, receiver }) => {
      console.log("⌨️ Typing from:", sender, "to:", receiver);
      if (receiver === currentUser && sender !== currentUser) {
        setTypingUser(sender);
        setTimeout(() => setTypingUser(""), 2000);
      }
    });

    // Error handling
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Set up last seen updates
    lastSeenUpdateRef.current = setInterval(updateLastSeen, 30000); // Update every 30 seconds

    // Update last seen on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLastSeen();
        if (selectedUser) {
          markMessagesAsSeen(selectedUser, currentUser);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      console.log("🧹 Cleaning up socket listeners");
      socket.off("onlineUsers");
      socket.off("allUsers");
      socket.off("receive_message");
      socket.off("play_notification");
      socket.off("message_sent");
      socket.off("message_status_updated");
      socket.off("messages_seen");
      socket.off("message_deleted");
      socket.off("typing");
      socket.off("connect_error");
      
      if (lastSeenUpdateRef.current) {
        clearInterval(lastSeenUpdateRef.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, currentUser]);

  // Update visible messages when selected user changes
  useEffect(() => {
    if (selectedUser) {
      const conversationMsgs = getConversationMessages(allMessages, currentUser, selectedUser);
      console.log("👀 Conversation with", selectedUser, ":", conversationMsgs.length, "messages");
      setVisibleMessages(conversationMsgs);
      
      // Find selected user data for last seen
      const userData = allUsers.find(user => user.username === selectedUser);
      setSelectedUserData(userData);
      
      // Mark messages as seen when conversation is opened
      markMessagesAsSeen(selectedUser, currentUser);
      
      // Close mobile sidebar when user is selected
      setMobileSidebarOpen(false);
    } else {
      setVisibleMessages([]);
      setSelectedUserData(null);
    }
  }, [allMessages, selectedUser, currentUser, allUsers]);

  // Scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user.username);
    // Clear unread count for this user when selected
    setUnreadCounts(prev => ({ ...prev, [user.username]: 0 }));
  };

  // Send private message
  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !selectedUser) return;
    
    const payload = {
      id: uuidv4(),
      sender: currentUser,
      receiver: selectedUser,
      text: text.trim(),
      time: new Date().toISOString(),
    };

    console.log("📤 Sending private message to:", selectedUser, payload);
    socket.emit("send_message", payload);
    setText("");
  };

  const handleTyping = () => {
    if (selectedUser) {
      socket.emit("typing", { 
        sender: currentUser, 
        receiver: selectedUser 
      });
    }
  };

  const deleteMessage = (m) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    socket.emit("delete_message", { messageId: idOf(m) });
    setAllMessages(prev => prev.filter(msg => idOf(msg) !== idOf(m)));
  };

  const logout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    socket.disconnect();
    window.location.href = "/login";
  };

  const avatarFor = (name) => 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || "guest")}`;

  // Get status icon and text
  const getMessageStatus = (message) => {
    if (message.sender !== currentUser) return null;
    
    switch (message.status) {
      case 'sent':
        return { icon: '✓', text: 'Sent', color: '#666' };
      case 'delivered':
        return { icon: '✓✓', text: 'Delivered', color: '#666' };
      case 'seen':
        return { 
          icon: '✓✓', 
          text: formatSeenTime(message.seenAt), 
          color: '#53bdeb' 
        };
      default:
        return { icon: '⋯', text: 'Sending', color: '#999' };
    }
  };

  // Get users for different sections
  const onlineChatUsers = allUsers.filter(user => user.isOnline);
  const offlineChatUsers = allUsers.filter(user => !user.isOnline);

  return (
    <div className="chat-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button 
          className="menu-toggle"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        >
          ☰
        </button>
        <div className="app-brand">
          <div className="app-logo">💬</div>
          <span className="app-name">ChatApp</span>
        </div>
        {selectedUser && (
          <div className="mobile-partner-info">
            <img src={avatarFor(selectedUser)} alt={selectedUser} className="mobile-avatar" />
            <span>{selectedUser}</span>
          </div>
        )}
      </div>

      {/* Sidebar with Online Users & All Chats */}
      <aside className={`chat-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="app-brand">
            <div className="app-logo">💬</div>
            <span className="app-name">ChatApp</span>
          </div>
          <button className="close-sidebar" onClick={() => setMobileSidebarOpen(false)}>
            ✕
          </button>
        </div>

        <div className="you-profile">
          <img src={avatarFor(currentUser)} alt={currentUser} className="you-avatar" />
          <div className="you-name">{currentUser}</div>
          <div className="online-status">
            <div className="online-dot"></div>
            Online
          </div>
        </div>

        {/* Online Users Section */}
        <div className="online-users-section">
          <h4 className="section-heading">
            <span className="section-icon">🟢</span>
            Online Users
          </h4>
          <div className="user-list">
            {onlineChatUsers.length > 0 ? (
              onlineChatUsers.map((user) => (
                <div
                  key={user.username}
                  className={`user-item ${user.username === selectedUser ? "selected" : ""}`}
                  onClick={() => handleUserSelect(user)}
                >
                  <img src={avatarFor(user.username)} alt={user.username} className="user-avatar" />
                  <div className="user-info">
                    <div className="user-name">{user.username}</div>
                    <div className="user-status online">Online</div>
                  </div>
                  {unreadCounts[user.username] > 0 && (
                    <div className="unread-badge">
                      {unreadCounts[user.username]}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="no-users">No users online</div>
            )}
          </div>
        </div>

        {/* All Chats Section */}
        <div className="all-chats-section">
          <h4 className="section-heading">
            <span className="section-icon">💭</span>
            All Chats
          </h4>
          <div className="user-list">
            {offlineChatUsers.length > 0 ? (
              offlineChatUsers.map((user) => (
                <div
                  key={user.username}
                  className={`user-item ${user.username === selectedUser ? "selected" : ""}`}
                  onClick={() => handleUserSelect(user)}
                >
                  <img src={avatarFor(user.username)} alt={user.username} className="user-avatar" />
                  <div className="user-info">
                    <div className="user-name">{user.username}</div>
                    <div className="user-status offline">
                      {formatLastSeen(user)}
                    </div>
                  </div>
                  {unreadCounts[user.username] > 0 && (
                    <div className="unread-badge">
                      {unreadCounts[user.username]}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="no-users">No other users</div>
            )}
          </div>
        </div>

        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </aside>

      {/* Overlay for mobile sidebar */}
      {mobileSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setMobileSidebarOpen(false)}
        ></div>
      )}

      {/* Main Chat Area */}
      <main className="chat-main">
        {selectedUser ? (
          <>
            {/* Chat Header with Selected User */}
            <header className="chat-header">
              <div className="chat-partner">
                <img 
                  src={avatarFor(selectedUser)} 
                  alt={selectedUser} 
                  className="partner-avatar" 
                  onClick={() => setShowProfileFull(true)}
                />
                <div className="partner-info">
                  <div className="partner-name">{selectedUser}</div>
                  <div className="partner-status">
                    {selectedUserData ? (
                      selectedUserData.isOnline ? (
                        <>
                          <div className="online-dot-small"></div>
                          Online
                        </>
                      ) : (
                        `Last seen ${formatTimeAgo(selectedUserData.lastSeen)}`
                      )
                    ) : (
                      'Loading...'
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* Messages Container */}
            <section className="messages-container">
              {visibleMessages.length === 0 ? (
                <div className="no-messages">
                  No messages with {selectedUser} yet. Start the conversation!
                </div>
              ) : (
                visibleMessages.map((message) => {
                  const isMine = message.sender === currentUser;
                  const status = getMessageStatus(message);
                  
                  return (
                    <div key={idOf(message)} className={`message ${isMine ? "message-sent" : "message-received"}`}>
                      {!isMine && (
                        <img src={avatarFor(message.sender)} alt={message.sender} className="message-avatar" />
                      )}
                      <div className="message-content">
                        {!isMine && (
                          <div className="sender-name">{message.sender}</div>
                        )}
                        <div className="message-text">{message.text}</div>
                        <div className="message-meta">
                          <span className="message-time">{formatTime(message)}</span>
                          {status && (
                            <span 
                              className="message-status" 
                              style={{ color: status.color }}
                              title={status.text}
                            >
                              {status.icon}
                            </span>
                          )}
                        </div>
                      </div>
                      {isMine && (
                        <button 
                          className="message-delete" 
                          onClick={() => deleteMessage(message)}
                          title="Delete message"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              
              {typingUser && typingUser === selectedUser && (
                <div className="typing-indicator">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  {typingUser} is typing...
                </div>
              )}
              
              <div ref={endRef} />
            </section>

            {/* Message Input Form */}
            <form className="message-input-form" onSubmit={sendMessage}>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={handleTyping}
                placeholder={`Message ${selectedUser}...`}
                className="message-input"
                disabled={!selectedUser}
              />
              <button 
                type="submit" 
                className="send-button" 
                disabled={!text.trim() || !selectedUser}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          /* No User Selected State */
          <div className="no-user-selected">
            <div className="welcome-message">
              <div className="app-brand-large">
                <div className="app-logo-large">💬</div>
                <h1>ChatApp</h1>
                <p>Connect with friends and family</p>
              </div>
              <div className="welcome-illustration">
                <img src={avatarFor(currentUser)} alt="You" className="welcome-avatar" />
                <div className="connection-line"></div>
                <img src={avatarFor("friend")} alt="Friend" className="welcome-avatar" />
              </div>
              <p className="welcome-instruction">
                Select a user from the sidebar to start chatting
              </p>
            </div>
          </div>
        )}

        {/* Profile Picture Overlay */}
        {showProfileFull && selectedUser && (
          <div className="profile-overlay" onClick={() => setShowProfileFull(false)}>
            <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
              <img src={avatarFor(selectedUser)} alt={selectedUser} className="profile-image" />
              <h3>{selectedUser}</h3>
              <p>
                {selectedUserData ? (
                  selectedUserData.isOnline ? 
                    'Online' : 
                    `Last seen ${formatTimeAgo(selectedUserData.lastSeen)}`
                ) : 'Loading...'}
              </p>
              <button onClick={() => setShowProfileFull(false)}>Close</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
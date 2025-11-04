import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { API_URL, SOCKET_URL } from "../config";
import "./Chat.css";

const socket = io(SOCKET_URL, { autoConnect: false });

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
  const [loading, setLoading] = useState(true);

  const endRef = useRef(null);

  // Helper functions
  const senderOf = (m) => m.sender;
  const receiverOf = (m) => m.receiver;
  const idOf = (m) => m._id || m.id || `${m.sender}-${m.receiver}-${m.createdAt}`;
  
  const timeOf = (m) => {
    if (m.createdAt) {
      const d = new Date(m.createdAt);
      if (!isNaN(d)) return d;
    }
    return new Date();
  };

  const formatTime = (m) =>
    timeOf(m).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

  // Filter messages for selected conversation
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

  // Mark messages as seen
  const markMessagesAsSeen = (sender, receiver) => {
    if (sender && receiver) {
      socket.emit("mark_messages_seen", { sender, receiver });
      
      // Optimistically update local state
      setAllMessages(prev => prev.map(msg => 
        (msg.sender === sender && msg.receiver === receiver && msg.status !== 'seen') 
          ? { ...msg, status: 'seen', seenAt: new Date() }
          : msg
      ));
      
      // Clear unread count
      setUnreadCounts(prev => ({ ...prev, [sender]: 0 }));
    }
  };

  useEffect(() => {
    if (!token || !currentUser) {
      window.location.href = "/login";
      return;
    }

    // Connect socket
    if (!socket.connected) {
      socket.connect();
      socket.emit("registerUser", { username: currentUser });
    }

    // Load initial data
    const loadInitialData = async () => {
      try {
        // Load messages
        const messagesResponse = await axios.get(`${API_URL}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAllMessages(messagesResponse.data.messages || []);
        
        // Load users
        const usersResponse = await axios.get(`${API_URL}/users`);
        const filteredUsers = usersResponse.data.filter(user => user.username !== currentUser);
        setAllUsers(filteredUsers);
        
        // Calculate unread counts
        const counts = calculateUnreadCounts(messagesResponse.data.messages || [], currentUser);
        setUnreadCounts(counts);
        
      } catch (error) {
        console.error("Failed to load initial data:", error);
        if (error.response?.status === 401) {
          localStorage.clear();
          window.location.href = "/login";
        }
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();

    // Socket event listeners
    socket.on("onlineUsers", (users) => {
      const filteredUsers = users.filter(user => user && user !== currentUser);
      setOnlineUsers(filteredUsers);
    });

    socket.on("receive_message", (msg) => {
      setAllMessages(prev => {
        const existingIds = new Set(prev.map(m => idOf(m)));
        if (existingIds.has(idOf(msg))) return prev;
        
        const newMessages = [...prev, msg];
        
        // Update unread counts
        if (msg.receiver === currentUser && msg.status !== 'seen') {
          setUnreadCounts(prevCounts => ({
            ...prevCounts,
            [msg.sender]: (prevCounts[msg.sender] || 0) + 1
          }));
        }
        
        return newMessages;
      });
    });

    socket.on("message_sent", (msg) => {
      setAllMessages(prev => {
        const existingIds = new Set(prev.map(m => idOf(m)));
        if (existingIds.has(idOf(msg))) return prev;
        return [...prev, msg];
      });
    });

    socket.on("messages_seen", ({ sender, receiver }) => {
      if (receiver === currentUser) {
        setAllMessages(prev => prev.map(msg => 
          (msg.sender === sender && msg.receiver === receiver && msg.status !== 'seen') 
            ? { ...msg, status: 'seen', seenAt: new Date() }
            : msg
        ));
      }
    });

    socket.on("typing", ({ sender }) => {
      if (sender !== currentUser) {
        setTypingUser(sender);
        setTimeout(() => setTypingUser(""), 2000);
      }
    });

    return () => {
      socket.off("onlineUsers");
      socket.off("receive_message");
      socket.off("message_sent");
      socket.off("messages_seen");
      socket.off("typing");
    };
  }, [token, currentUser]);

  // Update visible messages when selection changes
  useEffect(() => {
    if (selectedUser) {
      const conversationMsgs = getConversationMessages(allMessages, currentUser, selectedUser);
      setVisibleMessages(conversationMsgs);
      markMessagesAsSeen(selectedUser, currentUser);
    } else {
      setVisibleMessages([]);
    }
  }, [allMessages, selectedUser, currentUser]);

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user.username);
    setUnreadCounts(prev => ({ ...prev, [user.username]: 0 }));
    setMobileSidebarOpen(false);
  };

  // Send message
  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !selectedUser) return;
    
    const payload = {
      id: uuidv4(),
      sender: currentUser,
      receiver: selectedUser,
      text: text.trim(),
    };

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
    localStorage.clear();
    socket.disconnect();
    window.location.href = "/login";
  };

  const avatarFor = (name) => 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || "user")}`;

  // Get message status
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
  const selectedUserData = allUsers.find(user => user.username === selectedUser);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Nexsy Chat...</p>
      </div>
    );
  }

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
          <span className="app-name">Nexsy</span>
        </div>
        {selectedUser && (
          <div className="mobile-partner-info">
            <img src={avatarFor(selectedUser)} alt={selectedUser} className="mobile-avatar" />
            <span>{selectedUser}</span>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className={`chat-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="app-brand">
            <div className="app-logo">💬</div>
            <span className="app-name">Nexsy</span>
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

        {/* Online Users */}
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

        {/* All Chats */}
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

      {/* Mobile Overlay */}
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

            <form className="message-input-form" onSubmit={sendMessage}>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleTyping}
                placeholder={`Message ${selectedUser}...`}
                className="message-input"
              />
              <button 
                type="submit" 
                className="send-button" 
                disabled={!text.trim()}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="no-user-selected">
            <div className="welcome-message">
              <div className="app-brand-large">
                <div className="app-logo-large">💬</div>
                <h1>Nexsy Chat</h1>
                <p>Real-time messaging with friends</p>
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

        {/* Profile Modal */}
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
import React from "react";

const MessageBubble = ({ msg, isOwn }) => {
  return (
    <div className={`chat-bubble ${isOwn ? "sent" : "received"}`}>
      <div className="bubble-header">
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.username}`}
          alt={msg.username}
          className="bubble-avatar"
        />
        <strong>{msg.username}</strong>
        <span className="msg-time">{msg.time}</span>
      </div>
      <div className="bubble-text">{msg.text}</div>
    </div>
  );
};

export default MessageBubble;

// src/components/ReceivedMessage.jsx
import React from "react";

export default function ReceivedMessage({ msg }) {
  return (
    <div className="msg-row received">
      <div className="msg-bubble">
        <div className="bubble-meta">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.username}`} alt={msg.username} />
          <div style={{fontWeight:600}}>{msg.username}</div>
          <div className="bubble-time">{msg.time}</div>
        </div>
        <div>{msg.text}</div>
      </div>
    </div>
  );
}

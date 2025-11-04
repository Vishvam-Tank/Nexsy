// src/components/SentMessage.jsx
import React from "react";

export default function SentMessage({ msg }) {
  return (
    <div className="msg-row sent">
      <div className="msg-bubble">
        <div className="bubble-meta">
          <div style={{width:28,height:28}} /> {/* spacer */}
          <div style={{fontWeight:600}}>{msg.username}</div>
          <div className="bubble-time">{msg.time}</div>
        </div>
        <div>{msg.text}</div>
      </div>
    </div>
  );
}

import React from "react";
import "../styles/sentMessage.css";

const SentMessage = ({ msg }) => {
  return (
    <div className="sent-bubble">
      <div className="sent-text">{msg.text}</div>
      <div className="sent-time">{msg.time}</div>
    </div>
  );
};

export default SentMessage;

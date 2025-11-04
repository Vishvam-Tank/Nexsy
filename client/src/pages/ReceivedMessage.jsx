import React from "react";
import "../styles/receivedMessage.css";

const ReceivedMessage = ({ msg }) => {
  return (
    <div className="received-bubble">
      <div className="received-text">{msg.text}</div>
      <div className="received-time">{msg.time}</div>
    </div>
  );
};

export default ReceivedMessage;

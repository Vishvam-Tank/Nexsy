// client/src/components/ChatBox.jsx
import React, { useEffect, useRef, useState } from "react";
import SentMessage from "./SentMessage";
import ReceivedMessage from "./ReceivedMessage";

export default function ChatBox({ socket, username, messages, setMessages, typingUser, setTypingUser }) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  // send message
  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const msg = {
      username,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // show locally as sent
    setMessages((prev) => [...prev, { ...msg, type: "sent" }]);

    // send to server — server will broadcast to others and save to DB
    socket.emit("send_message", msg);

    // stop typing
    socket.emit("stop_typing", { username });
    setText("");
  };

  // typing behavior
  const onChange = (e) => {
    setText(e.target.value);
    socket.emit("typing", { username });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop_typing", { username });
    }, 700);
  };

  return (
    <>
      <div style={{flex:1, display:"flex", flexDirection:"column", height:"100%"}}>
        <div className="chat-messages">
          {messages.map((m, i) => (m.type === "sent"
            ? <SentMessage key={i} msg={m} />
            : <ReceivedMessage key={i} msg={m} />
          ))}
          {typingUser && typingUser !== username ? (
            <div style={{padding:8, color:"#666"}}>{typingUser} is typing...</div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form className="chat-input" onSubmit={send}>
        <input placeholder="Type a message..." value={text} onChange={onChange} />
        <button className="send-btn">Send</button>
      </form>
    </>
  );
}

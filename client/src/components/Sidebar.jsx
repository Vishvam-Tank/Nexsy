// src/components/Sidebar.jsx
import React from "react";

export default function Sidebar({ username, onlineUsers }) {
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || "user"}`;

  return (
    <div className="chat-sidebar">
      <div className="profile">
        <img src={avatar} alt="me" />
        <div className="name">{username}</div>
        <div className="sub">Online now</div>
      </div>

      <div style={{width:"100%"}}>
        <h4 style={{margin:"8px 0 10px 0", color:"#dff6f0"}}>Online Users</h4>
        <div className="online-list">
          {onlineUsers.length === 0 && <div style={{color:"#cfeee0", padding:6}}>No one online</div>}
          {onlineUsers.map((u) => (
            <div key={u} className="user-card">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u}`} alt={u} />
              <div className="uinfo">
                <div className="uname">{u}</div>
                <div className="ustatus">Available</div>
              </div>
              <div className="online-dot" />
            </div>
          ))}
        </div>
      </div>

      <button className="logout-btn" onClick={() => { localStorage.clear(); window.location.href="/login"; }}>
        Logout
      </button>
    </div>
  );
}

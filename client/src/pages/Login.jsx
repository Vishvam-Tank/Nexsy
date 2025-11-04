// client/src/pages/Login.jsx
import React, { useState } from "react";
import axios from "axios";
import "./login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await axios.post("http://localhost:5000/api/login", {
        username,
        password,
      });

      if (res.data?.token) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("username", res.data.user.username);
        setMessage("✅ Login successful! Redirecting...");
        setTimeout(() => {
          window.location.href = "/chat";
        }, 1000);
      } else {
        setMessage("❌ Login failed. Please check credentials.");
      }
    } catch (err) {
      setMessage("❌ Login failed. Try again!");
      console.error(err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="app-brand auth-brand">
            <div className="app-logo">💬</div>
            <span className="app-name">ChatApp</span>
          </div>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-sub">Log in to continue your conversation</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              required
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="auth-btn">
            Log In
          </button>
        </form>

        {message && <div className="auth-msg">{message}</div>}

        <p className="auth-footer">
          New user? <a href="/register">Create account</a>
        </p>
      </div>
    </div>
  );
}
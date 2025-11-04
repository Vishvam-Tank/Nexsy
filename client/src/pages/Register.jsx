// client/src/pages/Register.jsx
import React, { useState } from "react";
import axios from "axios";
import "./login.css";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await axios.post("http://localhost:5000/api/register", {
        username,
        email,
        password,
      });

      if (res.data?.message?.toLowerCase().includes("success")) {
        setMessage("✅ Registration successful! Redirecting to login...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      } else {
        setMessage("⚠️ Registration failed. Try another username.");
      }
    } catch (err) {
      setMessage("⚠️ Registration failed. Please check details.");
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
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-sub">Join and start chatting instantly</p>
        </div>

        <form onSubmit={handleRegister} className="auth-form">
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
              type="email"
              placeholder="Email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
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
            Register
          </button>
        </form>

        {message && <div className="auth-msg">{message}</div>}

        <p className="auth-footer">
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
}
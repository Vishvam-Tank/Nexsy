import React, { useState } from "react";
import axios from "axios";
import { API_URL } from "../config";

const authStyles = `
  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1e3932 0%, #2c5548 100%);
    padding: 20px;
  }

  .auth-card {
    background: white;
    padding: 40px;
    border-radius: 20px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
    text-align: center;
  }

  .auth-header {
    margin-bottom: 30px;
  }

  .app-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .app-logo {
    font-size: 32px;
    background: #1e3932;
    color: white;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-name {
    font-weight: 700;
    color: #1e3932;
    font-size: 24px;
  }

  .auth-header h2 {
    font-size: 28px;
    color: #1e3932;
    margin-bottom: 8px;
    font-weight: 700;
  }

  .auth-header p {
    color: #666;
    font-size: 16px;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .input-group {
    position: relative;
  }

  .auth-form input {
    width: 100%;
    padding: 16px 20px;
    border: 2px solid #e6dfd3;
    border-radius: 12px;
    font-size: 16px;
    transition: all 0.3s ease;
    background: #f8f5f0;
    font-family: inherit;
  }

  .auth-form input:focus {
    outline: none;
    border-color: #b1976b;
    background: white;
    box-shadow: 0 0 0 3px rgba(177, 151, 107, 0.1);
  }

  .auth-btn {
    background: #1e3932;
    color: white;
    border: none;
    padding: 16px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 10px;
    font-family: inherit;
  }

  .auth-btn:hover:not(:disabled) {
    background: #2b4c44;
    transform: translateY(-2px);
  }

  .auth-message {
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-weight: 500;
    font-size: 14px;
  }

  .auth-message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .auth-message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .auth-footer {
    color: #666;
    font-size: 14px;
  }

  .auth-footer a {
    color: #b1976b;
    text-decoration: none;
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .auth-container {
      padding: 10px;
    }
    
    .auth-card {
      padding: 30px 20px;
    }
    
    .auth-header h2 {
      font-size: 24px;
    }
    
    .app-logo {
      font-size: 28px;
      width: 42px;
      height: 42px;
    }
    
    .app-name {
      font-size: 20px;
    }
  }
`;

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

React.useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = authStyles;
    document.head.appendChild(styleSheet);
    
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    
    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match");
      return;
    }

    if (username.length < 3) {
      setMessage("❌ Username must be at least 3 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/register`, {
        username,
        password,
      });

      if (response.data.success) {
        setMessage("✅ Registration successful! Redirecting to login...");
        
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Registration failed. Please try again.";
      setMessage(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="app-brand">
            <div className="app-logo">💬</div>
            <span className="app-name">Nexsy Chat</span>
          </div>
          <h2>Create Account</h2>
          <p>Join Nexsy and start chatting instantly</p>
        </div>

        <form onSubmit={handleRegister} className="auth-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={1}
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={1}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="auth-btn"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        {message && (
          <div className={`auth-message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <div className="auth-footer">
          <p>
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
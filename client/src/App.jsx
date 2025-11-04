// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";

// Helper: check if user is logged in
const isLoggedIn = () => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  return !!(token && username);
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={isLoggedIn() ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/login" 
          element={isLoggedIn() ? <Navigate to="/chat" replace /> : <Login />} 
        />
        <Route 
          path="/register" 
          element={isLoggedIn() ? <Navigate to="/chat" replace /> : <Register />} 
        />
        <Route 
          path="/chat" 
          element={isLoggedIn() ? <Chat /> : <Navigate to="/login" replace />} 
        />
        {/* Catch all route - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
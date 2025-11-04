import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";

// Check if user is authenticated
const isAuthenticated = () => {
  try {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    return !!(token && username);
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
};

function App() {
  console.log('🚀 Nexsy App loaded successfully!');
  
  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            isAuthenticated() ? 
            <Navigate to="/chat" replace /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/login" 
          element={
            isAuthenticated() ? 
            <Navigate to="/chat" replace /> : 
            <Login />
          } 
        />
        <Route 
          path="/register" 
          element={
            isAuthenticated() ? 
            <Navigate to="/chat" replace /> : 
            <Register />
          } 
        />
        <Route 
          path="/chat" 
          element={
            isAuthenticated() ? 
            <Chat /> : 
            <Navigate to="/login" replace />
          } 
        />
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";

// helper: logged in if token exists
const isLoggedIn = () => !!localStorage.getItem("token");

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={isLoggedIn() ? <Navigate to="/chat" /> : <Navigate to="/login" />} />
        <Route path="/login" element={isLoggedIn() ? <Navigate to="/chat" /> : <Login />} />
        <Route path="/register" element={isLoggedIn() ? <Navigate to="/chat" /> : <Register />} />
        <Route path="/chat" element={isLoggedIn() ? <Chat /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

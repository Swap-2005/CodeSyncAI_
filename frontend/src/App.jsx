import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from './Components/Home';
import Login from './Components/Login';
import Signup from './Components/Signup';
import Myassistant from './Components/myassistant';
import SchedulePage from './Components/SchedulePage';
import DSAProficiency from './Components/DSAProficiency';
import AnalyticsDashboard from './Components/AnalyticsDashboard';
import Navbar from './Components/Navbar';
import RecommendedQuestions from './Components/RecommendedQuestions';

function App() {
  // Function to get userId from token
  const getUserIdFromToken = () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return payload.user.id;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  return (
    <Router>
      <div className="min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/myassistant" element={<Myassistant />} />
            <Route path="/schedulepage" element={<SchedulePage />} />
            <Route path="/dsa-proficiency" element={<DSAProficiency />} />
            <Route path="/analytics" element={<AnalyticsDashboard userId={getUserIdFromToken()} />} />
            <Route path="/recommended" element={<RecommendedQuestions />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

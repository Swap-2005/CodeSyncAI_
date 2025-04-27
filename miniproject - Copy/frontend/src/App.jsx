import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from './Components/Home';
import Login from './Components/Login';
import Signup from './Components/Signup';
import Myassistant from './Components/myassistant';
import SchedulePage from './Components/SchedulePage';
import DSAProficiency from './Components/DSAProficiency';

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/myassistant" element={<Myassistant />} />
            <Route path="/schedulepage" element={<SchedulePage />} />
            <Route path="/dsa-proficiency" element={<DSAProficiency />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

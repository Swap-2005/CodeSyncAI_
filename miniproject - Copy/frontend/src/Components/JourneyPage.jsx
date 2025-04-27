import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const JourneyPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  const decodeToken = (token) => {
    if (!token) return null;
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(base64));
    } catch (error) {
      console.error("Invalid token:", error);
      return null;
    }
  };
  const fetchUserId = async () => {
    const token = localStorage.getItem("auth-token");
    if (!token) return null;
    const decoded = decodeToken(token);
    return decoded?.user?.id || null;
  };
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);

  useEffect(() => {
    const fetchRecommendedQuestions = async () => {
      
        // try {
        //     const userId = await fetchUserId();
        //     console.log(userId);
        //     const response = await fetch(`http://localhost:5000/api/recommendations?userId=${userId}`); // Changed to userId
        //     const data = await response.json();
        //     setRecommendedQuestions(data.questions);
        // } catch (error) {
        //     console.error("Error fetching recommendations:", error);
        // }
    };

    fetchRecommendedQuestions();
}, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-md transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* <div className="p-6">
          <img
            src={profile.photo}
            alt="Profile"
            className="rounded-full w-32 h-32 mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold text-center mb-2">
            {profile.name}
          </h2>
          <p className="text-gray-600 text-center">Streaks: {profile.streaks}</p>
        </div> */}
      </aside>

      <div className="flex flex-col w-full">
        {/* Header */}
        <header className="bg-white shadow p-6 w-full flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
          <div className="flex items-center">
            {/* Options */}
            <div className="flex space-x-4 mr-4">
              <button className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mb-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                Saved
              </button>
              <button className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mb-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                Chat
              </button>
              <button className="flex flex-col items-center text-gray-700 hover:text-blue-600 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mb-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5-1.253"
                />
                </svg>
                Guide
              </button>
            </div>
            {/* Profile */}
            <button
              onClick={toggleSidebar}
              className="rounded-full overflow-hidden w-10 h-10 border-2 border-gray-300"
            >
              {/* <img src={profile.photo} alt="Profile" /> */}
            </button>
          </div>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center p-8 w-full">
          {/* ... rest of your main content ... */}
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-12 text-center">
            {/* Main "Continue Journey" Box */}
            <div className="relative rounded-3xl bg-gradient-to-r from-blue-400 to-blue-600 p-16 text-white mb-12">
              <span className="text-4xl font-extrabold block mb-4">
                Continue Your Learning Journey
              </span>
              <p className="text-lg mb-8">
                Dive deeper into your learning path and unlock new knowledge.
              </p>
             
            <Link to="/SchedulePage"> <button className="bg-white text-blue-600 py-3 px-8 rounded-full font-semibold text-lg hover:bg-blue-100 transition-colors">
                Continue Now
              </button></Link> 
            </div>

            {/* Recommended Questions (Below Continue Journey) */}
<div className="w-full max-w-3xl bg-gray-100 rounded-2xl p-6 mt-8">
  <h2 className="text-xl font-semibold mb-4 text-left">
    Recommended Questions
  </h2>
  {recommendedQuestions.length > 0 ? (
    <ul className="space-y-4">
      {recommendedQuestions.map((question) => (
        <li key={question._id} className="bg-white rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-semibold text-gray-800">
                {question.question}
              </p>
              <p className="text-gray-600 text-sm">
                Topic: {question.topic}
              </p>
              <p className="text-gray-500 text-xs">
                Difficulty: {question.difficultyLevel}
              </p>
            </div>
            <a
              href={question.link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm"
            >
              View
            </a>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-gray-600 text-center mt-4">
      No recommendations available at the moment.
    </p>
  )}
</div>

    </div>
  </main>
</div>
</div>
);
};

export default JourneyPage;
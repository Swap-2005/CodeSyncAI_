import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useNavigate, useLocation } from "react-router-dom";

const DSAProficiency = ({ onComplete }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isNewUser = location.state?.isNewUser;
  const username = location.state?.username;

  const [showWelcome, setShowWelcome] = useState(isNewUser || false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showProficiency, setShowProficiency] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [proficiency, setProficiency] = useState({
    arrays: "Beginner",
    linked_lists: "Beginner",
    trees: "Beginner",
    graphs: "Beginner",
    dynamic_programming: "Beginner",
    sorting: "Beginner",
    searching: "Beginner",
    recursion: "Beginner"
  });
  const [schedule, setSchedule] = useState(null);
  const [dsaTopics, setDsaTopics] = useState([]);
  const [attempts, setAttempts] = useState({});
  const [questionStatus, setQuestionStatus] = useState({});
  const [skips, setSkips] = useState({});
  const [showSchedule, setShowSchedule] = useState(false);
  const [isSavingPerformance, setIsSavingPerformance] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [proficiencyVisible, setProficiencyVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("http://localhost:5000/get-topics");
        if (!response.ok) {
          throw new Error('Failed to fetch topics');
        }
        const data = await response.json();
        setDsaTopics(data.topics);
      } catch (error) {
        console.error("Error fetching topics:", error);
        setError('Failed to load topics. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTopics();
  }, []);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('auth-token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const handleWelcomeNext = () => {
    setShowWelcome(false);
    setShowCalendar(true);
  };

  const handleDateChange = (date) => {
    // Prevent selecting past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      setError("Cannot select past dates. Please choose today or a future date.");
      return;
    }
    
    setSelectedDate(date);
    setShowCalendar(false);
    setShowProficiency(true);
  };

  const handleProficiencyClick = (topic, level) => {
    setProficiency(prev => ({ ...prev, [topic]: level }));
  };

  const handleGenerateSchedule = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userInput = {
        proficiency,
        dailyTime: 120,
        startDate: selectedDate,
        enoughTime: true,
      };
      
      const token = localStorage.getItem("auth-token");
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      // First generate the schedule
      const response = await fetch("http://localhost:5000/generate-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "auth-token": token
        },
        body: JSON.stringify(userInput),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate schedule');
      }

      const data = await response.json();
      localStorage.setItem('generatedSchedule', JSON.stringify(data));

      const userId = await fetchUserId();
      if (!userId) {
        throw new Error('User not found. Please log in again.');
      }

      const formattedSchedule = {
        userId,
        schedules: [
          {
            dates: Object.entries(data).map(([date, questions]) => ({
              date,
              questions: questions.map((q) => ({
                questionId: q._id,
                status: "pending",
              })),
            })),
          },
        ],
      };

      const saveResponse = await fetch("http://localhost:5000/save-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "auth-token": token
        },
        body: JSON.stringify(formattedSchedule),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.message || 'Failed to save schedule');
      }

      navigate('/schedulepage');
      
    } catch (error) {
      console.error("Error generating/saving schedule:", error);
      if (error.message.includes('token') || error.message.includes('unauthorized')) {
        setError('Your session has expired. Please log in again.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(error.message || 'Failed to generate schedule. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserId = async () => {
    const token = localStorage.getItem("auth-token");
    if (!token) return null;
    const decoded = decodeToken(token);
    return decoded?.user?.id || null;
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

  const handleSaveSchedule = async () => {
    const token = localStorage.getItem("auth-token");
    const userId = await fetchUserId();
    if (!userId) {
      alert("User not found. Please log in again.");
      return;
    }
    const formattedSchedule = {
      userId,
      schedules: [
        {
          dates: Object.entries(schedule).map(([date, questions]) => ({
            date,
            questions: questions.map((q) => ({
              questionId: q._id,
              status: "pending",
            })),
          })),
        },
      ],
    };
    try {
      const res = await fetch("http://localhost:5000/save-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-token": token,
        },
        body: JSON.stringify(formattedSchedule),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Schedule saved successfully!");
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
    }
  };

  const handleAttemptChange = (e, questionId, date) => {
    const value = parseInt(e.target.value, 10) || 0;
    setAttempts((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSkipQuestion = (questionId, date) => {
    setSkips((prev) => ({ ...prev, [questionId]: (prev[questionId] || 0) + 1 }));
  };

  const handleStatusChange = (questionId, date) => {
    setQuestionStatus((prev) => {
      const newStatus = prev[questionId] === "completed" ? "pending" : "completed";
      return { ...prev, [questionId]: newStatus };
    });
  };

  const handleSaveProgress = async (date) => {
    setIsSavingPerformance((prev) => ({ ...prev, [date]: true }));
    try {
      const userId = await fetchUserId();
      const questionsForDate = schedule[date];
      if (questionsForDate) {
        for (const q of questionsForDate) {
          await saveUserPerformance(q._id, questionStatus[q._id] || "pending", attempts[q._id] || 0, skips[q._id] || 0);
        }
      }
      console.log(`Progress for ${date} saved successfully!`);
    } catch (error) {
      console.error(`Error saving progress for ${date}:`, error);
    } finally {
      setIsSavingPerformance((prev) => ({ ...prev, [date]: false }));
    }
  };

  const saveUserPerformance = async (questionId, status, attempts, skips) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const userId = await fetchUserId();
      const response = await fetch("http://localhost:5000/save-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, questionId, status, attempts, skips }),
      });
      const data = await response.json();
      console.log(response.ok ? "Performance saved successfully:" : "Failed to save performance:", data);
    } catch (error) {
      console.error("Error saving performance:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipProficiency = () => {
    setProficiencyVisible(false);
    handleGenerateSchedule();
  };

  const quotes = [
    "Pick a date, or the algorithms will pick you... for extra homework.",
    "Your coding adventure awaits! (But first, you gotta pick a date. No time travel allowed.)",
    "Don't let your DSA skills gather dust. Select a date and let's get this show on the road!",
  ];

  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(true);

  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuoteVisible(false);
      setTimeout(() => {
        setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
        setQuoteVisible(true);
      }, 500); // Wait for fade out, then change quote and fade in
    }, 4000); // Change quote every 4 seconds

    return () => clearInterval(quoteInterval); // Cleanup on unmount
  }, [quotes.length]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {error && (
        <div className="max-w-3xl mx-auto mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          {error}
        </div>
      )}
      
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {showWelcome && (
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 animate-fade-in">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to CodeSyncAI, {username}! 👋
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Let's personalize your learning journey to help you master Data Structures and Algorithms.
            </p>
            <div className="space-y-6 text-left mb-8">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Here's how it works:</h2>
                <ol className="space-y-4">
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-3">1</span>
                    <p className="text-gray-700">First, you'll select your preferred study schedule</p>
                  </li>
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-3">2</span>
                    <p className="text-gray-700">Then, you'll tell us about your current proficiency in different DSA topics</p>
                  </li>
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-3">3</span>
                    <p className="text-gray-700">Based on your inputs, we'll create a personalized learning path just for you</p>
                  </li>
                </ol>
              </div>
            </div>
            <button
              onClick={handleWelcomeNext}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Let's Get Started!
            </button>
          </div>
        </div>
      )}

      {showCalendar && (
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Choose Your Start Date</h2>
            <p className="text-gray-600 mt-2">Select when you'd like to begin your DSA learning journey</p>
          </div>
          <div className="flex justify-center">
            <Calendar
              onChange={handleDateChange}
              value={selectedDate}
              minDate={new Date()}
              className="rounded-lg border-0 shadow-md"
              tileClassName={({ date, view }) => {
                if (view === 'month') {
                  if (date.toDateString() === new Date().toDateString()) {
                    return 'bg-blue-100';
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {showProficiency && (
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Your DSA Proficiency</h2>
            <p className="text-gray-600 mt-2">Help us understand your current knowledge level in different topics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(proficiency).map(([topic, level]) => (
              <div key={topic} className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 capitalize">
                  {topic.replace(/_/g, ' ')}
                </h3>
                <div className="flex gap-3">
                  {['Beginner', 'Intermediate', 'Expert'].map((skillLevel) => (
                    <button
                      key={skillLevel}
                      onClick={() => handleProficiencyClick(topic, skillLevel)}
                      className={`flex-1 py-2 px-4 rounded-lg transition-all duration-200 ${
                        level === skillLevel
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {skillLevel}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <button
              onClick={handleGenerateSchedule}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Generate My Learning Path
            </button>
          </div>
        </div>
      )}
      {showSchedule && schedule && Object.keys(schedule).length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-4xl mt-5 ">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Generated Schedule</h2>
          <div className="flex justify-end mb-8">
            <button
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-full hover:from-purple-600 hover:to-blue-500 transition duration-300"
              onClick={handleSaveSchedule}
            >
              Save Schedule
            </button>
          </div>
          {Object.entries(schedule).map(([date, questions]) => (
            <div key={date} className="mb-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-700">{date}</h3>
                <button
                  className={`px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-300 ${
                    isSavingPerformance[date] ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                  onClick={() => handleSaveProgress(date)}
                  disabled={isSavingPerformance[date]}
                >
                  {isSavingPerformance[date] ? "Saving..." : "Save Progress"}
                </button>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="min-w-full bg-white border border-gray-200 rounded-2xl shadow-md">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skips</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {questions.map((q) => {
                      const isSkipped = skips[q._id] > 0;
                      const isCompleted = questionStatus[q._id] === "completed";
                      return (
                        <tr key={q._id} className={isSkipped ? "opacity-60" : ""}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{q.topic}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{q.question}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 underline">
                            <a href={q.link} target="_blank" rel="noopener noreferrer">
                              Link
                            </a>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            <input
                              type="number"
                              className="w-16 p-2 border border-gray-300 rounded-full focus:outline-none focus:ring focus:border-blue-300"
                              min="0"
                              value={attempts[q._id] || 0}
                              onChange={(e) => handleAttemptChange(e, q._id, date)}
                              disabled={!isCompleted || isSkipped}
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleStatusChange(q._id, date)}
                              className={`px-4 py-2 rounded-full transition duration-300 ${
                                isCompleted ? "bg-green-500 text-white hover:bg-green-600" : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                              }`}
                              disabled={isSkipped}
                            >
                              {isCompleted ? "Completed" : "Pending"}
                            </button>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleSkipQuestion(q._id, date)}
                              className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-300"
                              disabled={isSkipped}
                            >
                              {isSkipped ? "Skipped" : "Skip"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DSAProficiency;
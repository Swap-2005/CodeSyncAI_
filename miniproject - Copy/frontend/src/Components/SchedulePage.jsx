import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SchedulePage = () => {
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedDateQuestions, setSelectedDateQuestions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [attempts, setAttempts] = useState({});
  const [skips, setSkips] = useState({});
  const [questionStatus, setQuestionStatus] = useState({});
  const [isSavingPerformance, setIsSavingPerformance] = useState({});
  const [questionDetails, setQuestionDetails] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const navigate = useNavigate();

  const decodeToken = (token) => {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch (error) {
      console.error('Invalid token:', error);
      return null;
    }
  };

  const fetchUserId = async () => {
    const token = localStorage.getItem('auth-token');
    if (!token) return null;
    const decoded = decodeToken(token);
    return decoded?.user?.id || null;
  };

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const userId = await fetchUserId();
        if (!userId) {
          console.error('User ID not found');
          navigate('/login');
          return;
        }

        // First try to get from localStorage
        const storedSchedule = localStorage.getItem('generatedSchedule');
        if (storedSchedule) {
          const parsedSchedule = JSON.parse(storedSchedule);
          const today = getTodayDate();
          
          // Only set today's schedule
          if (parsedSchedule[today]) {
            setScheduleData({
              schedules: [{
                dates: [{
                  date: today,
                  questions: parsedSchedule[today].map(q => ({
                    questionId: q._id,
                    status: "pending"
                  }))
                }]
              }]
            });
            // Automatically select today's date and questions
            setSelectedDate(today);
            setSelectedDateQuestions(parsedSchedule[today].map(q => ({
              questionId: q._id,
              status: "pending"
            })));
          } else {
            navigate('/dsa-proficiency');
          }
          return;
        }

        // If not in localStorage, fetch from backend
        const response = await fetch(`http://localhost:5000/schedules/${userId}`);
        if (!response.ok) {
          if (response.status === 404) {
            navigate('/dsa-proficiency');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          const today = getTodayDate();
          const todaySchedule = data.schedule.schedules[0]?.dates.find(d => d.date === today);
          
          if (todaySchedule) {
            setScheduleData({
              schedules: [{
                dates: [todaySchedule]
              }]
            });
            setSelectedDate(today);
            setSelectedDateQuestions(todaySchedule.questions);
          } else {
            navigate('/dsa-proficiency');
          }
        } else {
          console.error('Schedule not found:', data.message);
          navigate('/dsa-proficiency');
        }
      } catch (error) {
        console.error('Error fetching schedule:', error);
        navigate('/dsa-proficiency');
      }
    };

    fetchSchedule();
  }, [navigate]);

  useEffect(() => {
    if (selectedDateQuestions && selectedDateQuestions.length > 0) {
      const initialAttempts = {};
      const initialSkips = {};
      const initialStatus = {};

      selectedDateQuestions.forEach((q) => {
        initialAttempts[q.questionId] = 0;
        initialSkips[q.questionId] = 0;
        initialStatus[q.questionId] = q.status || 'pending';
      });

      setAttempts(initialAttempts);
      setSkips(initialSkips);
      setQuestionStatus(initialStatus);
    }
  }, [selectedDateQuestions]);

  useEffect(() => {
    const fetchQuestionDetails = async () => {
      if (selectedDateQuestions && selectedDateQuestions.length > 0) {
        const details = {};
        for (const question of selectedDateQuestions) {
          try {
            const response = await fetch(`http://localhost:5000/questions/${question.questionId}`);
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                details[question.questionId] = data.question;
              } else {
                console.error(`Question ${question.questionId} not found`);
              }
            } else {
              console.error(`Failed to fetch question ${question.questionId}`);
            }
          } catch (error) {
            console.error(`Error fetching question ${question.questionId}:`, error);
          }
        }
        setQuestionDetails(details);
      }
    };
    fetchQuestionDetails();
  }, [selectedDateQuestions]);

  // Helper function to check if a date is in the past
  const isPastDate = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    
    // Convert both dates to YYYY-MM-DD format for comparison
    const todayStr = today.toISOString().split('T')[0];
    const checkDateStr = checkDate.toISOString().split('T')[0];
    
    return checkDateStr < todayStr;
  };

  // Helper function to check if a date is today
  const isToday = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    
    // Convert both dates to YYYY-MM-DD format for comparison
    const todayStr = today.toISOString().split('T')[0];
    const checkDateStr = checkDate.toISOString().split('T')[0];
    
    return checkDateStr === todayStr;
  };

  // Helper function to check if a question is done (either completed or skipped)
  const isQuestionDone = (questionId) => {
    return questionStatus[questionId] === 'completed' || skips[questionId] > 0;
  };

  // Helper function to check if all questions are done
  const areAllQuestionsDone = (questions) => {
    if (!questions || questions.length === 0) return false;
    console.log('Checking completion status:', questions.map(q => ({
      id: q.questionId,
      status: questionStatus[q.questionId],
      skipped: skips[q.questionId] > 0
    })));
    return questions.every(q => isQuestionDone(q.questionId));
  };

  const handleDateClick = (date, questions) => {
    // Prevent selecting past dates
    if (isPastDate(date)) {
      alert("Cannot select past dates");
      return;
    }
    
    // Only allow selecting today's date
    if (!isToday(date)) {
      alert("You can only view today's questions");
      return;
    }

    setSelectedDate(date);
    setSelectedDateQuestions(questions);
  };

  const handleAttemptChange = (e, questionId, date) => {
    setAttempts({ ...attempts, [questionId]: parseInt(e.target.value) });
  };

  const handleStatusChange = (questionId, date) => {
    setQuestionStatus(prev => {
      const newStatus = prev[questionId] === 'completed' ? 'pending' : 'completed';
      console.log('Updating status for question:', questionId, 'to:', newStatus);
      return { ...prev, [questionId]: newStatus };
    });
  };

  // Modified handleSkipQuestion to also update the status
  const handleSkipQuestion = async (questionId, date) => {
    try {
      const userId = await fetchUserId();
      // Mark as skipped in UI
      setSkips(prev => ({ ...prev, [questionId]: (prev[questionId] || 0) + 1 }));
      
      // Notify backend about skipped question
      const response = await fetch('http://localhost:5000/save-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify({
          userId,
          questionId,
          status: 'skipped',
          attempts: 0,
          skips: 1
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update skipped question status');
      }

      // Also update the question status to reflect it's done
      setQuestionStatus(prev => ({
        ...prev,
        [questionId]: 'skipped'
      }));

    } catch (error) {
      console.error('Error updating skipped question:', error);
    }
  };

  const handleSaveProgress = async (date) => {
    console.log('Starting save progress...', { date, questionStatus, skips, selectedDateQuestions });
    setIsSavingPerformance({ ...isSavingPerformance, [date]: true });
    
    try {
      const questionsForDate = selectedDateQuestions;
      console.log('Questions for date:', questionsForDate);

      if (questionsForDate && questionsForDate.length > 0) {
        // Log the status of each question
        questionsForDate.forEach(q => {
          console.log(`Question ${q.questionId}: Status=${questionStatus[q.questionId]}, Skips=${skips[q.questionId]}`);
        });

        // Save progress for each question
        for (const q of questionsForDate) {
          await saveUserPerformance(
            q.questionId, 
            questionStatus[q.questionId] || 'pending', 
            attempts[q.questionId] || 0, 
            skips[q.questionId] || 0
          );
        }
        
        // Check if all questions are done
        const allDone = questionsForDate.every(q => {
          const isDone = questionStatus[q.questionId] === 'completed' || skips[q.questionId] > 0;
          console.log(`Question ${q.questionId} done status:`, isDone);
          return isDone;
        });

        console.log('All questions done?', allDone);

        if (allDone) {
          console.log('All questions are done, fetching recommendations...');
          const userId = await fetchUserId();
          const token = localStorage.getItem('auth-token');
          
          const completedQuestions = questionsForDate
            .filter(q => questionStatus[q.questionId] === 'completed')
            .map(q => q.questionId);
          
          const skippedQuestions = questionsForDate
            .filter(q => skips[q.questionId] > 0)
            .map(q => q.questionId);

          console.log('Sending recommendation request:', {
            userId,
            completedQuestions,
            skippedQuestions
          });

          try {
            const response = await fetch('http://localhost:5000/get-recommendations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                userId,
                completedQuestions,
                skippedQuestions,
                date
              })
            });

            console.log('Recommendation response status:', response.status);
            
            if (response.ok) {
              const data = await response.json();
              console.log('Received recommendations:', data);
              
              if (data.questions && data.questions.length > 0) {
                console.log('Setting recommendations in state...');
                setRecommendedQuestions(data.questions.map(q => ({
                  ...q,
                  isRecommended: true
                })));
                setShowRecommendations(true);
              } else {
                console.log('No recommendations received');
              }
            } else {
              const errorText = await response.text();
              console.error('Failed to fetch recommendations:', errorText);
            }
          } catch (error) {
            console.error('Error during recommendation fetch:', error);
          }
        } else {
          console.log('Not all questions are done yet');
          setShowRecommendations(false);
          setRecommendedQuestions([]);
        }
      }
    } catch (error) {
      console.error(`Error in save progress:`, error);
    } finally {
      setIsSavingPerformance({ ...isSavingPerformance, [date]: false });
    }
  };

  const saveUserPerformance = async (questionId, status, attempts, skips) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const userId = await fetchUserId();
      const response = await fetch('http://localhost:5000/save-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, questionId, status, attempts, skips }),
      });
      const data = await response.json();
      console.log(response.ok ? 'Performance saved successfully:' : 'Failed to save performance:', data);
    } catch (error) {
      console.error('Error saving performance:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!scheduleData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  const dates = scheduleData.schedules[0]?.dates || [];

  // Filter out past dates and sort by date
  const validDates = dates
    .filter(dateObj => !isPastDate(dateObj.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Add console log to render to see if recommendations are in state
  console.log('Current render state:', {
    showRecommendations,
    recommendedQuestions,
    questionStatus,
    skips
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Today's Practice Schedule</h1>
          
          {selectedDateQuestions.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-2xl shadow-md">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difficulty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skips</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedDateQuestions.map((q) => {
                      const isSkipped = skips[q.questionId] > 0;
                      const isCompleted = questionStatus[q.questionId] === 'completed';
                      const details = questionDetails[q.questionId];
                      return (
                        <tr key={q.questionId} className={isSkipped ? 'opacity-60' : ''}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {details ? details.topic : 'Topic not found'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {details ? details.question : 'Question not found'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 underline">
                            {details && (
                              <a href={details.link} target="_blank" rel="noopener noreferrer">
                                Link
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {details ? details.difficultylevel : 'N/A'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {details ? details.priority : 'N/A'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            <input
                              type="number"
                              className="w-16 p-2 border border-gray-300 rounded-full focus:outline-none focus:ring focus:border-blue-300"
                              min="0"
                              value={attempts[q.questionId] || 0}
                              onChange={(e) => handleAttemptChange(e, q.questionId, selectedDate)}
                              disabled={!isCompleted || isSkipped}
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleStatusChange(q.questionId, selectedDate)}
                              className={`px-4 py-2 rounded-full transition duration-300 ${
                                isCompleted ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                              }`}
                              disabled={isSkipped}
                            >
                              {isCompleted ? 'Completed' : 'Pending'}
                            </button>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleSkipQuestion(q.questionId, selectedDate)}
                              className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-300"
                              disabled={isSkipped}
                            >
                              {isSkipped ? 'Skipped' : 'Skip'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Recommended Questions */}
                    {showRecommendations && recommendedQuestions.map((question, index) => (
                      <tr key={`rec-${index}`} className="bg-blue-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {question.topic}
                          <span className="ml-2 text-xs text-blue-600">(Recommended)</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {question.question}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 underline">
                          <a href={question.link} target="_blank" rel="noopener noreferrer">
                            Link
                          </a>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {question.difficultylevel}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {question.priority || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          <input
                            type="number"
                            className="w-16 p-2 border border-gray-300 rounded-full focus:outline-none focus:ring focus:border-blue-300"
                            min="0"
                            value={attempts[question._id] || 0}
                            onChange={(e) => handleAttemptChange(e, question._id, selectedDate)}
                            disabled={questionStatus[question._id] === 'completed'}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleStatusChange(question._id, selectedDate)}
                            className={`px-4 py-2 rounded-full transition duration-300 ${
                              questionStatus[question._id] === 'completed' 
                                ? 'bg-green-500 text-white hover:bg-green-600' 
                                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                            }`}
                          >
                            {questionStatus[question._id] === 'completed' ? 'Completed' : 'Pending'}
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleSkipQuestion(question._id, selectedDate)}
                            className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-300"
                            disabled={questionStatus[question._id] === 'completed'}
                          >
                            Skip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  className={`px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-300 ${
                    isSavingPerformance[selectedDate] ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                  onClick={() => handleSaveProgress(selectedDate)}
                  disabled={isSavingPerformance[selectedDate]}
                >
                  {isSavingPerformance[selectedDate] ? 'Saving...' : 'Save Progress'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No questions scheduled for today.</p>
              <button
                onClick={() => navigate('/dsa-proficiency')}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-300"
              >
                Generate New Schedule
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SchedulePage;
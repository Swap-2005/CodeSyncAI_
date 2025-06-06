import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import mockRecommendedQuestions from '../mockRecommendedQuestions';

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
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
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

  const handleStatusChange = async (questionId, newStatus) => {
    try {
        // Get token and validate
        const token = localStorage.getItem('auth-token');
        if (!token) {
            throw new Error('Authentication token not found');
        }

        // Get userId
        const userId = await fetchUserId();
        if (!userId) {
            throw new Error('User ID not found');
        }

        // Get question details
        const question = questionDetails[questionId];
        if (!question) {
            throw new Error('Question details not found');
        }

        // Ensure we have a valid MongoDB ObjectId for the question
        const mongoQuestionId = question._id;
        if (!mongoQuestionId) {
            throw new Error('Invalid question ID format');
        }

        // Optimistically update the UI
        setQuestionStatus(prev => ({ ...prev, [questionId]: newStatus }));

        // Prepare the request data
        const requestData = {
            userId,
            questionId: mongoQuestionId,
            status: newStatus,
            attempts: attempts[questionId] || 0,
            skips: skips[questionId] || 0,
            timeSpent: 0, // Default value
            difficulty: question.difficultylevel?.toLowerCase() || 'medium'
        };

        console.log('Sending performance data:', requestData);

        // Update the question status in the backend
        const response = await fetch('http://localhost:5000/save-performance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestData)
        });

        const responseData = await response.json();
        console.log('Performance update response:', responseData);

        if (!response.ok) {
            throw new Error(responseData.error || responseData.details || 'Failed to update question status');
        }

        // If the question was completed, update analytics
        if (newStatus === 'completed') {
            const analyticsData = {
                userId,
                questionId: mongoQuestionId,
                timeSpent: 30, // Default to 30 minutes if completed
                topic: question.topic || 'unknown',
                difficulty: question.difficultylevel?.toLowerCase() || 'medium',
                status: newStatus
            };

            console.log('Sending analytics data:', analyticsData);

            const analyticsResponse = await fetch('http://localhost:5000/api/analytics/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(analyticsData)
            });

            const analyticsResponseData = await analyticsResponse.json();
            console.log('Analytics update response:', analyticsResponseData);

            if (!analyticsResponse.ok) {
                throw new Error(analyticsResponseData.error || 'Failed to update analytics');
            }

            // Check if all questions for today are completed
            const allCompleted = selectedDateQuestions.every(q => 
                questionStatus[q.questionId] === 'completed' || skips[q.questionId] > 0
            );
            if (allCompleted) {
                setShowCompletionModal(true);
                await checkDailyCompletion();
            }
        }

        // Update selectedDateQuestions to reflect the new status
        setSelectedDateQuestions(prev => 
            prev.map(q => q.questionId === questionId ? { ...q, status: newStatus } : q)
        );

        // Show success message
        setMessage('Question status updated successfully');
        setTimeout(() => setMessage(''), 3000);

    } catch (error) {
        console.error('Error updating question status:', error);
        // Revert the status change in the UI
        setQuestionStatus(prev => ({ ...prev, [questionId]: currentStatus }));
        setSelectedDateQuestions(prev => 
            prev.map(q => q.questionId === questionId ? { ...q, status: currentStatus } : q)
        );
        // Show error message to user
        setError(`Failed to update question status: ${error.message}`);
        setTimeout(() => setError(''), 5000);
    }
  };

  const handleSkipQuestion = async (questionId) => {
    try {
        const userId = await fetchUserId();
        if (!userId) {
            console.error('No userId found');
            setError('User session not found. Please log in again.');
            return;
        }

        setLoading(true);
        const questionToSkip = selectedDateQuestions.find(q => q.questionId === questionId);
        
        if (!questionToSkip) {
            throw new Error('Question not found in schedule');
        }

        const question = questionDetails[questionId];
        if (!question) {
            throw new Error('Question details not found');
        }

        // Normalize the difficulty level to match the enum in the schema
        let normalizedDifficulty = (question.difficultylevel || 'medium').toLowerCase();
        // Ensure difficulty is one of: 'easy', 'medium', 'hard'
        if (!['easy', 'medium', 'hard'].includes(normalizedDifficulty)) {
            normalizedDifficulty = 'medium';
        }
        
        // First update the analytics with minimal required data
        const analyticsResponse = await fetch('http://localhost:5000/api/analytics/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                questionId: questionId,
                timeSpent: 0,
                status: 'skipped',
                topic: question.topic || 'unknown',
                difficulty: normalizedDifficulty
            })
        });

        let errorData;
        const responseText = await analyticsResponse.text();
        try {
            errorData = JSON.parse(responseText);
        } catch (e) {
            errorData = { error: responseText };
        }

        if (!analyticsResponse.ok) {
            console.error('Analytics update failed:', errorData);
            throw new Error(`Analytics update failed: ${errorData.error || 'Unknown error'}`);
        }

        // Then update the performance data
        const performanceResponse = await fetch('http://localhost:5000/api/performance/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                questionId: questionId,
                status: 'skipped',
                timeSpent: 0,
                difficulty: normalizedDifficulty
            })
        });

        if (!performanceResponse.ok) {
            const perfErrorData = await performanceResponse.text();
            try {
                const jsonError = JSON.parse(perfErrorData);
                throw new Error(`Performance update failed: ${jsonError.error || 'Unknown error'}`);
            } catch (e) {
                throw new Error(`Performance update failed: ${perfErrorData}`);
            }
        }

        // Update UI
        setSkips(prevSkips => ({ ...prevSkips, [questionId]: (prevSkips[questionId] || 0) + 1 }));
        setQuestionStatus(prevStatus => ({ ...prevStatus, [questionId]: 'skipped' }));
        setSelectedDateQuestions(prevQuestions => 
            prevQuestions.map(q => 
                q.questionId === questionId 
                    ? { ...q, status: 'skipped' } 
                    : q
            )
        );

        // Show success message
        setMessage('Question marked as skipped');
        setTimeout(() => setMessage(''), 3000);

    } catch (error) {
        console.error('Error skipping question:', error);
        setError(`Failed to skip question: ${error.message}`);
        setTimeout(() => setError(''), 5000);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveProgress = async (date) => {
    console.log('Starting save progress...', { date, questionStatus, skips, selectedDateQuestions });
    setIsSavingPerformance({ ...isSavingPerformance, [date]: true });
    
    try {
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('User session not found. Please log in again.');
      }

      const userId = await fetchUserId();
      if (!userId) {
        throw new Error('Could not get user ID');
      }

      const questionsForDate = selectedDateQuestions;
      console.log('Questions for date:', questionsForDate);

      if (!questionsForDate || questionsForDate.length === 0) {
        throw new Error('No questions found for this date');
      }

      // Group questions by status
      const completedQuestions = [];
      const skippedQuestions = [];
      const errors = [];

      for (const q of questionsForDate) {
        const status = questionStatus[q.questionId];
        const question = questionDetails[q.questionId];
        
        console.log('Processing question:', {
          questionId: q.questionId,
          status,
          hasDetails: !!question,
          details: question
        });

        if (!question) {
          errors.push(`Missing details for question ${q.questionId}`);
          continue;
        }

        const questionData = {
          questionId: question._id || q.questionId,
          status: status || 'pending',
          attempts: attempts[q.questionId] || 0,
          skips: skips[q.questionId] || 0,
          timeSpent: timeSpent[q.questionId] || 0,
          difficulty: question.difficultylevel || 'medium',
          topic: question.topic || 'unknown'
        };

        if (status === 'completed') {
          completedQuestions.push(questionData);
        } else if (status === 'skipped') {
          skippedQuestions.push(questionData);
        }
      }

      // Log the grouped questions
      console.log('Grouped questions:', {
        completed: completedQuestions,
        skipped: skippedQuestions,
        errors
      });

      // Save performance for completed questions
      for (const questionData of completedQuestions) {
        try {
          const response = await fetch('http://localhost:5000/save-performance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              ...questionData,
              userId
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save performance');
          }

          // Update analytics for completed questions
          await fetch('http://localhost:5000/api/analytics/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              userId,
              ...questionData
            })
          });
        } catch (error) {
          errors.push(`Failed to save performance for question ${questionData.questionId}: ${error.message}`);
        }
      }

      // Save performance for skipped questions
      for (const questionData of skippedQuestions) {
        try {
          const response = await fetch('http://localhost:5000/save-performance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              ...questionData,
              userId
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save performance');
          }
        } catch (error) {
          errors.push(`Failed to save performance for skipped question ${questionData.questionId}: ${error.message}`);
        }
      }

      // Check if all questions are completed
      const allCompleted = questionsForDate.every(q => 
        questionStatus[q.questionId] === 'completed' || questionStatus[q.questionId] === 'skipped'
      );

      if (allCompleted) {
        console.log('All questions completed, checking recommendations...');
        setShowCompletionModal(true);
        await checkDailyCompletion();
      }

      // Show success/warning message
      if (errors.length > 0) {
        setError(`Saved with some issues: ${errors.join(', ')}`);
        setTimeout(() => setError(''), 5000);
      } else {
        setMessage('Progress saved successfully');
        setTimeout(() => setMessage(''), 3000);
      }

    } catch (error) {
      console.error('Error saving progress:', error);
      setError(error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsSavingPerformance({ ...isSavingPerformance, [date]: false });
    }
  };

  const updateAnalytics = async (questionData) => {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');

        const analyticsData = {
            userId,
            questionId: questionData.questionId,
            timeSpent: questionData.timeSpent || 0,
            topic: questionData.topic,
            difficulty: questionData.difficulty,
            completed: questionData.status === 'completed',
            timestamp: new Date().toISOString()
        };

        const response = await fetch('http://localhost:5000/api/analytics/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(analyticsData)
        });

        if (!response.ok) throw new Error('Failed to update analytics');
        
        const data = await response.json();
        if (data.streak) {
            setStreak(data.streak);
        }
    } catch (error) {
        console.error('Error updating analytics:', error);
    }
  };

  const checkDailyCompletion = async () => {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) return;

        const response = await fetch(`http://localhost:5000/api/daily-progress/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) throw new Error('Failed to fetch daily progress');
        
        const data = await response.json();
        if (data.allCompleted) {
            setShowCompletionMessage(true);
            updateStreak();
        }
    } catch (error) {
        console.error('Error checking daily completion:', error);
    }
  };

  const updateStreak = async () => {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) return;

        const response = await fetch(`http://localhost:5000/api/streak/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) throw new Error('Failed to update streak');
        
        const data = await response.json();
        setStreak(data.currentStreak);
    } catch (error) {
        console.error('Error updating streak:', error);
    }
  };

  // Update the saveUserPerformance function to include analytics
  const saveUserPerformance = async (questionId, status) => {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');

        const performanceData = {
            userId,
            questionId,
            status,
            attempts: attempts[questionId] || 0,
            skips: skips[questionId] || 0
        };

      const response = await fetch('http://localhost:5000/save-performance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(performanceData)
        });

        if (!response.ok) throw new Error('Failed to save performance');

        // Update analytics if question is completed
        if (status === 'completed') {
            const questionData = selectedDateQuestions.find(q => q._id === questionId);
            if (questionData) {
                await updateAnalytics(questionData);
                await checkDailyCompletion();
            }
        }

        // Update UI
        setSelectedDateQuestions(selectedDateQuestions.map(q => 
            q._id === questionId ? { ...q, status: status } : q
        ));
    } catch (error) {
        console.error('Error saving performance:', error);
    }
  };

  const generateSchedule = async (proficiencyData) => {
    try {
      // Get user history first
      const history = await fetch(`http://localhost:5000/api/user-history/${userId}`).then(res => res.json());
      
      // Get enhanced recommendations
      const recommendationsResponse = await fetch('http://localhost:5000/api/enhanced-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          history: history.data,
        }),
      });
      
      const recommendations = await recommendationsResponse.json();
      
      // Generate schedule with enhanced recommendations
      const scheduleResponse = await fetch('http://localhost:5000/generate-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': localStorage.getItem('auth-token'),
        },
        body: JSON.stringify({
          proficiency: proficiencyData,
          dailyTime: 120, // 2 hours default
          startDate: new Date().toISOString(),
          enoughTime: true,
          recommendations: recommendations.data,
        }),
      });

      const scheduleData = await scheduleResponse.json();
      setScheduleData(scheduleData);
      
      // Update analytics after schedule generation
      await fetch('http://localhost:5000/api/analytics/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          questionsCompleted: 0,
          timeSpent: 0,
          topic: 'schedule_generation',
          difficulty: 'NA',
          completed: true
        }),
      });

    } catch (error) {
      console.error('Error generating schedule:', error);
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
          <button
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-300"
            onClick={() => {
              setShowRecommendations(true);
              setRecommendedQuestions(mockRecommendedQuestions.map(q => ({
                ...q,
                questionId: q._id,
                status: 'pending'
              })));
            }}
          >
            Load Mock Recommendations
          </button>
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Today's Practice Schedule</h1>
          
          {showCompletionMessage && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  🎉 Congratulations!
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  You've completed all your questions for today! Keep up the great work and maintain your learning streak.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCompletionMessage(false)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition duration-200"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}
          
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
                              onClick={() => handleStatusChange(q.questionId, isCompleted ? 'pending' : 'completed')}
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
                              onClick={() => handleSkipQuestion(q.questionId)}
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
                            onClick={() => handleStatusChange(question._id, questionStatus[question._id] === 'completed' ? 'pending' : 'completed')}
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
                            onClick={() => handleSkipQuestion(question._id)}
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
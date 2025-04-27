import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ScheduleDisplay.css';

const ScheduleDisplay = ({ questions, onSave }) => {
  const [attempts, setAttempts] = useState({});
  const [status, setStatus] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedSchedule = localStorage.getItem('generatedSchedule');
    if (storedSchedule) {
      try {
        const parsedSchedule = JSON.parse(storedSchedule);
        console.log('Parsed schedule:', parsedSchedule);
        
        const today = new Date().toISOString().split('T')[0];
        
        if (parsedSchedule[today]) {
          setQuestions(parsedSchedule[today]);
        } else {
          console.log('No questions scheduled for today');
          setQuestions([]);
        }
      } catch (error) {
        console.error('Error parsing schedule:', error);
        navigate('/dsa-proficiency');
      }
    } else {
      navigate('/dsa-proficiency');
    }
  }, [navigate]);

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

  const handleAttemptChange = (questionId, value) => {
    setAttempts(prev => ({
      ...prev,
      [questionId]: Math.max(0, parseInt(value) || 0)
    }));
  };

  const handleStatusToggle = (questionId) => {
    setStatus(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const handleSkip = (questionId) => {
    setStatus(prev => ({
      ...prev,
      [questionId]: false
    }));
    setAttempts(prev => ({
      ...prev,
      [questionId]: 0
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ attempts, status });
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      'Easy': 'easy',
      'Medium': 'medium',
      'Hard': 'hard'
    };
    return colors[difficulty] || '';
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Questions Scheduled</h2>
        <p>There are no questions scheduled for today. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="schedule-container">
      <div className="schedule-layout">
        <div className="daily-questions-section">
          <h1 className="schedule-title">Today's Practice Schedule</h1>
          <div className="questions-grid">
            {questions.map((question) => (
              <div key={question.id} className="question-card">
                <div className="question-header">
                  <span className="topic-badge">{question.topic}</span>
                  <span className={`difficulty-badge ${getDifficultyColor(question.difficulty).toLowerCase()}`}>
                    {question.difficulty}
                  </span>
                </div>
                <div className="question-content">
                  <p className="question-description">{question.description}</p>
                  <div className="question-controls">
                    <div className="attempt-counter">
                      <label>Attempts:</label>
                      <input
                        type="number"
                        min="0"
                        value={attempts[question.id] || 0}
                        onChange={(e) => handleAttemptChange(question.id, e.target.value)}
                      />
                    </div>
                    <button
                      className={`status-button ${status[question.id] ? 'completed' : ''}`}
                      onClick={() => handleStatusToggle(question.id)}
                    >
                      {status[question.id] ? 'Completed ✓' : 'Mark as Complete'}
                    </button>
                    <button
                      className="skip-button"
                      onClick={() => handleSkip(question.id)}
                    >
                      Skip Question
                    </button>
                  </div>
                  <div className="resource-link">
                    <a
                      href={question.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="solve-link"
                    >
                      Solve Question
                      <span className="arrow">→</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            className={`save-button ${isSaving ? 'saving' : ''}`}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Progress'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDisplay;
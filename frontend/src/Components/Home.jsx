import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DSAProficiency from './DSAProficiency'

function Home() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserStatus = async () => {
      const token = localStorage.getItem('auth-token');
      
      // If no token, redirect to login
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        // Check if user has an existing schedule
        const userId = await fetchUserId(token);
        if (!userId) {
          navigate('/login');
          return;
        }

        const response = await fetch(`http://localhost:5000/schedules/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // If user has a schedule, redirect to schedule page
        if (response.ok) {
          navigate('/schedulepage');
          return;
        }

        // Also check localStorage for generated schedule
        const storedSchedule = localStorage.getItem('generatedSchedule');
        if (storedSchedule) {
          navigate('/schedulepage');
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Error checking user status:', error);
        setLoading(false);
      }
    };

    checkUserStatus();
  }, [navigate]);

  const fetchUserId = async (token) => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DSAProficiency onComplete={() => {
        localStorage.setItem('proficiency-completed', 'true');
        navigate('/schedulepage');
      }}/>
    </div>
  );
}

export default Home

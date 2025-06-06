import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import mockAnalytics from '../mockAnalytics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Use mock data instead of fetching from API
    setAnalytics(mockAnalytics);
    setLoading(false);
  }, []);

  if (loading || !analytics) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading analytics: {error}
        </div>
      </div>
    );
  }

  // Prepare data for Progress Timeline Chart
  const progressChartData = {
    labels: analytics.dailyProgress?.map(entry => entry.date) || [],
    datasets: [{
      label: 'Questions Completed',
      data: analytics.dailyProgress?.map(entry => entry.questionsCompleted) || [],
      fill: false,
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  };

  // Prepare data for Topic Distribution Pie Chart
  const topicChartData = {
    labels: analytics.topicStats?.map(topic => topic.topic) || [],
    datasets: [{
      data: analytics.topicStats?.map(topic => topic.completed) || [],
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40',
        '#FF6384',
        '#36A2EB'
      ]
    }]
  };

  // Calculate total questions completed
  const totalCompleted = analytics.topicStats?.reduce((sum, t) => sum + t.completed, 0) || 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Your Learning Analytics (Mock Data)</h1>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-600">Questions Completed</h3>
          <p className="text-3xl font-bold text-blue-600">{totalCompleted}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-600">Current Streak</h3>
          <p className="text-3xl font-bold text-orange-600">{analytics.streaks?.current || 0} days</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-600">Longest Streak</h3>
          <p className="text-3xl font-bold text-green-600">{analytics.streaks?.longest || 0} days</p>
        </div>
      </div>

      {/* Progress Timeline Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Progress Timeline</h2>
        <div className="h-64">
          <Line
            data={progressChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1
                  }
                }
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Topic Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Topic Distribution</h2>
          <div className="h-64">
            <Pie data={topicChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Difficulty Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Difficulty Breakdown</h2>
          <div className="space-y-4">
            {Object.entries(analytics.difficultyStats).map(([difficulty, stats]) => (
              <div key={difficulty}>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700">{difficulty}</span>
                  <span className="text-gray-600">
                    {stats.completed}/{stats.attempted} ({stats.attempted > 0 
                      ? Math.round((stats.completed / stats.attempted) * 100) 
                      : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      difficulty === 'Easy' ? 'bg-green-600' :
                      difficulty === 'Medium' ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${stats.attempted > 0 
                      ? (stats.completed / stats.attempted) * 100 
                      : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard; 
const mockAnalytics = {
  dailyProgress: [
    { date: "2024-04-01", questionsCompleted: 3, timeSpent: 70, topics: [{ name: "Arrays", count: 1 }, { name: "Strings", count: 2 }] },
    { date: "2024-04-02", questionsCompleted: 5, timeSpent: 120, topics: [{ name: "Linked List", count: 2 }, { name: "Trees", count: 3 }] },
    { date: "2024-04-03", questionsCompleted: 2, timeSpent: 40, topics: [{ name: "Stacks", count: 1 }, { name: "Queues", count: 1 }] },
    { date: "2024-04-04", questionsCompleted: 4, timeSpent: 90, topics: [{ name: "DP", count: 2 }, { name: "Graphs", count: 2 }] },
    { date: "2024-04-05", questionsCompleted: 6, timeSpent: 150, topics: [{ name: "Trees", count: 3 }, { name: "Arrays", count: 3 }] },
    { date: "2024-04-06", questionsCompleted: 5, timeSpent: 110, topics: [{ name: "Strings", count: 2 }, { name: "DP", count: 3 }] },
    { date: "2024-04-07", questionsCompleted: 1, timeSpent: 20, topics: [{ name: "Graphs", count: 1 }] },
    { date: "2024-04-08", questionsCompleted: 4, timeSpent: 85, topics: [{ name: "Queues", count: 2 }, { name: "Linked List", count: 2 }] },
    { date: "2024-04-09", questionsCompleted: 5, timeSpent: 120, topics: [{ name: "Arrays", count: 2 }, { name: "Trees", count: 3 }] },
    { date: "2024-04-10", questionsCompleted: 3, timeSpent: 60, topics: [{ name: "DP", count: 1 }, { name: "Graphs", count: 2 }] },
    { date: "2024-04-11", questionsCompleted: 5, timeSpent: 130, topics: [{ name: "Strings", count: 2 }, { name: "DP", count: 3 }] },
    { date: "2024-04-12", questionsCompleted: 2, timeSpent: 35, topics: [{ name: "Graphs", count: 2 }] },
    { date: "2024-04-13", questionsCompleted: 4, timeSpent: 90, topics: [{ name: "Queues", count: 2 }, { name: "Linked List", count: 2 }] },
    { date: "2024-04-14", questionsCompleted: 6, timeSpent: 140, topics: [{ name: "Arrays", count: 3 }, { name: "Trees", count: 3 }] },
    { date: "2024-04-15", questionsCompleted: 5, timeSpent: 120, topics: [{ name: "DP", count: 2 }, { name: "Graphs", count: 3 }] },
    { date: "2024-04-16", questionsCompleted: 3, timeSpent: 55, topics: [{ name: "Strings", count: 1 }, { name: "DP", count: 2 }] },
    { date: "2024-04-17", questionsCompleted: 4, timeSpent: 100, topics: [{ name: "Graphs", count: 2 }, { name: "Stacks", count: 2 }] },
    { date: "2024-04-18", questionsCompleted: 2, timeSpent: 30, topics: [{ name: "Queues", count: 1 }, { name: "Linked List", count: 1 }] },
    { date: "2024-04-19", questionsCompleted: 5, timeSpent: 110, topics: [{ name: "Arrays", count: 2 }, { name: "Trees", count: 3 }] },
    { date: "2024-04-20", questionsCompleted: 6, timeSpent: 150, topics: [{ name: "Graphs", count: 3 }, { name: "DP", count: 3 }] }
  ],
  topicStats: [
    { topic: "Arrays", completed: 15, attempted: 18, avgTimeSpent: 22 },
    { topic: "Strings", completed: 12, attempted: 15, avgTimeSpent: 20 },
    { topic: "Linked List", completed: 10, attempted: 12, avgTimeSpent: 25 },
    { topic: "Trees", completed: 13, attempted: 15, avgTimeSpent: 28 },
    { topic: "Graphs", completed: 20, attempted: 22, avgTimeSpent: 30 },
    { topic: "DP", completed: 15, attempted: 18, avgTimeSpent: 35 },
    { topic: "Stacks", completed: 8, attempted: 10, avgTimeSpent: 18 },
    { topic: "Queues", completed: 7, attempted: 10, avgTimeSpent: 19 }
  ],
  streaks: {
    current: 20,
    longest: 20,
    lastActive: "2024-04-20"
  },
  difficultyStats: {
    Easy: { completed: 30, attempted: 35 },
    Medium: { completed: 50, attempted: 55 },
    Hard: { completed: 20, attempted: 25 }
  }
};

export default mockAnalytics; 
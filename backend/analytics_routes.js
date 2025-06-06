const express = require('express');
const router = express.Router();
const Analytics = require('./models/Analytics');

// Get user analytics
router.get('/analytics/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const analytics = await Analytics.find({ userId }).sort({ date: -1 });
        
        // Calculate progress over time
        const progressOverTime = analytics.map(entry => ({
            date: entry.date.toISOString().split('T')[0],
            questionsCompleted: entry.questionsCompleted,
            timeSpent: entry.timeSpent
        }));

        // Calculate topic distribution
        const topicDistribution = [];
        const latestAnalytics = analytics[0];
        if (latestAnalytics && latestAnalytics.topicProgress) {
            for (const [topic, progress] of latestAnalytics.topicProgress) {
                topicDistribution.push({
                    name: topic,
                    value: progress.completed
                });
            }
        }

        // Calculate completion rates
        const last7Days = analytics.slice(0, 7);
        const completionRates = {
            daily: (last7Days[0]?.questionsCompleted || 0) / 5 * 100, // Assuming 5 questions per day goal
            weekly: last7Days.reduce((acc, curr) => acc + curr.questionsCompleted, 0) / 35 * 100 // Assuming 35 questions per week goal
        };

        // Calculate streak data
        const streakData = {
            currentStreak: latestAnalytics?.streak || 0,
            totalQuestions: analytics.reduce((acc, curr) => acc + curr.questionsCompleted, 0)
        };

        // Calculate difficulty stats
        const difficultyStats = [];
        if (latestAnalytics?.difficultyStats) {
            for (const [difficulty, stats] of Object.entries(latestAnalytics.difficultyStats)) {
                difficultyStats.push({
                    difficulty,
                    count: stats.completed,
                    successRate: (stats.completed / stats.attempted * 100).toFixed(1)
                });
            }
        }

        res.json({
            progressOverTime,
            topicDistribution,
            completionRates,
            streakData,
            difficultyStats
        });

    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Update analytics
router.post('/analytics/update', async (req, res) => {
    try {
        const {
            userId,
            questionsCompleted,
            timeSpent,
            topic,
            difficulty,
            completed
        } = req.body;

        let analytics = await Analytics.findOne({ 
            userId,
            date: {
                $gte: new Date().setHours(0, 0, 0, 0),
                $lt: new Date().setHours(23, 59, 59, 999)
            }
        });

        if (!analytics) {
            analytics = new Analytics({
                userId,
                topicProgress: new Map(),
                difficultyStats: {
                    Easy: { completed: 0, attempted: 0 },
                    Medium: { completed: 0, attempted: 0 },
                    Hard: { completed: 0, attempted: 0 }
                }
            });
        }

        // Update basic stats
        analytics.questionsCompleted += questionsCompleted;
        analytics.timeSpent += timeSpent;

        // Update topic progress
        const topicStats = analytics.topicProgress.get(topic) || {
            completed: 0,
            attempted: 0,
            timeSpent: 0
        };
        topicStats.attempted += 1;
        if (completed) topicStats.completed += 1;
        topicStats.timeSpent += timeSpent;
        analytics.topicProgress.set(topic, topicStats);

        // Update difficulty stats
        analytics.difficultyStats[difficulty].attempted += 1;
        if (completed) analytics.difficultyStats[difficulty].completed += 1;

        // Update streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const wasActiveYesterday = await Analytics.findOne({
            userId,
            date: {
                $gte: yesterday.setHours(0, 0, 0, 0),
                $lt: yesterday.setHours(23, 59, 59, 999)
            }
        });

        if (wasActiveYesterday) {
            analytics.streak += 1;
        } else {
            analytics.streak = 1;
        }

        analytics.lastActive = new Date();
        await analytics.save();

        res.json({ success: true, analytics });

    } catch (error) {
        console.error('Error updating analytics:', error);
        res.status(500).json({ error: 'Failed to update analytics' });
    }
});

module.exports = router; 
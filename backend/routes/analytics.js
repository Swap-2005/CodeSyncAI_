const express = require('express');
const router = express.Router();
const Analytics = require('../models/Analytics');
const mongoose = require('mongoose');

// Middleware to validate ObjectId
const validateObjectId = (req, res, next) => {
    const userId = req.params.userId || req.body.userId;
    const questionId = req.body.questionId;

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Invalid userId format' });
    }
    if (questionId && !mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ error: 'Invalid questionId format' });
    }
    next();
};

// Get user analytics summary
router.get('/summary/:userId', validateObjectId, async (req, res) => {
    try {
        const { userId } = req.params;
        let analytics = await Analytics.findOne({ userId });
        
        if (!analytics) {
            analytics = new Analytics({ userId });
            await analytics.save();
        }
        
        res.json(analytics.getSummary());
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
});

// Get detailed user analytics
router.get('/:userId', validateObjectId, async (req, res) => {
    try {
        const { userId } = req.params;
        let analytics = await Analytics.findOne({ userId })
            .populate('completedQuestions.questionId', 'topic question difficultylevel');
        
        if (!analytics) {
            analytics = new Analytics({
                userId,
                dailyProgress: [],
                topicStats: [],
                difficultyStats: {
                    easy: { attempted: 0, completed: 0, averageTime: 0 },
                    medium: { attempted: 0, completed: 0, averageTime: 0 },
                    hard: { attempted: 0, completed: 0, averageTime: 0 }
                },
                streak: {
                    current: 0,
                    highest: 0,
                    lastActive: new Date()
                }
            });
            await analytics.save();
        }
        
        res.json(analytics);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Update analytics when a question is completed or skipped
router.post('/update', validateObjectId, async (req, res) => {
    try {
        const { userId, questionId, timeSpent, status, topic, difficulty } = req.body;

        // Input validation
        if (!userId || !questionId || !status || !topic || !difficulty) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: {
                    userId: !userId ? 'missing' : 'present',
                    questionId: !questionId ? 'missing' : 'present',
                    status: !status ? 'missing' : 'present',
                    topic: !topic ? 'missing' : 'present',
                    difficulty: !difficulty ? 'missing' : 'present'
                }
            });
        }

        // Validate status
        if (!['completed', 'skipped', 'attempted'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                details: `Status must be one of: 'completed', 'skipped', 'attempted'`
            });
        }

        // Validate difficulty
        const validDifficulty = difficulty.toLowerCase();
        if (!['easy', 'medium', 'hard'].includes(validDifficulty)) {
            return res.status(400).json({
                error: 'Invalid difficulty',
                details: `Difficulty must be one of: 'easy', 'medium', 'hard'`
            });
        }

        // Find or create analytics document
        let analytics = await Analytics.findOne({ userId });
        
        if (!analytics) {
            analytics = new Analytics({
                userId,
                dailyProgress: [],
                topicStats: [],
                difficultyStats: {
                    easy: { attempted: 0, completed: 0, averageTime: 0 },
                    medium: { attempted: 0, completed: 0, averageTime: 0 },
                    hard: { attempted: 0, completed: 0, averageTime: 0 }
                },
                streak: {
                    current: 0,
                    highest: 0,
                    lastActive: new Date()
                }
            });
        }

        // Get today's date (YYYY-MM-DD format)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find or create today's progress entry
        let todayProgress = analytics.dailyProgress.find(p => {
            const progressDate = new Date(p.date);
            return progressDate.getTime() === today.getTime();
        });

        if (!todayProgress) {
            todayProgress = {
                date: today,
                questionsCompleted: 0,
                timeSpent: 0,
                topics: []
            };
            analytics.dailyProgress.push(todayProgress);
        }

        // Update daily progress
        if (status === 'completed') {
            todayProgress.questionsCompleted = (todayProgress.questionsCompleted || 0) + 1;
            
            // Update topics in daily progress
            let topicEntry = todayProgress.topics.find(t => t.name === topic);
            if (topicEntry) {
                topicEntry.count = (topicEntry.count || 0) + 1;
            } else {
                todayProgress.topics.push({ name: topic, count: 1 });
            }
        }
        if (timeSpent) {
            todayProgress.timeSpent = (todayProgress.timeSpent || 0) + timeSpent;
        }

        // Update topic stats
        let topicStat = analytics.topicStats.find(t => t.topic === topic);
        if (!topicStat) {
            topicStat = {
                topic,
                questionsAttempted: 0,
                questionsCompleted: 0,
                averageTimeSpent: 0
            };
            analytics.topicStats.push(topicStat);
        }

        topicStat.questionsAttempted = (topicStat.questionsAttempted || 0) + 1;
        if (status === 'completed') {
            topicStat.questionsCompleted = (topicStat.questionsCompleted || 0) + 1;
        }
        if (timeSpent) {
            const totalTime = (topicStat.averageTimeSpent || 0) * (topicStat.questionsAttempted - 1) + timeSpent;
            topicStat.averageTimeSpent = totalTime / topicStat.questionsAttempted;
        }

        // Update difficulty stats
        analytics.difficultyStats[validDifficulty].attempted += 1;
        if (status === 'completed') {
            analytics.difficultyStats[validDifficulty].completed += 1;
        }
        if (timeSpent) {
            const stats = analytics.difficultyStats[validDifficulty];
            const totalTime = (stats.averageTime || 0) * (stats.attempted - 1) + timeSpent;
            stats.averageTime = totalTime / stats.attempted;
        }

        // Add to completed questions
        analytics.completedQuestions.push({
            questionId,
            completedAt: new Date(),
            timeSpent: timeSpent || 0,
            topic,
            difficulty: validDifficulty,
            status
        });

        // Update streak
        const lastActiveDate = new Date(analytics.streak.lastActive);
        lastActiveDate.setHours(0, 0, 0, 0);
        const dayDiff = Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));

        if (dayDiff === 1) {
            analytics.streak.current += 1;
        } else if (dayDiff > 1) {
            analytics.streak.current = 1;
        }
        analytics.streak.lastActive = today;

        // Save analytics
        await analytics.save();

        res.json({
            success: true,
            analytics: analytics.getSummary()
        });

    } catch (error) {
        console.error('Error updating analytics:', error);
        res.status(500).json({
            error: 'Failed to update analytics',
            details: error.message
        });
    }
});

// Get streak info
router.get('/streak/:userId', validateObjectId, async (req, res) => {
    try {
        const analytics = await Analytics.findOne({ userId: req.params.userId });
        if (!analytics) {
            return res.json({ currentStreak: 0, highestStreak: 0 });
        }
        res.json({
            currentStreak: analytics.streak.current,
            highestStreak: analytics.streak.highest
        });
    } catch (error) {
        console.error('Error fetching streak:', error);
        res.status(500).json({ error: 'Failed to fetch streak info' });
    }
});

// Get daily progress
router.get('/daily-progress/:userId', validateObjectId, async (req, res) => {
    try {
        const analytics = await Analytics.findOne({ userId: req.params.userId });
        if (!analytics) {
            return res.json([]);
        }
        
        // Get last 30 days of progress
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentProgress = analytics.dailyProgress
            .filter(progress => new Date(progress.date) >= thirtyDaysAgo)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json(recentProgress);
    } catch (error) {
        console.error('Error fetching daily progress:', error);
        res.status(500).json({ error: 'Failed to fetch daily progress' });
    }
});

module.exports = router; 
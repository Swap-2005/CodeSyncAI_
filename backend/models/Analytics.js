const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    dailyProgress: [{
        date: {
            type: Date,
            required: true
        },
        questionsCompleted: {
            type: Number,
            default: 0,
            min: 0
        },
        timeSpent: {
            type: Number,
            default: 0,
            min: 0
        },
        topics: [{
            name: {
                type: String,
                required: true
            },
            count: {
                type: Number,
                default: 0,
                min: 0
            }
        }]
    }],
    topicStats: [{
        topic: {
            type: String,
            required: true
        },
        questionsAttempted: {
            type: Number,
            default: 0,
            min: 0
        },
        questionsCompleted: {
            type: Number,
            default: 0,
            min: 0
        },
        averageTimeSpent: {
            type: Number,
            default: 0,
            min: 0
        }
    }],
    difficultyStats: {
        easy: {
            attempted: { type: Number, default: 0, min: 0 },
            completed: { type: Number, default: 0, min: 0 },
            averageTime: { type: Number, default: 0, min: 0 }
        },
        medium: {
            attempted: { type: Number, default: 0, min: 0 },
            completed: { type: Number, default: 0, min: 0 },
            averageTime: { type: Number, default: 0, min: 0 }
        },
        hard: {
            attempted: { type: Number, default: 0, min: 0 },
            completed: { type: Number, default: 0, min: 0 },
            averageTime: { type: Number, default: 0, min: 0 }
        }
    },
    streak: {
        current: {
            type: Number,
            default: 0,
            min: 0
        },
        highest: {
            type: Number,
            default: 0,
            min: 0
        },
        lastActive: {
            type: Date,
            default: Date.now
        }
    },
    completedQuestions: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Question'
        },
        completedAt: {
            type: Date,
            default: Date.now
        },
        timeSpent: {
            type: Number,
            default: 0,
            min: 0
        },
        topic: {
            type: String,
            required: true
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard'],
            required: true
        },
        status: {
            type: String,
            enum: ['completed', 'skipped', 'attempted'],
            required: true
        }
    }]
}, {
    timestamps: true
});

// Indexes for efficient queries
analyticsSchema.index({ userId: 1, 'dailyProgress.date': 1 });
analyticsSchema.index({ userId: 1, 'completedQuestions.questionId': 1 });
analyticsSchema.index({ userId: 1, 'topicStats.topic': 1 });

// Pre-save middleware to ensure highest streak is updated
analyticsSchema.pre('save', function(next) {
    if (this.streak.current > this.streak.highest) {
        this.streak.highest = this.streak.current;
    }
    next();
});

// Method to get analytics summary
analyticsSchema.methods.getSummary = function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
        totalQuestionsCompleted: this.completedQuestions.filter(q => q.status === 'completed').length,
        todayProgress: this.dailyProgress.find(p => new Date(p.date).getTime() === today.getTime()) || {
            questionsCompleted: 0,
            timeSpent: 0,
            topics: []
        },
        streak: this.streak,
        topicsProgress: this.topicStats.map(t => ({
            topic: t.topic,
            completion: (t.questionsCompleted / (t.questionsAttempted || 1)) * 100
        }))
    };
};

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics; 
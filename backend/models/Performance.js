const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Users',
        index: true
    },
    questions: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Question'
        },
        status: {
            type: String,
            enum: ['completed', 'skipped', 'attempted', 'pending'],
            required: true
        },
        attempts: {
            type: Number,
            default: 0
        },
        skips: {
            type: Number,
            default: 0
        },
        timeSpent: {
            type: Number,
            default: 0
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard'],
            default: 'medium'
        },
        lastAttempted: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

performanceSchema.index({ userId: 1, 'questions.questionId': 1 });

const Performance = mongoose.model('Performance', performanceSchema);

module.exports = Performance; 
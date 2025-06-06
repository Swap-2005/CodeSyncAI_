const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: true
    },
    question: {
        type: String,
        required: true
    },
    difficultylevel: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        required: true
    },
    priority: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true
});

questionSchema.index({ topic: 1, difficultylevel: 1 });

const Question = mongoose.model('Question', questionSchema);

module.exports = Question; 
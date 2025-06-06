const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    cartData: {
        type: Object,
        default: {}
    },
    proficiency: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true
});

const Users = mongoose.model('Users', userSchema);

module.exports = Users; 
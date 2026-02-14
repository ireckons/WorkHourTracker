const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        startAt: {
            type: Date,
            required: [true, 'Session start time is required'],
        },
        endAt: {
            type: Date,
            default: null, // null means the session is still active
        },
    },
    { timestamps: true }
);

// Compound index for efficient per-user date-range queries
sessionSchema.index({ userId: 1, startAt: 1 });

module.exports = mongoose.model('Session', sessionSchema);

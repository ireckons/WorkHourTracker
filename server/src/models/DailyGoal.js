const mongoose = require('mongoose');

const dailyGoalSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        date: {
            type: String, // 'YYYY-MM-DD' in user's local timezone
            required: true,
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
        },
        goalHours: {
            type: Number,
            required: true,
            min: 0.5,
            max: 24,
        },
    },
    { timestamps: true }
);

// Each user can have only one goal per date
dailyGoalSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyGoal', dailyGoalSchema);

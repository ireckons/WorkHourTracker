const express = require('express');
const auth = require('../middleware/auth');
const DailyGoal = require('../models/DailyGoal');
const User = require('../models/User');
const { validate, goalRules, dateQueryRule } = require('../middleware/validate');
const { getTodayInTimezone } = require('../utils/time');

const router = express.Router();

// All goal routes require authentication
router.use(auth);

/**
 * GET /api/goals?date=YYYY-MM-DD
 * Get the daily goal for a specific date.
 * Falls back to the user's default if no custom goal exists.
 *
 * Response: { date, goalHours, isDefault }
 */
router.get('/', validate(dateQueryRule), async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const timezone = user.timezone || 'UTC';
        const date = req.query.date || getTodayInTimezone(timezone);

        const goalDoc = await DailyGoal.findOne({ userId: req.userId, date });

        if (goalDoc) {
            res.json({ date, goalHours: goalDoc.goalHours, isDefault: false });
        } else {
            res.json({ date, goalHours: user.defaultDailyGoal, isDefault: true });
        }
    } catch (err) {
        console.error('Get goal error:', err);
        res.status(500).json({ error: 'Failed to get goal' });
    }
});

/**
 * PUT /api/goals
 * Set or update the daily goal for a specific date.
 * Uses upsert to create or update in a single operation.
 *
 * Request:  { date: 'YYYY-MM-DD', goalHours: 6 }
 * Response: { goal: { userId, date, goalHours } }
 */
router.put('/', validate(goalRules), async (req, res) => {
    try {
        const { date, goalHours } = req.body;

        const goal = await DailyGoal.findOneAndUpdate(
            { userId: req.userId, date },
            { goalHours },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({ goal });
    } catch (err) {
        console.error('Set goal error:', err);
        res.status(500).json({ error: 'Failed to set goal' });
    }
});

module.exports = router;

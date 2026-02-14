const express = require('express');
const auth = require('../middleware/auth');
const Session = require('../models/Session');
const User = require('../models/User');
const { validate, dateQueryRule } = require('../middleware/validate');
const {
    computeDayTotal,
    computeProgressPercent,
    getTodayInTimezone,
    getDayBounds,
    formatDuration,
    splitSessionByDay,
} = require('../utils/time');

const router = express.Router();

// All session routes require authentication
router.use(auth);

/**
 * POST /api/sessions/start
 * Starts a new work session. Only one active session (no endAt) allowed at a time.
 *
 * Response: { session: { _id, userId, startAt, endAt } }
 */
router.post('/start', async (req, res) => {
    try {
        // Check for an already-active session
        const activeSession = await Session.findOne({
            userId: req.userId,
            endAt: null,
        });

        if (activeSession) {
            return res.status(400).json({
                error: 'You already have an active session',
                activeSession,
            });
        }

        const session = new Session({
            userId: req.userId,
            startAt: new Date(),
        });

        await session.save();
        res.status(201).json({ session });
    } catch (err) {
        console.error('Start session error:', err);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

/**
 * PATCH /api/sessions/end
 * Ends the currently active session by setting endAt to now.
 *
 * Response: { session: { _id, userId, startAt, endAt } }
 */
router.patch('/end', async (req, res) => {
    try {
        const session = await Session.findOne({
            userId: req.userId,
            endAt: null,
        });

        if (!session) {
            return res.status(400).json({ error: 'No active session to end' });
        }

        session.endAt = new Date();
        await session.save();

        res.json({ session });
    } catch (err) {
        console.error('End session error:', err);
        res.status(500).json({ error: 'Failed to end session' });
    }
});

/**
 * GET /api/sessions?date=YYYY-MM-DD
 * List all sessions that overlap the given calendar day (in the user's timezone).
 * Defaults to today if no date is provided.
 *
 * Response: { sessions: [...], date: 'YYYY-MM-DD' }
 */
router.get('/', validate(dateQueryRule), async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const timezone = user.timezone || 'UTC';
        const date = req.query.date || getTodayInTimezone(timezone);
        const { dayStart, dayEnd } = getDayBounds(date, timezone);

        // Find sessions that overlap this day:
        //   session starts before day end AND (session ends after day start OR is still active)
        const sessions = await Session.find({
            userId: req.userId,
            startAt: { $lt: dayEnd },
            $or: [{ endAt: { $gte: dayStart } }, { endAt: null }],
        }).sort({ startAt: 1 });

        res.json({ sessions, date });
    } catch (err) {
        console.error('List sessions error:', err);
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});

/**
 * GET /api/sessions/today/summary
 * Returns today's summary: total worked time, progress, active session, and goal.
 *
 * Response: {
 *   date, totalMs, totalFormatted, goalHours, progressPercent,
 *   activeSession, sessions
 * }
 */
router.get('/today/summary', async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const timezone = user.timezone || 'UTC';
        const today = getTodayInTimezone(timezone);
        const { dayStart, dayEnd } = getDayBounds(today, timezone);

        const sessions = await Session.find({
            userId: req.userId,
            startAt: { $lt: dayEnd },
            $or: [{ endAt: { $gte: dayStart } }, { endAt: null }],
        }).sort({ startAt: 1 });

        const totalMs = computeDayTotal(sessions, today, timezone);

        // Get goal for today (or fall back to user's default)
        const DailyGoal = require('../models/DailyGoal');
        const goalDoc = await DailyGoal.findOne({ userId: req.userId, date: today });
        const goalHours = goalDoc ? goalDoc.goalHours : user.defaultDailyGoal;

        const progressPercent = computeProgressPercent(totalMs, goalHours);
        const activeSession = sessions.find((s) => !s.endAt) || null;

        res.json({
            date: today,
            totalMs,
            totalFormatted: formatDuration(totalMs),
            goalHours,
            progressPercent: Math.round(progressPercent * 100) / 100,
            activeSession,
            sessions,
        });
    } catch (err) {
        console.error('Today summary error:', err);
        res.status(500).json({ error: 'Failed to get today summary' });
    }
});

module.exports = router;

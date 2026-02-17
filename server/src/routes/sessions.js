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
 * GET /api/sessions/today/summary?date=YYYY-MM-DD
 * Returns a day's summary: total worked time, progress, active session, and goal.
 * Defaults to today if no date is provided.
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
        const date = (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date))
            ? req.query.date
            : getTodayInTimezone(timezone);
        const { dayStart, dayEnd } = getDayBounds(date, timezone);

        const sessions = await Session.find({
            userId: req.userId,
            startAt: { $lt: dayEnd },
            $or: [{ endAt: { $gte: dayStart } }, { endAt: null }],
        }).sort({ startAt: 1 });

        const totalMs = computeDayTotal(sessions, date, timezone);

        // Get goal for this day (or fall back to user's default)
        const DailyGoal = require('../models/DailyGoal');
        const goalDoc = await DailyGoal.findOne({ userId: req.userId, date });
        const goalHours = goalDoc ? goalDoc.goalHours : user.defaultDailyGoal;

        const progressPercent = computeProgressPercent(totalMs, goalHours);
        const activeSession = sessions.find((s) => !s.endAt) || null;

        res.json({
            date,
            totalMs,
            totalFormatted: formatDuration(totalMs),
            goalHours,
            progressPercent: Math.round(progressPercent * 100) / 100,
            activeSession,
            sessions,
        });
    } catch (err) {
        console.error('Day summary error:', err);
        res.status(500).json({ error: 'Failed to get day summary' });
    }
});

/**
 * GET /api/sessions/monthly-summary?month=YYYY-MM
 * Returns per-day work hours for the entire month.
 *
 * Response: { month, days: { 'YYYY-MM-DD': { totalMs, totalFormatted } } }
 */
router.get('/monthly-summary', async (req, res) => {
    try {
        const { DateTime } = require('luxon');
        const user = await User.findById(req.userId);
        const timezone = user.timezone || 'UTC';

        // Determine which month to query (default to current month)
        const now = DateTime.now().setZone(timezone);
        const monthParam = req.query.month; // 'YYYY-MM'
        let monthStart;
        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            monthStart = DateTime.fromFormat(monthParam + '-01', 'yyyy-MM-dd', { zone: timezone }).startOf('day');
        } else {
            monthStart = now.startOf('month');
        }
        const nextMonth = monthStart.plus({ months: 1 });

        // Build array of all dates in the month
        const dates = [];
        let cursor = monthStart;
        while (cursor < nextMonth) {
            dates.push(cursor.toFormat('yyyy-MM-dd'));
            cursor = cursor.plus({ days: 1 });
        }

        // Find all sessions that overlap this month
        const sessions = await Session.find({
            userId: req.userId,
            startAt: { $lt: nextMonth.toJSDate() },
            $or: [{ endAt: { $gte: monthStart.toJSDate() } }, { endAt: null }],
        }).sort({ startAt: 1 });

        // Compute per-day totals
        const days = {};
        for (const date of dates) {
            days[date] = { totalMs: 0, totalFormatted: '00:00' };
        }

        for (const session of sessions) {
            const segments = splitSessionByDay(session, timezone);
            for (const seg of segments) {
                if (days[seg.date]) {
                    days[seg.date].totalMs += seg.durationMs;
                }
            }
        }

        // Format durations
        for (const date of dates) {
            days[date].totalFormatted = formatDuration(days[date].totalMs);
        }

        res.json({
            month: monthStart.toFormat('yyyy-MM'),
            days,
        });
    } catch (err) {
        console.error('Monthly summary error:', err);
        res.status(500).json({ error: 'Failed to get monthly summary' });
    }
});

module.exports = router;

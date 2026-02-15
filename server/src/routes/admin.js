const express = require('express');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const User = require('../models/User');
const Session = require('../models/Session');
const DailyGoal = require('../models/DailyGoal');
const AdminInvite = require('../models/AdminInvite');
const AuditLog = require('../models/AuditLog');
const { validate, promoteRules, inviteRules, dateQueryRule } = require('../middleware/validate');
const {
    computeDayTotal,
    computeProgressPercent,
    getTodayInTimezone,
    getDayBounds,
    formatDuration,
    getWeekBounds,
    getMonthBounds,
    computeRangeTotal,
} = require('../utils/time');

const router = express.Router();

// All admin routes require authentication + admin check
router.use(auth, adminOnly);

/**
 * GET /api/admin/users?date=YYYY-MM-DD
 * Returns all users with computed hours, goals, progress, and online status.
 */
router.get('/users', validate(dateQueryRule), async (req, res) => {
    try {
        const users = await User.find().select('-passwordHash').lean();
        const date = req.query.date || getTodayInTimezone('Asia/Kolkata');

        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const timezone = user.timezone || 'UTC';
                const effectiveDate = req.query.date || getTodayInTimezone(timezone);
                const { dayStart, dayEnd } = getDayBounds(effectiveDate, timezone);

                // Get sessions overlapping this day
                const sessions = await Session.find({
                    userId: user._id,
                    startAt: { $lt: dayEnd },
                    $or: [{ endAt: { $gte: dayStart } }, { endAt: null }],
                }).sort({ startAt: 1 });

                const totalMs = computeDayTotal(sessions, effectiveDate, timezone);

                // Get goal
                const goalDoc = await DailyGoal.findOne({ userId: user._id, date: effectiveDate });
                const goalHours = goalDoc ? goalDoc.goalHours : user.defaultDailyGoal;

                const progressPercent = computeProgressPercent(totalMs, goalHours);
                const isOnline = sessions.some((s) => !s.endAt);

                // --- Weekly totals (always current week, Mon-Sun) ---
                const week = getWeekBounds(timezone);
                const weekSessions = await Session.find({
                    userId: user._id,
                    startAt: { $lt: week.rangeEnd },
                    $or: [{ endAt: { $gte: week.rangeStart } }, { endAt: null }],
                });
                const weekTotalMs = computeRangeTotal(weekSessions, week.dates, timezone);

                // Sum goals for each day of the week
                const weekGoalDocs = await DailyGoal.find({
                    userId: user._id,
                    date: { $in: week.dates },
                }).lean();
                const weekGoalMap = {};
                for (const g of weekGoalDocs) weekGoalMap[g.date] = g.goalHours;
                const weekGoalHours = week.dates.reduce(
                    (sum, d) => sum + (weekGoalMap[d] !== undefined ? weekGoalMap[d] : user.defaultDailyGoal),
                    0
                );

                // --- Monthly totals (always current month) ---
                const month = getMonthBounds(timezone);
                const monthSessions = await Session.find({
                    userId: user._id,
                    startAt: { $lt: month.rangeEnd },
                    $or: [{ endAt: { $gte: month.rangeStart } }, { endAt: null }],
                });
                const monthTotalMs = computeRangeTotal(monthSessions, month.dates, timezone);

                const monthGoalDocs = await DailyGoal.find({
                    userId: user._id,
                    date: { $in: month.dates },
                }).lean();
                const monthGoalMap = {};
                for (const g of monthGoalDocs) monthGoalMap[g.date] = g.goalHours;
                const monthGoalHours = month.dates.reduce(
                    (sum, d) => sum + (monthGoalMap[d] !== undefined ? monthGoalMap[d] : user.defaultDailyGoal),
                    0
                );

                return {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    totalMs,
                    totalFormatted: formatDuration(totalMs),
                    goalHours,
                    progressPercent: Math.round(progressPercent * 100) / 100,
                    isOnline,
                    lastLoginAt: user.lastLoginAt,
                    // Period stats
                    weekTotalHours: Math.round((weekTotalMs / 3600000) * 10) / 10,
                    weekGoalHours: Math.round(weekGoalHours * 10) / 10,
                    monthTotalHours: Math.round((monthTotalMs / 3600000) * 10) / 10,
                    monthGoalHours: Math.round(monthGoalHours * 10) / 10,
                };
            })
        );

        res.json({ users: usersWithStats, date });
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/admin/users/:userId/sessions?date=YYYY-MM-DD
 * View any user's sessions for a specific date.
 */
router.get('/users/:userId/sessions', validate(dateQueryRule), async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const timezone = user.timezone || 'UTC';
        const date = req.query.date || getTodayInTimezone(timezone);
        const { dayStart, dayEnd } = getDayBounds(date, timezone);

        const sessions = await Session.find({
            userId: user._id,
            startAt: { $lt: dayEnd },
            $or: [{ endAt: { $gte: dayStart } }, { endAt: null }],
        }).sort({ startAt: 1 });

        const totalMs = computeDayTotal(sessions, date, timezone);

        res.json({
            user: { _id: user._id, name: user.name, email: user.email },
            date,
            totalMs,
            totalFormatted: formatDuration(totalMs),
            sessions,
        });
    } catch (err) {
        console.error('Admin user sessions error:', err);
        res.status(500).json({ error: 'Failed to fetch user sessions' });
    }
});

/**
 * POST /api/admin/promote
 * Promote or demote a user. Body: { userId, makeAdmin: true|false }
 * Writes to AuditLog.
 */
router.post('/promote', validate(promoteRules), async (req, res) => {
    try {
        const { userId, makeAdmin } = req.body;

        const targetUser = await User.findById(userId);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        // Prevent self-demotion (last admin safeguard)
        if (!makeAdmin && userId === req.userId.toString()) {
            return res.status(400).json({ error: 'You cannot demote yourself' });
        }

        const previousAdmin = targetUser.isAdmin;
        targetUser.isAdmin = makeAdmin;
        await targetUser.save();

        const action = makeAdmin ? 'PROMOTE' : 'DEMOTE';
        await AuditLog.record(action, req.userId, targetUser._id, {
            previousAdmin,
            newAdmin: makeAdmin,
        });

        res.json({
            message: `User ${makeAdmin ? 'promoted to' : 'demoted from'} admin`,
            user: targetUser.toJSON(),
        });
    } catch (err) {
        console.error('Admin promote error:', err);
        res.status(500).json({ error: 'Failed to update admin status' });
    }
});

/**
 * POST /api/admin/invite
 * Create an admin invite token. Body: { email, expiresInHours? }
 * Returns the token (and invite link).
 */
router.post('/invite', validate(inviteRules), async (req, res) => {
    try {
        const { email, expiresInHours } = req.body;
        const hours = expiresInHours || parseInt(process.env.ADMIN_INVITE_EXPIRY_HOURS, 10) || 48;

        // Check if there's already a pending unused invite for this email
        const existingInvite = await AdminInvite.findOne({ email, usedAt: null });
        if (existingInvite && existingInvite.isValid()) {
            return res.status(409).json({
                error: 'A pending invite already exists for this email',
                expiresAt: existingInvite.expiresAt,
            });
        }

        const invite = new AdminInvite({
            email,
            invitedByUserId: req.userId,
            expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
        });

        await invite.save();

        await AuditLog.record('INVITE_CREATED', req.userId, null, {
            inviteEmail: email,
            expiresAt: invite.expiresAt,
            tokenPrefix: invite.token.substring(0, 8),
        });

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const inviteLink = `${clientUrl}/register?inviteToken=${invite.token}`;

        res.status(201).json({
            message: 'Admin invite created',
            invite: {
                email: invite.email,
                token: invite.token,
                expiresAt: invite.expiresAt,
                inviteLink,
            },
        });
    } catch (err) {
        console.error('Admin invite error:', err);
        res.status(500).json({ error: 'Failed to create invite' });
    }
});

/**
 * GET /api/admin/audit?page=1&limit=50
 * Returns audit logs, most recent first. Paginated.
 */
router.get('/audit', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            AuditLog.find()
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .populate('actorUserId', 'name email')
                .populate('targetUserId', 'name email')
                .lean(),
            AuditLog.countDocuments(),
        ]);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error('Admin audit error:', err);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/admin/export?date=YYYY-MM-DD
 * Export daily summary as CSV.
 */
router.get('/export', validate(dateQueryRule), async (req, res) => {
    try {
        const users = await User.find().select('-passwordHash').lean();
        const date = req.query.date || getTodayInTimezone('Asia/Kolkata');

        const rows = [['Name', 'Email', 'Hours Worked', 'Goal Hours', 'Progress %', 'Status']];

        for (const user of users) {
            const timezone = user.timezone || 'UTC';
            const effectiveDate = req.query.date || getTodayInTimezone(timezone);
            const { dayStart, dayEnd } = getDayBounds(effectiveDate, timezone);

            const sessions = await Session.find({
                userId: user._id,
                startAt: { $lt: dayEnd },
                $or: [{ endAt: { $gte: dayStart } }, { endAt: null }],
            });

            const totalMs = computeDayTotal(sessions, effectiveDate, timezone);
            const goalDoc = await DailyGoal.findOne({ userId: user._id, date: effectiveDate });
            const goalHours = goalDoc ? goalDoc.goalHours : user.defaultDailyGoal;
            const progress = computeProgressPercent(totalMs, goalHours);
            const isOnline = sessions.some((s) => !s.endAt);

            rows.push([
                user.name,
                user.email,
                (totalMs / 3600000).toFixed(2),
                goalHours.toString(),
                Math.round(progress).toString(),
                isOnline ? 'Online' : 'Offline',
            ]);
        }

        const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="daily-summary-${date}.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Admin export error:', err);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

module.exports = router;

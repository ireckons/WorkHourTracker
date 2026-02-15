const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminInvite = require('../models/AdminInvite');
const AuditLog = require('../models/AuditLog');
const authLimiter = require('../middleware/rateLimiter');
const { validate, registerRules, loginRules } = require('../middleware/validate');

const router = express.Router();

/**
 * Helper: create a JWT and set it as an HttpOnly cookie.
 * Includes isAdmin in the JWT claims (verified from DB at sign-in time).
 */
function setTokenCookie(res, userId, isAdmin = false) {
    const token = jwt.sign({ userId, isAdmin }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return token;
}

/**
 * POST /api/auth/register
 * Request:  { name, email, password, timezone?, defaultDailyGoal?, inviteToken? }
 * If inviteToken is provided and valid, the user is created with isAdmin=true.
 * Any isAdmin field in the body is STRIPPED — users cannot self-declare.
 */
router.post(
    '/register',
    authLimiter,
    validate(registerRules),
    async (req, res) => {
        try {
            const { name, email, password, timezone, defaultDailyGoal, inviteToken } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(409).json({ error: 'Email already registered' });
            }

            // Determine admin status from invite token (never from client isAdmin)
            let grantAdmin = false;
            let invite = null;

            if (inviteToken) {
                invite = await AdminInvite.findOne({ token: inviteToken });

                if (!invite) {
                    return res.status(400).json({ error: 'Invalid invite token' });
                }
                if (!invite.isValid()) {
                    return res.status(400).json({ error: 'Invite token is expired or already used' });
                }
                if (invite.email !== email.toLowerCase().trim()) {
                    return res.status(400).json({ error: 'Email does not match invite' });
                }

                grantAdmin = true;
            }

            const user = new User({
                name,
                email,
                passwordHash: password, // pre-save hook will hash this
                timezone: timezone || 'Asia/Kolkata',
                defaultDailyGoal: defaultDailyGoal || 8,
                isAdmin: grantAdmin, // only true via valid invite
            });

            await user.save();

            // Mark invite as used
            if (invite) {
                invite.usedAt = new Date();
                await invite.save();

                await AuditLog.record('INVITE_USED', user._id, user._id, {
                    inviteToken: invite.token.substring(0, 8) + '...',
                    invitedBy: invite.invitedByUserId,
                });
            }

            setTokenCookie(res, user._id, user.isAdmin);

            res.status(201).json({ user: user.toJSON() });
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).json({ error: 'Server error during registration' });
        }
    }
);

/**
 * POST /api/auth/login
 * Request:  { email, password, adminLogin? }
 * If adminLogin is true but user.isAdmin is false, returns 403.
 */
router.post(
    '/login',
    authLimiter,
    validate(loginRules),
    async (req, res) => {
        try {
            const { email, password, adminLogin } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Admin login gate: if client requests admin login but user is not admin
            if (adminLogin && !user.isAdmin) {
                await AuditLog.record('ADMIN_LOGIN_DENIED', user._id, user._id, {
                    reason: 'User is not an admin',
                    ip: req.ip,
                });
                return res.status(403).json({
                    error: 'Admin access denied. Your account does not have admin privileges.',
                });
            }

            // Update last login time
            user.lastLoginAt = new Date();
            await user.save();

            // Audit admin logins
            if (adminLogin && user.isAdmin) {
                await AuditLog.record('ADMIN_LOGIN', user._id, user._id, { ip: req.ip });
            }

            setTokenCookie(res, user._id, user.isAdmin);

            res.json({ user: user.toJSON() });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ error: 'Server error during login' });
        }
    }
);

/**
 * POST /api/auth/logout
 * Clears the auth cookie.
 */
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    res.json({ message: 'Logged out' });
});

module.exports = router;

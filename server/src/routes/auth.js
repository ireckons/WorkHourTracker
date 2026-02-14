const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authLimiter = require('../middleware/rateLimiter');
const { validate, registerRules, loginRules } = require('../middleware/validate');

const router = express.Router();

/**
 * Helper: create a JWT and set it as an HttpOnly cookie.
 * HttpOnly prevents JavaScript access — mitigates XSS token theft.
 * SameSite: 'lax' balances security and usability.
 */
function setTokenCookie(res, userId) {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
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
 * Request:  { name, email, password, timezone?, defaultDailyGoal? }
 * Response: { user: { id, name, email, timezone, defaultDailyGoal } }
 */
router.post(
    '/register',
    authLimiter,
    validate(registerRules),
    async (req, res) => {
        try {
            const { name, email, password, timezone, defaultDailyGoal } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(409).json({ error: 'Email already registered' });
            }

            const user = new User({
                name,
                email,
                passwordHash: password, // pre-save hook will hash this
                timezone: timezone || 'Asia/Kolkata',
                defaultDailyGoal: defaultDailyGoal || 8,
            });

            await user.save();
            setTokenCookie(res, user._id);

            res.status(201).json({ user: user.toJSON() });
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).json({ error: 'Server error during registration' });
        }
    }
);

/**
 * POST /api/auth/login
 * Request:  { email, password }
 * Response: { user: { id, name, email, timezone, defaultDailyGoal } }
 */
router.post(
    '/login',
    authLimiter,
    validate(loginRules),
    async (req, res) => {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            setTokenCookie(res, user._id);

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
 * Response: { message: 'Logged out' }
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

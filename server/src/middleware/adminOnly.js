const User = require('../models/User');

/**
 * Admin-only middleware.
 * Must be used AFTER the auth middleware (requires req.userId).
 * Re-verifies admin status from the database for extra security,
 * rather than trusting only the JWT claim.
 */
const adminOnly = async (req, res, next) => {
    try {
        // Fast check from JWT claim first
        if (!req.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Re-verify from DB to prevent stale JWT attacks
        const user = await User.findById(req.userId).select('isAdmin');
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (err) {
        console.error('Admin check error:', err);
        return res.status(500).json({ error: 'Authorization check failed' });
    }
};

module.exports = adminOnly;

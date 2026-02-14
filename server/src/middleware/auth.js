const jwt = require('jsonwebtoken');

/**
 * Auth middleware: verifies the JWT stored in an HttpOnly cookie.
 * Attaches `req.userId` for downstream route handlers.
 */
const auth = (req, res, next) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = auth;

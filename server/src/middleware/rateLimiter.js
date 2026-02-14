const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication routes.
 * Limits each IP to 10 requests per 15-minute window.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = authLimiter;

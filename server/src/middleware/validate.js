const { body, query, validationResult } = require('express-validator');

/**
 * Middleware factory: runs express-validator checks and returns
 * 400 with error details if any validation fails.
 */
const validate = (validations) => {
    return async (req, res, next) => {
        for (const validation of validations) {
            const result = await validation.run(req);
            if (result.errors.length) break;
        }

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    };
};

// ── Validation rule sets ──────────────────────────────────────────

const registerRules = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('timezone').optional().isString(),
    body('defaultDailyGoal').optional().isFloat({ min: 0.5, max: 24 }),
];

const loginRules = [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    body('adminLogin').optional().isBoolean().withMessage('adminLogin must be boolean'),
];

const goalRules = [
    body('date')
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage('Date must be in YYYY-MM-DD format'),
    body('goalHours')
        .isFloat({ min: 0.5, max: 24 })
        .withMessage('Goal must be between 0.5 and 24 hours'),
];

const dateQueryRule = [
    query('date')
        .optional()
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage('Date must be in YYYY-MM-DD format'),
];

const promoteRules = [
    body('userId').isMongoId().withMessage('Valid userId is required'),
    body('makeAdmin').isBoolean().withMessage('makeAdmin must be boolean'),
];

const inviteRules = [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('expiresInHours')
        .optional()
        .isInt({ min: 1, max: 168 })
        .withMessage('Expiry must be between 1 and 168 hours'),
];

module.exports = {
    validate,
    registerRules,
    loginRules,
    goalRules,
    dateQueryRule,
    promoteRules,
    inviteRules,
};

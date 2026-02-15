const mongoose = require('mongoose');

const ACTIONS = [
    'ADMIN_LOGIN',
    'ADMIN_LOGIN_DENIED',
    'PROMOTE',
    'DEMOTE',
    'INVITE_CREATED',
    'INVITE_USED',
];

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ACTIONS,
    },
    actorUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

auditLogSchema.index({ actorUserId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

/**
 * Static helper to create an audit log entry.
 */
auditLogSchema.statics.record = function (action, actorUserId, targetUserId, details = {}) {
    return this.create({ action, actorUserId, targetUserId, details });
};

module.exports = mongoose.model('AuditLog', auditLogSchema);

const mongoose = require('mongoose');
const crypto = require('crypto');

const adminInviteSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto.randomBytes(48).toString('hex'),
    },
    email: {
        type: String,
        required: [true, 'Invitee email is required'],
        lowercase: true,
        trim: true,
    },
    invitedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    usedAt: {
        type: Date,
        default: null,
    },
});

// Indexes
adminInviteSchema.index({ token: 1 }, { unique: true });
adminInviteSchema.index({ email: 1, usedAt: 1 });

/**
 * Check if the invite is still valid (not used and not expired).
 */
adminInviteSchema.methods.isValid = function () {
    return !this.usedAt && this.expiresAt > new Date();
};

module.exports = mongoose.model('AdminInvite', adminInviteSchema);

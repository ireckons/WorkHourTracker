const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: 100,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        passwordHash: {
            type: String,
            required: true,
        },
        timezone: {
            type: String,
            default: 'Asia/Kolkata', // IANA timezone identifier
        },
        defaultDailyGoal: {
            type: Number,
            default: 8, // hours
            min: 0.5,
            max: 24,
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

/**
 * Pre-save hook: hash the plain-text password before persisting.
 * We store the hash in `passwordHash` — the route passes the raw
 * password into this field and the hook replaces it with the bcrypt hash.
 */
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();
    try {
        this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
        next();
    } catch (err) {
        next(err);
    }
});

/**
 * Compare a candidate password against the stored hash.
 * @param {string} candidatePassword - plain-text password to check
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Never return passwordHash in JSON responses
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.passwordHash;
    return obj;
};

module.exports = mongoose.model('User', userSchema);

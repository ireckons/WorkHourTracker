/**
 * Seed script: drops ALL data and creates a single admin user.
 *
 * Usage: cd server && node seed.js
 * Requires MONGODB_URI in .env
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Session = require('./src/models/Session');
const DailyGoal = require('./src/models/DailyGoal');
const AuditLog = require('./src/models/AuditLog');
const AdminInvite = require('./src/models/AdminInvite');

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Wipe everything
    await User.deleteMany({});
    await Session.deleteMany({});
    await DailyGoal.deleteMany({});
    await AuditLog.deleteMany({});
    await AdminInvite.deleteMany({});
    console.log('Cleared all collections');

    // Create single admin
    const admin = new User({
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: 'admin123',
        timezone: 'Asia/Kolkata',
        defaultDailyGoal: 8,
        isAdmin: true,
    });
    await admin.save();
    console.log('Created ADMIN: admin@example.com / admin123');

    console.log('\n✅ Seed complete! Only one admin account exists.');
    console.log('   Admin: admin@example.com / admin123');
    console.log('   Use the Invite Admin feature to add more admins.');

    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
});

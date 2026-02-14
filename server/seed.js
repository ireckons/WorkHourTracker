/**
 * Seed script: creates a demo user and sample sessions.
 *
 * Usage: cd server && node seed.js
 * Requires MONGODB_URI in .env
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Session = require('./src/models/Session');
const DailyGoal = require('./src/models/DailyGoal');
const { DateTime } = require('luxon');

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'password123';
const TIMEZONE = 'Asia/Kolkata';

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing demo data
    const existing = await User.findOne({ email: DEMO_EMAIL });
    if (existing) {
        await Session.deleteMany({ userId: existing._id });
        await DailyGoal.deleteMany({ userId: existing._id });
        await User.deleteOne({ _id: existing._id });
        console.log('Cleared existing demo data');
    }

    // Create demo user
    const user = new User({
        name: 'Demo User',
        email: DEMO_EMAIL,
        passwordHash: DEMO_PASSWORD, // pre-save hook hashes this
        timezone: TIMEZONE,
        defaultDailyGoal: 8,
    });
    await user.save();
    console.log(`Created demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

    const now = DateTime.now().setZone(TIMEZONE);

    // Helper to create sessions relative to today
    const makeSession = (dayOffset, startHour, startMin, endHour, endMin) => {
        const day = now.plus({ days: dayOffset });
        const start = day.set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 });
        const end = day.set({ hour: endHour, minute: endMin, second: 0, millisecond: 0 });
        return {
            userId: user._id,
            startAt: start.toJSDate(),
            endAt: end.toJSDate(),
        };
    };

    const sessions = [
        // Yesterday: two sessions totalling ~6 hours
        makeSession(-1, 9, 0, 12, 30),  // 3.5 hours
        makeSession(-1, 14, 0, 16, 30), // 2.5 hours

        // Two days ago: overnight session (23:00 → 01:00 next day)
        {
            userId: user._id,
            startAt: now.plus({ days: -2 }).set({ hour: 23, minute: 0, second: 0, millisecond: 0 }).toJSDate(),
            endAt: now.plus({ days: -1 }).set({ hour: 1, minute: 0, second: 0, millisecond: 0 }).toJSDate(),
        },

        // Three days ago: full workday
        makeSession(-3, 9, 0, 13, 0),   // 4 hours
        makeSession(-3, 14, 0, 18, 0),  // 4 hours

        // Today: one completed session (simulate 2 hours worked)
        makeSession(0, 9, 0, 11, 0),    // 2 hours
    ];

    await Session.insertMany(sessions);
    console.log(`Created ${sessions.length} sample sessions`);

    // Set a custom goal for yesterday
    await DailyGoal.create({
        userId: user._id,
        date: now.plus({ days: -1 }).toFormat('yyyy-MM-dd'),
        goalHours: 6,
    });
    console.log('Set custom goal of 6h for yesterday');

    console.log('\n✅ Seed complete! You can now log in with:');
    console.log(`   Email:    ${DEMO_EMAIL}`);
    console.log(`   Password: ${DEMO_PASSWORD}`);

    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
});

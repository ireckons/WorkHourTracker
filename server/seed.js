/**
 * Seed script: creates an admin user, employee users, and sample sessions.
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
const { DateTime } = require('luxon');

const TIMEZONE = 'Asia/Kolkata';

const USERS = [
    {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'admin123',
        isAdmin: true,
    },
    {
        name: 'Demo User',
        email: 'demo@example.com',
        password: 'password123',
        isAdmin: false,
    },
    {
        name: 'Alice Engineer',
        email: 'alice@example.com',
        password: 'password123',
        isAdmin: false,
    },
    {
        name: 'Bob Designer',
        email: 'bob@example.com',
        password: 'password123',
        isAdmin: false,
    },
];

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing seed data
    for (const u of USERS) {
        const existing = await User.findOne({ email: u.email });
        if (existing) {
            await Session.deleteMany({ userId: existing._id });
            await DailyGoal.deleteMany({ userId: existing._id });
            await AuditLog.deleteMany({ actorUserId: existing._id });
            await User.deleteOne({ _id: existing._id });
        }
    }
    console.log('Cleared existing seed data');

    const now = DateTime.now().setZone(TIMEZONE);
    const createdUsers = [];

    for (const u of USERS) {
        const user = new User({
            name: u.name,
            email: u.email,
            passwordHash: u.password,
            timezone: TIMEZONE,
            defaultDailyGoal: 8,
            isAdmin: u.isAdmin,
            lastLoginAt: now.minus({ hours: 2 }).toJSDate(),
        });
        await user.save();
        createdUsers.push(user);
        console.log(`Created ${u.isAdmin ? 'ADMIN' : 'employee'}: ${u.email} / ${u.password}`);
    }

    const [admin, demo, alice, bob] = createdUsers;

    // Helper to create sessions
    const makeSession = (userId, dayOffset, startHour, startMin, endHour, endMin) => {
        const day = now.plus({ days: dayOffset });
        const start = day.set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 });
        const end = day.set({ hour: endHour, minute: endMin, second: 0, millisecond: 0 });
        return { userId, startAt: start.toJSDate(), endAt: end.toJSDate() };
    };

    const sessions = [
        // Demo user: yesterday + today
        makeSession(demo._id, -1, 9, 0, 12, 30),
        makeSession(demo._id, -1, 14, 0, 16, 30),
        makeSession(demo._id, 0, 9, 0, 11, 0),

        // Alice: good performer, 3 days of data
        makeSession(alice._id, -2, 9, 0, 13, 0),
        makeSession(alice._id, -2, 14, 0, 18, 0),
        makeSession(alice._id, -1, 8, 30, 12, 0),
        makeSession(alice._id, -1, 13, 0, 17, 30),
        makeSession(alice._id, 0, 9, 0, 12, 0),

        // Bob: light worker + overnight session
        makeSession(bob._id, -1, 10, 0, 14, 0),
        {
            userId: bob._id,
            startAt: now.plus({ days: -2 }).set({ hour: 23, minute: 0, second: 0, millisecond: 0 }).toJSDate(),
            endAt: now.plus({ days: -1 }).set({ hour: 1, minute: 0, second: 0, millisecond: 0 }).toJSDate(),
        },

        // Admin: some sessions too
        makeSession(admin._id, -1, 9, 0, 17, 0),
        makeSession(admin._id, 0, 9, 0, 10, 30),
    ];

    await Session.insertMany(sessions);
    console.log(`Created ${sessions.length} sample sessions`);

    // Custom goals
    await DailyGoal.create([
        { userId: demo._id, date: now.plus({ days: -1 }).toFormat('yyyy-MM-dd'), goalHours: 6 },
        { userId: alice._id, date: now.toFormat('yyyy-MM-dd'), goalHours: 7 },
    ]);
    console.log('Set custom goals');

    // Sample audit log
    await AuditLog.record('ADMIN_LOGIN', admin._id, admin._id, { ip: '127.0.0.1' });
    console.log('Created sample audit log');

    console.log('\n✅ Seed complete! Accounts:');
    console.log('   Admin:    admin@example.com / admin123');
    console.log('   Employee: demo@example.com / password123');
    console.log('   Employee: alice@example.com / password123');
    console.log('   Employee: bob@example.com / password123');

    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
});

/**
 * Integration tests for admin features:
 * - Invite token lifecycle (create → use → prevent reuse)
 * - Promotion endpoint authorization
 * - Security: isAdmin in registration payload ignored
 * - Admin login flow (403 for non-admin, 200 for admin)
 */
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/index');
const User = require('../../src/models/User');
const AdminInvite = require('../../src/models/AdminInvite');
const AuditLog = require('../../src/models/AuditLog');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await User.deleteMany({});
    await AdminInvite.deleteMany({});
    await AuditLog.deleteMany({});
});

// Helper: register a user and return cookie
async function registerUser(data) {
    const res = await request(app)
        .post('/api/auth/register')
        .send(data);
    const cookie = res.headers['set-cookie']?.[0] || '';
    return { res, cookie };
}

// Helper: register an admin directly (seed-style)
async function createAdmin() {
    const admin = new User({
        name: 'Test Admin',
        email: 'admin@test.com',
        passwordHash: 'admin123',
        isAdmin: true,
    });
    await admin.save();
    // Login to get cookie
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'admin123' });
    const cookie = res.headers['set-cookie']?.[0] || '';
    return { admin, cookie };
}

describe('Admin Login', () => {
    test('admin login succeeds for admin users', async () => {
        const { cookie } = await createAdmin();
        expect(cookie).toBeTruthy();
    });

    test('admin login returns 403 for non-admin', async () => {
        await registerUser({
            name: 'Regular',
            email: 'regular@test.com',
            password: 'pass123',
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'regular@test.com', password: 'pass123', adminLogin: true });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/admin/i);
    });

    test('admin login creates audit log entry', async () => {
        const { admin } = await createAdmin();

        await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@test.com', password: 'admin123', adminLogin: true });

        const logs = await AuditLog.find({ action: 'ADMIN_LOGIN' });
        expect(logs.length).toBe(1);
        expect(logs[0].actorUserId.toString()).toBe(admin._id.toString());
    });

    test('failed admin login creates DENIED audit log', async () => {
        await registerUser({
            name: 'NoAdmin',
            email: 'noadmin@test.com',
            password: 'pass123',
        });

        await request(app)
            .post('/api/auth/login')
            .send({ email: 'noadmin@test.com', password: 'pass123', adminLogin: true });

        const logs = await AuditLog.find({ action: 'ADMIN_LOGIN_DENIED' });
        expect(logs.length).toBe(1);
    });
});

describe('Admin Invite Flow', () => {
    test('admin can create invite', async () => {
        const { cookie } = await createAdmin();

        const res = await request(app)
            .post('/api/admin/invite')
            .set('Cookie', cookie)
            .send({ email: 'newadmin@test.com', expiresInHours: 24 });

        expect(res.status).toBe(201);
        expect(res.body.invite.token).toBeTruthy();
        expect(res.body.invite.inviteLink).toContain('inviteToken=');
    });

    test('invite token registers user as admin', async () => {
        const { cookie } = await createAdmin();

        // Create invite
        const inviteRes = await request(app)
            .post('/api/admin/invite')
            .set('Cookie', cookie)
            .send({ email: 'invited@test.com' });

        const token = inviteRes.body.invite.token;

        // Register with invite token
        const regRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Invited Admin',
                email: 'invited@test.com',
                password: 'pass123',
                inviteToken: token,
            });

        expect(regRes.status).toBe(201);
        expect(regRes.body.user.isAdmin).toBe(true);
    });

    test('invite token cannot be reused', async () => {
        const { cookie } = await createAdmin();

        const inviteRes = await request(app)
            .post('/api/admin/invite')
            .set('Cookie', cookie)
            .send({ email: 'reuse@test.com' });

        const token = inviteRes.body.invite.token;

        // First use
        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'First Use',
                email: 'reuse@test.com',
                password: 'pass123',
                inviteToken: token,
            });

        // Attempt reuse
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Second Use',
                email: 'reuse2@test.com',
                password: 'pass123',
                inviteToken: token,
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/expired|used/i);
    });

    test('expired invite token is rejected', async () => {
        const { cookie, admin } = await createAdmin();

        // Create expired invite directly
        const invite = new AdminInvite({
            email: 'expired@test.com',
            invitedByUserId: admin._id,
            expiresAt: new Date(Date.now() - 1000), // already expired
        });
        await invite.save();

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Expired',
                email: 'expired@test.com',
                password: 'pass123',
                inviteToken: invite.token,
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/expired|used/i);
    });

    test('email mismatch on invite is rejected', async () => {
        const { cookie } = await createAdmin();

        const inviteRes = await request(app)
            .post('/api/admin/invite')
            .set('Cookie', cookie)
            .send({ email: 'correct@test.com' });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Wrong Email',
                email: 'wrong@test.com',
                password: 'pass123',
                inviteToken: inviteRes.body.invite.token,
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
    });
});

describe('Security: isAdmin in registration', () => {
    test('isAdmin in body is ignored during registration', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Sneaky User',
                email: 'sneaky@test.com',
                password: 'pass123',
                isAdmin: true,  // should be ignored!
            });

        expect(res.status).toBe(201);
        expect(res.body.user.isAdmin).toBe(false);
    });
});

describe('Admin Promote/Demote', () => {
    test('admin can promote a user', async () => {
        const { cookie } = await createAdmin();
        const { res: regRes } = await registerUser({
            name: 'Promotee',
            email: 'promotee@test.com',
            password: 'pass123',
        });

        const res = await request(app)
            .post('/api/admin/promote')
            .set('Cookie', cookie)
            .send({ userId: regRes.body.user._id, makeAdmin: true });

        expect(res.status).toBe(200);
        expect(res.body.user.isAdmin).toBe(true);

        // Verify audit log
        const logs = await AuditLog.find({ action: 'PROMOTE' });
        expect(logs.length).toBe(1);
    });

    test('admin can demote a user', async () => {
        const { cookie } = await createAdmin();
        const { res: regRes } = await registerUser({
            name: 'Demotee',
            email: 'demotee@test.com',
            password: 'pass123',
        });

        // Promote first
        await request(app)
            .post('/api/admin/promote')
            .set('Cookie', cookie)
            .send({ userId: regRes.body.user._id, makeAdmin: true });

        // Then demote
        const res = await request(app)
            .post('/api/admin/promote')
            .set('Cookie', cookie)
            .send({ userId: regRes.body.user._id, makeAdmin: false });

        expect(res.status).toBe(200);
        expect(res.body.user.isAdmin).toBe(false);
    });

    test('non-admin cannot promote', async () => {
        const { cookie } = await registerUser({
            name: 'Regular',
            email: 'regular@test.com',
            password: 'pass123',
        });

        const res = await request(app)
            .post('/api/admin/promote')
            .set('Cookie', cookie)
            .send({ userId: 'whatever', makeAdmin: true });

        expect(res.status).toBe(403);
    });
});

describe('Admin Users Endpoint', () => {
    test('admin can list all users', async () => {
        const { cookie } = await createAdmin();
        await registerUser({ name: 'Emp1', email: 'emp1@test.com', password: 'pass123' });
        await registerUser({ name: 'Emp2', email: 'emp2@test.com', password: 'pass123' });

        const res = await request(app)
            .get('/api/admin/users')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.users.length).toBe(3); // admin + 2 employees
    });

    test('non-admin cannot access users list', async () => {
        const { cookie } = await registerUser({
            name: 'Regular',
            email: 'regular@test.com',
            password: 'pass123',
        });

        const res = await request(app)
            .get('/api/admin/users')
            .set('Cookie', cookie);

        expect(res.status).toBe(403);
    });
});

describe('Admin Audit Log', () => {
    test('admin can view audit logs', async () => {
        const { cookie, admin } = await createAdmin();
        await AuditLog.record('ADMIN_LOGIN', admin._id, admin._id, { ip: '127.0.0.1' });

        const res = await request(app)
            .get('/api/admin/audit')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.logs.length).toBeGreaterThan(0);
        expect(res.body.pagination).toBeDefined();
    });
});

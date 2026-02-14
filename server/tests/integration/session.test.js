const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const supertest = require('supertest');
const app = require('../../src/index');

let mongoServer;
let request;
let cookie;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    request = supertest(app);

    // Register a test user and capture the auth cookie
    const res = await request.post('/api/auth/register').send({
        name: 'Session Tester',
        email: 'session@example.com',
        password: 'password123',
        timezone: 'Asia/Kolkata',
    });
    cookie = res.headers['set-cookie'];
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Session Flow', () => {
    test('POST /api/sessions/start — starts a new session', async () => {
        const res = await request
            .post('/api/sessions/start')
            .set('Cookie', cookie);

        expect(res.status).toBe(201);
        expect(res.body.session).toBeDefined();
        expect(res.body.session.startAt).toBeDefined();
        expect(res.body.session.endAt).toBeNull();
    });

    test('POST /api/sessions/start — rejects if session already active', async () => {
        const res = await request
            .post('/api/sessions/start')
            .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/already have an active session/i);
    });

    test('PATCH /api/sessions/end — ends the active session', async () => {
        const res = await request
            .patch('/api/sessions/end')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.session.endAt).toBeDefined();
        expect(res.body.session.endAt).not.toBeNull();
    });

    test('PATCH /api/sessions/end — 400 if no active session', async () => {
        const res = await request
            .patch('/api/sessions/end')
            .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/no active session/i);
    });

    test('GET /api/sessions — lists sessions for today', async () => {
        const res = await request
            .get('/api/sessions')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.sessions).toBeDefined();
        expect(Array.isArray(res.body.sessions)).toBe(true);
        expect(res.body.date).toBeDefined();
    });

    test('GET /api/sessions/today/summary — returns summary with progress', async () => {
        const res = await request
            .get('/api/sessions/today/summary')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.date).toBeDefined();
        expect(typeof res.body.totalMs).toBe('number');
        expect(res.body.totalFormatted).toBeDefined();
        expect(typeof res.body.goalHours).toBe('number');
        expect(typeof res.body.progressPercent).toBe('number');
    });

    test('GET /api/sessions — 401 without auth', async () => {
        const res = await request.get('/api/sessions');
        expect(res.status).toBe(401);
    });
});

describe('Goal Flow', () => {
    test('GET /api/goals — returns default goal', async () => {
        const res = await request
            .get('/api/goals')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.goalHours).toBe(8);
        expect(res.body.isDefault).toBe(true);
    });

    test('PUT /api/goals — sets custom goal', async () => {
        const today = new Date().toISOString().split('T')[0];
        const res = await request
            .put('/api/goals')
            .set('Cookie', cookie)
            .send({ date: today, goalHours: 6 });

        expect(res.status).toBe(200);
        expect(res.body.goal.goalHours).toBe(6);
    });

    test('GET /api/goals — returns custom goal after setting', async () => {
        const today = new Date().toISOString().split('T')[0];
        const res = await request
            .get('/api/goals')
            .query({ date: today })
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.goalHours).toBe(6);
        expect(res.body.isDefault).toBe(false);
    });

    test('PUT /api/goals — validates input', async () => {
        const res = await request
            .put('/api/goals')
            .set('Cookie', cookie)
            .send({ date: 'invalid', goalHours: 30 });

        expect(res.status).toBe(400);
    });
});

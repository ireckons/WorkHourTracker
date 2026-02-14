const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const supertest = require('supertest');
const app = require('../../src/index');

let mongoServer;
let request;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    request = supertest(app);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

describe('Auth Flow', () => {
    const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
    };

    test('POST /api/auth/register — creates user and sets cookie', async () => {
        const res = await request.post('/api/auth/register').send(testUser);

        expect(res.status).toBe(201);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(testUser.email);
        expect(res.body.user.name).toBe(testUser.name);
        // Password hash should never be in the response
        expect(res.body.user.passwordHash).toBeUndefined();
        // Should set an HttpOnly cookie
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.headers['set-cookie'][0]).toMatch(/token=/);
    });

    test('POST /api/auth/register — rejects duplicate email', async () => {
        await request.post('/api/auth/register').send(testUser);
        const res = await request.post('/api/auth/register').send(testUser);

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already registered/i);
    });

    test('POST /api/auth/register — validates input', async () => {
        const res = await request.post('/api/auth/register').send({
            name: '',
            email: 'not-an-email',
            password: '12',
        });

        expect(res.status).toBe(400);
        expect(res.body.details).toBeDefined();
    });

    test('POST /api/auth/login — authenticates with correct credentials', async () => {
        await request.post('/api/auth/register').send(testUser);

        const res = await request.post('/api/auth/login').send({
            email: testUser.email,
            password: testUser.password,
        });

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(testUser.email);
        expect(res.headers['set-cookie'][0]).toMatch(/token=/);
    });

    test('POST /api/auth/login — rejects wrong password', async () => {
        await request.post('/api/auth/register').send(testUser);

        const res = await request.post('/api/auth/login').send({
            email: testUser.email,
            password: 'wrongpassword',
        });

        expect(res.status).toBe(401);
    });

    test('GET /api/user/me — returns user with valid cookie', async () => {
        const registerRes = await request.post('/api/auth/register').send(testUser);
        const cookie = registerRes.headers['set-cookie'];

        const res = await request.get('/api/user/me').set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(testUser.email);
    });

    test('GET /api/user/me — 401 without cookie', async () => {
        const res = await request.get('/api/user/me');
        expect(res.status).toBe(401);
    });

    test('POST /api/auth/logout — clears cookie', async () => {
        const res = await request.post('/api/auth/logout');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Logged out');
    });
});

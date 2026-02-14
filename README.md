# WorkHourTracker

A full-stack time-tracking web application built with **React 18**, **Node.js + Express**, and **MongoDB (Mongoose)**. Track work hours, set daily goals, and monitor progress with a real-time animated dashboard.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18+-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-6+-brightgreen)

## Features

- **Multi-user authentication** — Register/login with JWT stored in HttpOnly cookies
- **Work session tracking** — Start/end work sessions with one click
- **Daily goals** — Set and edit customizable daily hour targets
- **Real-time progress bar** — Animated bar updates every 60 seconds during active sessions
- **Timezone-aware** — All calculations use IANA timezones; overnight sessions handled correctly
- **Responsive design** — Dark glassmorphism UI that works on desktop and mobile
- **Accessible** — Progress bar with ARIA attributes and numeric readout

## Architecture

```
WorkHourTracker/
├── server/          # Express + Mongoose API (port 5000)
│   ├── src/
│   │   ├── models/   # User, Session, DailyGoal
│   │   ├── routes/   # auth, sessions, goals, user
│   │   ├── middleware/ # JWT auth, rate-limiter, validation
│   │   └── utils/    # Time calculations & day-splitting
│   ├── tests/       # Jest unit + integration tests
│   └── seed.js      # Demo data seed script
├── client/          # Vite + React 18 (port 5173)
│   ├── src/
│   │   ├── pages/     # Login, Register, Dashboard
│   │   ├── components/ # ProgressBar, SessionList, GoalEditor, Navbar
│   │   ├── context/   # AuthContext (React Context + useReducer)
│   │   └── styles/    # Dark theme CSS
│   └── tests/       # Vitest unit tests
├── demo.js          # CLI demo script
└── README.md
```

## Prerequisites

- **Node.js** 18+
- **MongoDB** 6+ (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **npm** 9+

## Quick Start

### 1. Clone and install dependencies

```bash
# Install server dependencies
cd server
cp .env.example .env    # Edit .env with your MongoDB URI and JWT secret
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment variables

**Server** (`server/.env`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/workhourtracker
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**Client** (`client/.env.example`):
```env
VITE_API_URL=http://localhost:5000/api
```

> **Note:** In development, the Vite proxy (`vite.config.js`) forwards `/api` requests to the server, so you don't need `VITE_API_URL` locally.

### 3. Seed demo data (optional)

```bash
cd server
node seed.js
```

Creates a demo user: `demo@example.com` / `password123` with sample sessions.

### 4. Run development servers

```bash
# Terminal 1: Start server
cd server
npm run dev

# Terminal 2: Start client
cd client
npm run dev
```

Visit **http://localhost:5173** in your browser.

### 5. Run the demo script

```bash
# Requires the server to be running
node demo.js
```

## API Documentation

### Authentication

| Endpoint | Method | Description | Body |
|---|---|---|---|
| `/api/auth/register` | POST | Register new user | `{ name, email, password }` |
| `/api/auth/login` | POST | Login | `{ email, password }` |
| `/api/auth/logout` | POST | Logout (clears cookie) | — |

**Register example:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"secret123"}'
```

**Response:**
```json
{
  "user": {
    "_id": "...",
    "name": "John",
    "email": "john@example.com",
    "timezone": "Asia/Kolkata",
    "defaultDailyGoal": 8
  }
}
```

### User

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/user/me` | GET | ✅ | Get current user profile |

### Sessions

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/sessions/start` | POST | ✅ | Start a work session |
| `/api/sessions/end` | PATCH | ✅ | End active session |
| `/api/sessions?date=YYYY-MM-DD` | GET | ✅ | List sessions for a date |
| `/api/sessions/today/summary` | GET | ✅ | Get today's summary with progress |

**Today's summary response:**
```json
{
  "date": "2026-02-14",
  "totalMs": 14400000,
  "totalFormatted": "04:00",
  "goalHours": 8,
  "progressPercent": 50,
  "activeSession": null,
  "sessions": [...]
}
```

### Goals

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/goals?date=YYYY-MM-DD` | GET | ✅ | Get goal for date |
| `/api/goals` | PUT | ✅ | Set/update goal: `{ date, goalHours }` |

### Health Check

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Server health check |

## Key Logic: Time Calculations

### Overnight Session Splitting

Sessions that span midnight are split at each midnight boundary in the user's timezone:

```
Session: 2026-02-14 23:00 → 2026-02-15 02:00 (IST)
Result:  Feb 14: 1 hour,  Feb 15: 2 hours
```

See `server/src/utils/time.js` → `splitSessionByDay()` for the implementation.

### Progress Calculation

```
progressPercent = min(100, (workedMs / (goalHours × 3600000)) × 100)
```

Capped at 100% — bar is fully orange (#ff8c00) when the goal is met or exceeded.

## Testing

### Server tests (Jest + mongodb-memory-server)

```bash
cd server
npm test
```

Runs:
- **Unit tests**: Duration calculation, overnight splitting, progress percent
- **Integration tests**: Auth flow (register/login/logout), session CRUD, goal CRUD

### Client tests (Vitest)

```bash
cd client
npx vitest run
```

Runs:
- Progress percentage calculation edge cases
- Duration formatting

## Deployment

### Frontend → Vercel or Netlify

1. Set build command: `cd client && npm install && npm run build`
2. Set publish directory: `client/dist`
3. Set environment variable: `VITE_API_URL=https://your-api.onrender.com/api`

### Backend → Render or Heroku

1. Set root directory to `server/`
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Set environment variables:
   - `MONGODB_URI` — Your MongoDB Atlas connection string
   - `JWT_SECRET` — Strong random secret
   - `CLIENT_URL` — Your frontend URL (for CORS)
   - `NODE_ENV=production`

### MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Whitelist your server IP (or use `0.0.0.0/0` for Render/Heroku)
3. Copy the connection string into `MONGODB_URI`

## Security

- **Passwords** hashed with bcrypt (12 rounds)
- **JWT** stored in HttpOnly, Secure, SameSite cookies
- **Rate limiting** on auth endpoints (10 req / 15 min per IP)
- **Input validation** on all endpoints via express-validator
- **CORS** restricted to configured client origin
- **Secrets** stored in environment variables (never committed)

## License

MIT

/**
 * Demo Script — Verifies progress bar behavior by simulating sessions
 * via the API. This script demonstrates:
 *
 * 1. Registering/logging in a demo user
 * 2. Starting a work session
 * 3. Waiting briefly, then ending the session
 * 4. Checking the progress bar state (summary endpoint)
 * 5. Starting another session and checking live progress updates
 *
 * Usage: node demo.js
 * Requires the server to be running on http://localhost:5000
 */

const API_BASE = 'http://localhost:5000/api';

// Helper for fetch with cookies
let cookies = '';

async function request(method, path, body) {
    const url = `${API_BASE}${path}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            Cookie: cookies,
        },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    // Capture set-cookie header
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        cookies = setCookie.split(';')[0];
    }

    const data = await res.json();
    return { status: res.status, data };
}

function printProgressBar(summary) {
    const { totalFormatted, goalHours, progressPercent } = summary;
    const barWidth = 40;
    const filled = Math.round((progressPercent / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    console.log(`\n  Progress: [${bar}] ${Math.round(progressPercent)}%`);
    console.log(`  Worked:   ${totalFormatted}`);
    console.log(`  Goal:     ${goalHours}h`);
    console.log(`  Sessions: ${summary.sessions.length}`);
    if (summary.activeSession) {
        console.log(`  Status:   🟢 Active session running`);
    } else {
        console.log(`  Status:   ⏸  No active session`);
    }
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   WorkHourTracker — Progress Bar Demo        ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // Step 1: Register or login
    console.log('Step 1: Registering demo user...');
    let res = await request('POST', '/auth/register', {
        name: 'Demo Runner',
        email: 'demorunner@example.com',
        password: 'password123',
    });

    if (res.status === 409) {
        console.log('  User exists, logging in...');
        res = await request('POST', '/auth/login', {
            email: 'demorunner@example.com',
            password: 'password123',
        });
    }
    console.log(`  ✅ Authenticated as: ${res.data.user?.name || 'Demo Runner'}`);

    // Step 2: Check initial state
    console.log('\nStep 2: Checking initial dashboard state...');
    res = await request('GET', '/sessions/today/summary');
    printProgressBar(res.data);

    // End any existing active session first
    if (res.data.activeSession) {
        console.log('\n  Ending existing active session...');
        await request('PATCH', '/sessions/end');
    }

    // Step 3: Start a work session
    console.log('\nStep 3: Starting a work session...');
    await request('POST', '/sessions/start');
    res = await request('GET', '/sessions/today/summary');
    printProgressBar(res.data);

    // Step 4: Wait 3 seconds and check again (simulating time passage)
    console.log('\nStep 4: Waiting 3 seconds to simulate working...');
    await sleep(3000);
    res = await request('GET', '/sessions/today/summary');
    console.log('  (Progress should have increased slightly)');
    printProgressBar(res.data);

    // Step 5: End the session
    console.log('\nStep 5: Ending the work session...');
    await request('PATCH', '/sessions/end');
    res = await request('GET', '/sessions/today/summary');
    console.log('  Session ended. Updated progress:');
    printProgressBar(res.data);

    // Step 6: Update the goal
    console.log('\nStep 6: Setting daily goal to 0.5 hours (for visible progress)...');
    await request('PUT', '/goals', {
        date: res.data.date,
        goalHours: 0.5,
    });
    res = await request('GET', '/sessions/today/summary');
    console.log('  Goal updated. Progress with new goal:');
    printProgressBar(res.data);

    // Step 7: Start and quickly end another session
    console.log('\nStep 7: Quick session to add more progress...');
    await request('POST', '/sessions/start');
    await sleep(2000);
    await request('PATCH', '/sessions/end');
    res = await request('GET', '/sessions/today/summary');
    console.log('  After 2nd session:');
    printProgressBar(res.data);

    console.log('\n✅ Demo complete! Open http://localhost:5173 to see the dashboard.\n');
}

main().catch((err) => {
    console.error('Demo error:', err.message);
    process.exit(1);
});

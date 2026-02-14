// Quick test runner to verify time utilities
const t = require('./src/utils/time');

let passed = 0;
let failed = 0;

function assert(name, condition) {
    if (condition) {
        console.log('  PASS:', name);
        passed++;
    } else {
        console.log('  FAIL:', name);
        failed++;
    }
}

console.log('\n=== splitSessionByDay ===');

// Test 1: same-day session
const s1 = { startAt: new Date('2026-02-14T04:30:00Z'), endAt: new Date('2026-02-14T08:30:00Z') };
const r1 = t.splitSessionByDay(s1, 'Asia/Kolkata');
assert('same-day: 1 segment', r1.length === 1);
assert('same-day: 4h duration', r1[0].durationMs === 4 * 3600000);
assert('same-day: correct date', r1[0].date === '2026-02-14');

// Test 2: overnight session (23:00 IST -> 02:00 IST next day)
const s2 = { startAt: new Date('2026-02-14T17:30:00Z'), endAt: new Date('2026-02-14T20:30:00Z') };
const r2 = t.splitSessionByDay(s2, 'Asia/Kolkata');
assert('overnight: 2 segments', r2.length === 2);
assert('overnight: 1h before midnight', r2[0].durationMs === 1 * 3600000);
assert('overnight: 2h after midnight', r2[1].durationMs === 2 * 3600000);
assert('overnight: date 1 correct', r2[0].date === '2026-02-14');
assert('overnight: date 2 correct', r2[1].date === '2026-02-15');

// Test 3: empty if end <= start
const s3 = { startAt: new Date('2026-02-14T10:00:00Z'), endAt: new Date('2026-02-14T10:00:00Z') };
assert('zero duration: empty', t.splitSessionByDay(s3, 'Asia/Kolkata').length === 0);

console.log('\n=== computeDayTotal ===');
const sessions = [
    { startAt: new Date('2026-02-14T03:30:00Z'), endAt: new Date('2026-02-14T07:00:00Z') },
    { startAt: new Date('2026-02-14T08:30:00Z'), endAt: new Date('2026-02-14T11:00:00Z') },
];
assert('day total: 6h', t.computeDayTotal(sessions, '2026-02-14', 'Asia/Kolkata') === 6 * 3600000);

console.log('\n=== computeProgressPercent ===');
assert('progress 50%', t.computeProgressPercent(4 * 3600000, 8) === 50);
assert('progress cap 100%', t.computeProgressPercent(10 * 3600000, 8) === 100);
assert('progress 0%', t.computeProgressPercent(0, 8) === 0);
assert('progress goal=0 -> 100%', t.computeProgressPercent(1000, 0) === 100);

console.log('\n=== formatDuration ===');
assert('format 00:00', t.formatDuration(0) === '00:00');
assert('format 01:30', t.formatDuration(5400000) === '01:30');
assert('format 09:45', t.formatDuration(9 * 3600000 + 45 * 60000) === '09:45');

console.log('\n' + '='.repeat(40));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
console.log('All tests passed!\n');

const {
    splitSessionByDay,
    computeDayTotal,
    computeProgressPercent,
    formatDuration,
} = require('../../src/utils/time');

describe('splitSessionByDay', () => {
    const tz = 'Asia/Kolkata';

    test('same-day session returns single entry', () => {
        const session = {
            startAt: new Date('2026-02-14T04:30:00Z'), // 10:00 IST
            endAt: new Date('2026-02-14T08:30:00Z'),   // 14:00 IST
        };
        const result = splitSessionByDay(session, tz);
        expect(result).toHaveLength(1);
        expect(result[0].date).toBe('2026-02-14');
        // 4 hours = 14400000 ms
        expect(result[0].durationMs).toBe(4 * 3600000);
    });

    test('overnight session splits at midnight', () => {
        // 23:00 IST Feb 14 → 02:00 IST Feb 15
        // 23:00 IST = 17:30 UTC,  02:00 IST = 20:30 UTC
        const session = {
            startAt: new Date('2026-02-14T17:30:00Z'), // 23:00 IST
            endAt: new Date('2026-02-14T20:30:00Z'),   // 02:00 IST next day
        };
        const result = splitSessionByDay(session, tz);
        expect(result).toHaveLength(2);
        // 1 hour before midnight
        expect(result[0].date).toBe('2026-02-14');
        expect(result[0].durationMs).toBe(1 * 3600000);
        // 2 hours after midnight
        expect(result[1].date).toBe('2026-02-15');
        expect(result[1].durationMs).toBe(2 * 3600000);
    });

    test('multi-day session splits at each midnight', () => {
        // 22:00 IST Feb 13 → 03:00 IST Feb 16  (spans 3 midnights)
        const session = {
            startAt: new Date('2026-02-13T16:30:00Z'), // 22:00 IST Feb 13
            endAt: new Date('2026-02-15T21:30:00Z'),   // 03:00 IST Feb 16
        };
        const result = splitSessionByDay(session, tz);
        expect(result).toHaveLength(4); // Feb 13, 14, 15, 16
        expect(result[0].date).toBe('2026-02-13');
        expect(result[0].durationMs).toBe(2 * 3600000); // 2h before midnight
        expect(result[1].date).toBe('2026-02-14');
        expect(result[1].durationMs).toBe(24 * 3600000); // full day
        expect(result[2].date).toBe('2026-02-15');
        expect(result[2].durationMs).toBe(24 * 3600000); // full day
        expect(result[3].date).toBe('2026-02-16');
        expect(result[3].durationMs).toBe(3 * 3600000); // 3h after midnight
    });

    test('returns empty array if endAt <= startAt', () => {
        const session = {
            startAt: new Date('2026-02-14T10:00:00Z'),
            endAt: new Date('2026-02-14T10:00:00Z'),
        };
        expect(splitSessionByDay(session, tz)).toEqual([]);
    });
});

describe('computeDayTotal', () => {
    const tz = 'Asia/Kolkata';

    test('sums multiple sessions for the same day', () => {
        const sessions = [
            {
                startAt: new Date('2026-02-14T03:30:00Z'), // 09:00 IST
                endAt: new Date('2026-02-14T07:00:00Z'),   // 12:30 IST
            },
            {
                startAt: new Date('2026-02-14T08:30:00Z'), // 14:00 IST
                endAt: new Date('2026-02-14T11:00:00Z'),   // 16:30 IST
            },
        ];
        const totalMs = computeDayTotal(sessions, '2026-02-14', tz);
        // 3.5 + 2.5 = 6 hours
        expect(totalMs).toBe(6 * 3600000);
    });

    test('only counts the portion of an overnight session for the given day', () => {
        const sessions = [
            {
                startAt: new Date('2026-02-14T17:30:00Z'), // 23:00 IST
                endAt: new Date('2026-02-14T20:30:00Z'),   // 02:00 IST Feb 15
            },
        ];
        // Only 1 hour falls on Feb 14 (23:00 → midnight)
        expect(computeDayTotal(sessions, '2026-02-14', tz)).toBe(1 * 3600000);
        // 2 hours fall on Feb 15 (midnight → 02:00)
        expect(computeDayTotal(sessions, '2026-02-15', tz)).toBe(2 * 3600000);
    });
});

describe('computeProgressPercent', () => {
    test('returns correct percentage for partial work', () => {
        // 4 hours worked out of 8 hour goal = 50%
        const pct = computeProgressPercent(4 * 3600000, 8);
        expect(pct).toBe(50);
    });

    test('caps at 100% when goal is exceeded', () => {
        // 10 hours worked with 8 hour goal
        const pct = computeProgressPercent(10 * 3600000, 8);
        expect(pct).toBe(100);
    });

    test('returns 0% for no work', () => {
        expect(computeProgressPercent(0, 8)).toBe(0);
    });

    test('returns 100% if goal is zero or negative', () => {
        expect(computeProgressPercent(1000, 0)).toBe(100);
        expect(computeProgressPercent(1000, -1)).toBe(100);
    });
});

describe('formatDuration', () => {
    test('formats hours and minutes correctly', () => {
        expect(formatDuration(0)).toBe('00:00');
        expect(formatDuration(3600000)).toBe('01:00');
        expect(formatDuration(5400000)).toBe('01:30');
        expect(formatDuration(9 * 3600000 + 45 * 60000)).toBe('09:45');
    });
});

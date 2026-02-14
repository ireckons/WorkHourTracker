const { DateTime } = require('luxon');

/**
 * Split a single work session into per-day duration buckets.
 *
 * KEY LOGIC: If a session spans midnight in the user's timezone, we split it
 * at each midnight boundary so that each calendar day gets the correct
 * portion of the work time.
 *
 * Example (IST = Asia/Kolkata):
 *   session: 2026-02-14 23:00 → 2026-02-15 02:00
 *   result:  [{date:'2026-02-14', durationMs:3600000},   // 1 hour before midnight
 *             {date:'2026-02-15', durationMs:7200000}]   // 2 hours after midnight
 *
 * @param {{ startAt: Date, endAt: Date|null }} session
 * @param {string} timezone - IANA timezone string (e.g. 'Asia/Kolkata')
 * @returns {Array<{ date: string, durationMs: number }>}
 */
function splitSessionByDay(session, timezone) {
    const start = DateTime.fromJSDate(session.startAt, { zone: timezone });
    // If the session is still active, use the current time as the end
    const end = session.endAt
        ? DateTime.fromJSDate(session.endAt, { zone: timezone })
        : DateTime.now().setZone(timezone);

    if (end <= start) return [];

    const result = [];
    let cursor = start;

    while (cursor < end) {
        // Next midnight boundary in the user's timezone
        const nextMidnight = cursor.plus({ days: 1 }).startOf('day');
        // The segment ends at whichever comes first: midnight or session end
        const segmentEnd = nextMidnight < end ? nextMidnight : end;
        const durationMs = segmentEnd.diff(cursor).as('milliseconds');

        if (durationMs > 0) {
            result.push({
                date: cursor.toFormat('yyyy-MM-dd'),
                durationMs,
            });
        }

        cursor = nextMidnight;
    }

    return result;
}

/**
 * Compute total worked milliseconds for a specific calendar day.
 *
 * For each session, we split it by day boundaries and sum only the
 * portions that fall on the target date.
 *
 * @param {Array} sessions - Mongoose Session documents
 * @param {string} date - Target date in 'YYYY-MM-DD' format
 * @param {string} timezone - IANA timezone string
 * @returns {number} Total milliseconds worked on the given date
 */
function computeDayTotal(sessions, date, timezone) {
    let totalMs = 0;

    for (const session of sessions) {
        const segments = splitSessionByDay(session, timezone);
        for (const seg of segments) {
            if (seg.date === date) {
                totalMs += seg.durationMs;
            }
        }
    }

    return totalMs;
}

/**
 * Compute progress percentage towards a daily goal.
 *
 * KEY LOGIC: percentage = (workedMs / goalMs) * 100, capped at 100%.
 * This ensures the progress bar never exceeds 100% visually even if
 * the user works overtime.
 *
 * @param {number} workedMs - Milliseconds worked
 * @param {number} goalHours - Goal in hours
 * @returns {number} Progress percentage (0–100)
 */
function computeProgressPercent(workedMs, goalHours) {
    if (goalHours <= 0) return 100;
    const goalMs = goalHours * 3600000;
    return Math.min(100, (workedMs / goalMs) * 100);
}

/**
 * Get the current date string in the user's timezone.
 * @param {string} timezone - IANA timezone string
 * @returns {string} 'YYYY-MM-DD'
 */
function getTodayInTimezone(timezone) {
    return DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
}

/**
 * Get start and end of a calendar day as JS Date objects (UTC).
 * Used for querying sessions that overlap a given day.
 *
 * @param {string} date - 'YYYY-MM-DD'
 * @param {string} timezone - IANA timezone
 * @returns {{ dayStart: Date, dayEnd: Date }}
 */
function getDayBounds(date, timezone) {
    const dayStart = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: timezone }).startOf('day');
    const dayEnd = dayStart.plus({ days: 1 });
    return {
        dayStart: dayStart.toJSDate(),
        dayEnd: dayEnd.toJSDate(),
    };
}

/**
 * Format milliseconds as HH:MM string.
 * @param {number} ms
 * @returns {string} e.g. '02:45'
 */
function formatDuration(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

module.exports = {
    splitSessionByDay,
    computeDayTotal,
    computeProgressPercent,
    getTodayInTimezone,
    getDayBounds,
    formatDuration,
};

/**
 * Progress calculation utility for the frontend.
 *
 * KEY LOGIC: percentage = (workedMs / goalMs) * 100, capped at 100%.
 * This matches the server-side calculation in server/src/utils/time.js.
 *
 * @param {number} workedMs - Milliseconds worked
 * @param {number} goalHours - Goal in hours
 * @returns {number} Progress percentage (0–100)
 */
export function computeProgressPercent(workedMs, goalHours) {
    if (goalHours <= 0) return 100;
    const goalMs = goalHours * 3600000;
    return Math.min(100, (workedMs / goalMs) * 100);
}

/**
 * Format milliseconds as HH:MM string.
 * @param {number} ms
 * @returns {string} e.g. '02:45'
 */
export function formatDuration(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

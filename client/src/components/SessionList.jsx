import { DateTime } from 'luxon';

/**
 * Displays the list of work sessions for the day.
 * Shows start/end time and duration for each session.
 *
 * @param {{ sessions: Array, timezone: string }} props
 */
function SessionList({ sessions, timezone }) {
    if (!sessions || sessions.length === 0) {
        return (
            <div className="session-list-empty">
                <span className="empty-icon">📋</span>
                <p>No sessions today. Start working to see them here!</p>
            </div>
        );
    }

    const formatTime = (dateStr) => {
        if (!dateStr) return '—';
        return DateTime.fromISO(dateStr, { zone: timezone || 'local' }).toFormat('hh:mm a');
    };

    const formatDuration = (startStr, endStr) => {
        if (!startStr) return '—';
        const start = DateTime.fromISO(startStr);
        const end = endStr ? DateTime.fromISO(endStr) : DateTime.now();
        const diff = end.diff(start, ['hours', 'minutes']);
        const h = Math.floor(diff.hours);
        const m = Math.floor(diff.minutes);
        return `${h}h ${m}m`;
    };

    return (
        <div className="session-list">
            <h3 className="section-title">
                <span className="section-icon">📋</span>
                Today's Sessions
            </h3>
            <div className="session-cards">
                {sessions.map((session, index) => (
                    <div
                        key={session._id || index}
                        className={`session-card ${!session.endAt ? 'session-active' : ''}`}
                    >
                        <div className="session-index">#{index + 1}</div>
                        <div className="session-times">
                            <div className="session-time">
                                <span className="time-label">Start</span>
                                <span className="time-value">{formatTime(session.startAt)}</span>
                            </div>
                            <span className="time-arrow">→</span>
                            <div className="session-time">
                                <span className="time-label">End</span>
                                <span className="time-value">
                                    {session.endAt ? formatTime(session.endAt) : (
                                        <span className="active-badge">
                                            <span className="pulse-dot" />
                                            Active
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="session-duration">
                            {formatDuration(session.startAt, session.endAt)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SessionList;

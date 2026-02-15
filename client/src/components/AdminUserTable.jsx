import { useState } from 'react';
import api from '../api/axios';

function AdminUserTable({ users, onPromote, date }) {
    const [expandedUser, setExpandedUser] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    const viewSessions = async (userId) => {
        if (expandedUser === userId) {
            setExpandedUser(null);
            return;
        }
        try {
            setLoadingSessions(true);
            setExpandedUser(userId);
            const res = await api.get(`/admin/users/${userId}/sessions`, { params: { date } });
            setSessions(res.data.sessions);
        } catch {
            setSessions([]);
        } finally {
            setLoadingSessions(false);
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (startAt, endAt) => {
        if (!endAt) return 'Active';
        const ms = new Date(endAt) - new Date(startAt);
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return `${h}h ${m}m`;
    };

    if (users.length === 0) {
        return <div className="admin-empty">No users found</div>;
    }

    return (
        <div className="admin-user-table-wrap">
            <table className="admin-user-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Hours Today</th>
                        <th>Goal</th>
                        <th>Progress</th>
                        <th>Status</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <>
                            <tr key={user._id} className={expandedUser === user._id ? 'row-expanded' : ''}>
                                <td>
                                    <div className="user-cell">
                                        <span className="user-avatar-small">
                                            {user.name?.[0]?.toUpperCase()}
                                        </span>
                                        {user.name}
                                    </div>
                                </td>
                                <td className="email-cell">{user.email}</td>
                                <td className="hours-cell">{user.totalFormatted}</td>
                                <td>{user.goalHours}h</td>
                                <td>
                                    <div className="mini-progress-wrap">
                                        <div className="mini-progress-bar">
                                            <div
                                                className="mini-progress-fill"
                                                style={{ width: `${Math.min(user.progressPercent, 100)}%` }}
                                            />
                                        </div>
                                        <span className="mini-progress-text">
                                            {Math.round(user.progressPercent)}%
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`status-dot ${user.isOnline ? 'online' : 'offline'}`} />
                                    {user.isOnline ? 'Online' : 'Offline'}
                                </td>
                                <td>
                                    {user.isAdmin ? (
                                        <span className="role-badge admin">Admin</span>
                                    ) : (
                                        <span className="role-badge employee">Employee</span>
                                    )}
                                </td>
                                <td className="actions-cell">
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => viewSessions(user._id)}
                                        title="View sessions"
                                    >
                                        👁️
                                    </button>
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => onPromote(user._id, !user.isAdmin)}
                                        title={user.isAdmin ? 'Demote from admin' : 'Promote to admin'}
                                    >
                                        {user.isAdmin ? '⬇️' : '⬆️'}
                                    </button>
                                </td>
                            </tr>

                            {/* Expanded sessions row */}
                            {expandedUser === user._id && (
                                <tr key={`${user._id}-sessions`} className="sessions-row">
                                    <td colSpan="8">
                                        <div className="sessions-drawer">
                                            <h4>Sessions for {user.name} — {date}</h4>
                                            {loadingSessions ? (
                                                <p>Loading sessions...</p>
                                            ) : sessions.length === 0 ? (
                                                <p className="no-sessions">No sessions for this date</p>
                                            ) : (
                                                <table className="sessions-inner-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Start</th>
                                                            <th>End</th>
                                                            <th>Duration</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sessions.map((s) => (
                                                            <tr key={s._id}>
                                                                <td>{formatTime(s.startAt)}</td>
                                                                <td>
                                                                    {s.endAt ? (
                                                                        formatTime(s.endAt)
                                                                    ) : (
                                                                        <span className="active-badge">● Active</span>
                                                                    )}
                                                                </td>
                                                                <td>{formatDuration(s.startAt, s.endAt)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default AdminUserTable;

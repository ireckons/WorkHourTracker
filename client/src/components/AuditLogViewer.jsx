import { useState, useEffect } from 'react';
import api from '../api/axios';

const ACTION_LABELS = {
    ADMIN_LOGIN: { label: 'Admin Login', color: '#4a9eff' },
    ADMIN_LOGIN_DENIED: { label: 'Login Denied', color: '#ff4a6e' },
    PROMOTE: { label: 'Promoted', color: '#4aff8c' },
    DEMOTE: { label: 'Demoted', color: '#ffaa4a' },
    INVITE_CREATED: { label: 'Invite Sent', color: '#c084fc' },
    INVITE_USED: { label: 'Invite Used', color: '#22d3ee' },
};

function AuditLogViewer() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [expandedLog, setExpandedLog] = useState(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const res = await api.get('/admin/audit', { params: { page, limit: 20 } });
                setLogs(res.data.logs);
                setTotalPages(res.data.pagination.totalPages);
            } catch {
                setLogs([]);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [page]);

    if (loading) return <p className="audit-loading">Loading audit log...</p>;
    if (logs.length === 0) return <p className="audit-empty">No audit entries yet</p>;

    return (
        <div className="audit-log-viewer">
            <table className="audit-table">
                <thead>
                    <tr>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th>Timestamp</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => {
                        const actionInfo = ACTION_LABELS[log.action] || {
                            label: log.action,
                            color: '#888',
                        };
                        return (
                            <>
                                <tr key={log._id}>
                                    <td>
                                        <span
                                            className="action-badge"
                                            style={{ backgroundColor: actionInfo.color + '22', color: actionInfo.color, borderColor: actionInfo.color }}
                                        >
                                            {actionInfo.label}
                                        </span>
                                    </td>
                                    <td>{log.actorUserId?.name || log.actorUserId?.email || '—'}</td>
                                    <td>{log.targetUserId?.name || log.targetUserId?.email || '—'}</td>
                                    <td className="timestamp-cell">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td>
                                        {log.details && Object.keys(log.details).length > 0 && (
                                            <button
                                                className="btn btn-sm btn-ghost"
                                                onClick={() =>
                                                    setExpandedLog(expandedLog === log._id ? null : log._id)
                                                }
                                            >
                                                {expandedLog === log._id ? '▲' : '▼'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedLog === log._id && (
                                    <tr key={`${log._id}-details`} className="audit-details-row">
                                        <td colSpan="5">
                                            <pre className="audit-details">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        </td>
                                    </tr>
                                )}
                            </>
                        );
                    })}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div className="audit-pagination">
                    <button
                        className="btn btn-sm btn-ghost"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                    >
                        ← Prev
                    </button>
                    <span className="page-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="btn btn-sm btn-ghost"
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

export default AuditLogViewer;

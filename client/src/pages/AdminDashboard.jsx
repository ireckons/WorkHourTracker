import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import AdminUserTable from '../components/AdminUserTable';
import AdminInviteModal from '../components/AdminInviteModal';
import AuditLogViewer from '../components/AuditLogViewer';
import '../styles/AdminDashboard.css';

function AdminDashboard() {
    const [users, setUsers] = useState([]);
    const [date, setDate] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [periodView, setPeriodView] = useState('week');

    const fetchUsers = useCallback(async (queryDate) => {
        try {
            setLoading(true);
            const params = queryDate ? { date: queryDate } : {};
            const res = await api.get('/admin/users', { params });
            setUsers(res.data.users);
            setDate(res.data.date);
            if (!selectedDate) setSelectedDate(res.data.date);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchUsers(selectedDate);
    }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePromote = async (userId, makeAdmin) => {
        try {
            await api.post('/admin/promote', { userId, makeAdmin });
            fetchUsers(selectedDate);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update admin status');
        }
    };

    const handleExport = async () => {
        try {
            const res = await api.get('/admin/export', {
                params: { date: selectedDate || date },
                responseType: 'blob',
            });
            const url = URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `daily-summary-${selectedDate || date}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to export CSV');
        }
    };

    // Computed stats
    const totalEmployees = users.length;
    const onlineCount = users.filter((u) => u.isOnline).length;
    const avgProgress =
        users.length > 0
            ? Math.round(users.reduce((sum, u) => sum + u.progressPercent, 0) / users.length)
            : 0;

    // Filtered and sorted users
    const filteredUsers = users
        .filter(
            (u) =>
                u.name.toLowerCase().includes(search.toLowerCase()) ||
                u.email.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => {
            switch (sortBy) {
                case 'hours':
                    return b.totalMs - a.totalMs;
                case 'progress':
                    return b.progressPercent - a.progressPercent;
                case 'status':
                    return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
                default:
                    return a.name.localeCompare(b.name);
            }
        });

    return (
        <div className="admin-dashboard">
            <div className="admin-header">
                <div className="admin-header-left">
                    <h1>🛡️ Admin Dashboard</h1>
                    <p className="admin-subtitle">Manage employees and monitor progress</p>
                </div>
                <div className="admin-header-actions">
                    <button className="btn btn-accent" onClick={() => setShowInviteModal(true)}>
                        ✉️ Invite Admin
                    </button>
                    <button className="btn btn-ghost" onClick={() => setShowAuditLog(!showAuditLog)}>
                        📋 {showAuditLog ? 'Hide' : 'Show'} Audit Log
                    </button>
                    <button className="btn btn-ghost" onClick={handleExport}>
                        📥 Export CSV
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="admin-stats-row">
                <div className="admin-stat-card">
                    <span className="stat-number">{totalEmployees}</span>
                    <span className="stat-label">Total Users</span>
                </div>
                <div className="admin-stat-card stat-online">
                    <span className="stat-number">{onlineCount}</span>
                    <span className="stat-label">Online Now</span>
                </div>
                <div className="admin-stat-card">
                    <span className="stat-number">{avgProgress}%</span>
                    <span className="stat-label">Avg Progress</span>
                </div>
                <div className="admin-stat-card">
                    <span className="stat-number">{date}</span>
                    <span className="stat-label">Viewing Date</span>
                </div>
            </div>

            {/* Controls */}
            <div className="admin-controls">
                <input
                    type="date"
                    className="admin-date-picker"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                />
                <input
                    type="text"
                    className="admin-search"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    className="admin-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                >
                    <option value="name">Sort by Name</option>
                    <option value="hours">Sort by Hours</option>
                    <option value="progress">Sort by Progress</option>
                    <option value="status">Sort by Status</option>
                </select>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
                <div className="admin-loading">Loading employee data...</div>
            ) : (
                <AdminUserTable
                    users={filteredUsers}
                    onPromote={handlePromote}
                    date={selectedDate || date}
                    periodView={periodView}
                    onPeriodChange={setPeriodView}
                />
            )}

            {/* Audit Log Panel */}
            {showAuditLog && (
                <div className="admin-audit-section">
                    <h2>📋 Audit Log</h2>
                    <AuditLogViewer />
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <AdminInviteModal onClose={() => setShowInviteModal(false)} />
            )}
        </div>
    );
}

export default AdminDashboard;

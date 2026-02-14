import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ProgressBar from '../components/ProgressBar';
import SessionList from '../components/SessionList';
import GoalEditor from '../components/GoalEditor';
import '../styles/Dashboard.css';

/**
 * Main dashboard page.
 *
 * - Fetches today's summary (total hours, progress, sessions, goal) on mount.
 * - Refreshes summary immediately on session start/end.
 * - Sets up a 60-second interval to auto-refresh the progress bar while
 *   a session is active (so the bar grows in real-time).
 */
function Dashboard() {
    const { user } = useAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchSummary = useCallback(async () => {
        try {
            const res = await api.get('/sessions/today/summary');
            setSummary(res.data);
            setError('');
        } catch (err) {
            setError('Failed to load dashboard data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch summary on mount
    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    // Auto-refresh every 60 seconds while a session is active
    // This keeps the progress bar updating in real-time
    useEffect(() => {
        if (!summary?.activeSession) return;

        const interval = setInterval(() => {
            fetchSummary();
        }, 60000); // every 1 minute

        return () => clearInterval(interval);
    }, [summary?.activeSession, fetchSummary]);

    const handleStartWork = async () => {
        setActionLoading(true);
        setError('');
        try {
            await api.post('/sessions/start');
            await fetchSummary(); // Immediately refresh
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to start session');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEndWork = async () => {
        setActionLoading(true);
        setError('');
        try {
            await api.patch('/sessions/end');
            await fetchSummary(); // Immediately refresh
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to end session');
        } finally {
            setActionLoading(false);
        }
    };

    const handleGoalUpdated = (newGoalHours) => {
        setSummary((prev) => prev ? { ...prev, goalHours: newGoalHours } : prev);
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner" />
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    const isActive = !!summary?.activeSession;

    return (
        <div className="dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div className="greeting">
                    <h1>
                        Good {getGreeting()}, <span className="user-name">{user?.name?.split(' ')[0]}</span>
                    </h1>
                    <p className="date-display">
                        📅 {new Date().toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </p>
                </div>

                {/* Start / End Work Button */}
                <button
                    className={`btn btn-action ${isActive ? 'btn-stop' : 'btn-start'}`}
                    onClick={isActive ? handleEndWork : handleStartWork}
                    disabled={actionLoading}
                    id="work-toggle-btn"
                >
                    {actionLoading ? (
                        <span className="btn-loading">⏳</span>
                    ) : isActive ? (
                        <>
                            <span className="btn-icon">⏹</span>
                            End Work
                        </>
                    ) : (
                        <>
                            <span className="btn-icon">▶</span>
                            Start Work
                        </>
                    )}
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Stats Cards */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-icon">⏱</div>
                    <div className="stat-content">
                        <span className="stat-value">{summary?.totalFormatted || '00:00'}</span>
                        <span className="stat-label">Hours Worked</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-content">
                        <span className="stat-value">{summary?.goalHours?.toFixed(1) || '8.0'}h</span>
                        <span className="stat-label">Daily Goal</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                        <span className="stat-value">{Math.round(summary?.progressPercent || 0)}%</span>
                        <span className="stat-label">Progress</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📝</div>
                    <div className="stat-content">
                        <span className="stat-value">{summary?.sessions?.length || 0}</span>
                        <span className="stat-label">Sessions</span>
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            {summary && (
                <div className="card">
                    <ProgressBar
                        workedMs={summary.totalMs}
                        goalHours={summary.goalHours}
                    />
                </div>
            )}

            {/* Bottom section: Goal Editor + Session List */}
            <div className="dashboard-grid">
                <div className="card">
                    {summary && (
                        <GoalEditor
                            goalHours={summary.goalHours}
                            date={summary.date}
                            onGoalUpdated={handleGoalUpdated}
                        />
                    )}
                </div>
                <div className="card">
                    {summary && (
                        <SessionList
                            sessions={summary.sessions}
                            timezone={user?.timezone}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Returns a greeting based on current time of day.
 */
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
}

export default Dashboard;

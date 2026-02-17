import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ProgressBar from '../components/ProgressBar';
import SessionList from '../components/SessionList';
import GoalEditor from '../components/GoalEditor';
import WorkCalendar from '../components/WorkCalendar';
import '../styles/Dashboard.css';

/**
 * Helper: get today's date as YYYY-MM-DD in local timezone.
 */
function getTodayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Format YYYY-MM-DD as a readable date string.
 */
function formatDateDisplay(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Main dashboard page.
 *
 * - Fetches summary for the selected date (defaults to today).
 * - Clicking a calendar date loads that day's data.
 * - Sets up a 60-second interval to auto-refresh while a session is active.
 */
function Dashboard() {
    const { user } = useAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedDate, setSelectedDate] = useState(null); // null = today

    const viewingToday = !selectedDate || selectedDate === getTodayStr();
    const displayDate = selectedDate || getTodayStr();

    const fetchSummary = useCallback(async (date) => {
        try {
            const dateParam = date ? `?date=${date}` : '';
            const res = await api.get(`/sessions/today/summary${dateParam}`);
            setSummary(res.data);
            setError('');
        } catch (err) {
            setError('Failed to load dashboard data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch summary on mount and when selectedDate changes
    useEffect(() => {
        setLoading(true);
        fetchSummary(selectedDate);
    }, [selectedDate, fetchSummary]);

    // Auto-refresh every 60 seconds while a session is active (only for today)
    useEffect(() => {
        if (!summary?.activeSession || !viewingToday) return;

        const interval = setInterval(() => {
            fetchSummary(selectedDate);
        }, 60000);

        return () => clearInterval(interval);
    }, [summary?.activeSession, viewingToday, selectedDate, fetchSummary]);

    const handleStartWork = async () => {
        setActionLoading(true);
        setError('');
        try {
            await api.post('/sessions/start');
            await fetchSummary(selectedDate);
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
            await fetchSummary(selectedDate);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to end session');
        } finally {
            setActionLoading(false);
        }
    };

    const handleGoalUpdated = (newGoalHours) => {
        setSummary((prev) => prev ? { ...prev, goalHours: newGoalHours } : prev);
    };

    const handleDateSelect = (dateStr) => {
        if (dateStr === getTodayStr()) {
            setSelectedDate(null); // reset to today
        } else {
            setSelectedDate(dateStr);
        }
    };

    const handleBackToToday = () => {
        setSelectedDate(null);
    };

    if (loading && !summary) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner" />
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    const isActive = !!summary?.activeSession;

    return (
        <div className="dashboard-layout">
            {/* Left column — main dashboard content */}
            <div className="dashboard-main">
                <div className="dashboard">
                    {/* Header */}
                    <div className="dashboard-header">
                        <div className="greeting">
                            <h1>
                                {viewingToday ? (
                                    <>Good {getGreeting()}, <span className="user-name">{user?.name?.split(' ')[0]}</span></>
                                ) : (
                                    <>Viewing <span className="user-name">{formatDateDisplay(displayDate)}</span></>
                                )}
                            </h1>
                            <p className="date-display">
                                📅 {formatDateDisplay(displayDate)}
                                {!viewingToday && (
                                    <button className="btn-back-today" onClick={handleBackToToday}>
                                        ← Back to Today
                                    </button>
                                )}
                            </p>
                        </div>

                        {/* Start / End Work Button — only for today */}
                        {viewingToday && (
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
                        )}
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

                    {/* Progress Bar — always shown */}
                    <div className="card">
                        <ProgressBar
                            workedMs={summary?.totalMs || 0}
                            goalHours={summary?.goalHours || 8}
                        />
                    </div>

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
            </div>

            {/* Right column — Work Calendar */}
            <div className="dashboard-sidebar">
                <div className="card">
                    <WorkCalendar
                        selectedDate={displayDate}
                        onDateSelect={handleDateSelect}
                    />
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

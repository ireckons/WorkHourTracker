import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

/**
 * Monthly work-hours calendar.
 * Fetches per-day totals for a given month and renders a calendar grid.
 * Each day cell is color-coded based on hours worked.
 *
 * Props:
 *   - selectedDate: 'YYYY-MM-DD' — currently selected date (highlighted)
 *   - onDateSelect: (dateStr) => void — callback when a date is clicked
 */
function WorkCalendar({ selectedDate, onDateSelect }) {
    const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() }; // month 0-indexed
    });
    const [monthData, setMonthData] = useState(null);
    const [loading, setLoading] = useState(true);

    const monthKey = `${currentDate.year}-${String(currentDate.month + 1).padStart(2, '0')}`;

    const fetchMonthly = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/sessions/monthly-summary?month=${monthKey}`);
            setMonthData(res.data);
        } catch (err) {
            console.error('Failed to fetch monthly summary', err);
        } finally {
            setLoading(false);
        }
    }, [monthKey]);

    useEffect(() => {
        fetchMonthly();
    }, [fetchMonthly]);

    const goToPrevMonth = () => {
        setCurrentDate((prev) => {
            if (prev.month === 0) return { year: prev.year - 1, month: 11 };
            return { ...prev, month: prev.month - 1 };
        });
    };

    const goToNextMonth = () => {
        setCurrentDate((prev) => {
            if (prev.month === 11) return { year: prev.year + 1, month: 0 };
            return { ...prev, month: prev.month + 1 };
        });
    };

    // Build the calendar grid
    const buildCalendarGrid = () => {
        const year = currentDate.year;
        const month = currentDate.month;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Day of week for first day (0=Sun, adjust: Mon=0)
        let startDow = firstDay.getDay() - 1;
        if (startDow < 0) startDow = 6; // Sunday → 6

        const cells = [];

        // Empty leading cells
        for (let i = 0; i < startDow; i++) {
            cells.push({ type: 'empty', key: `e-${i}` });
        }

        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = monthData?.days?.[dateStr];
            cells.push({
                type: 'day',
                key: dateStr,
                day: d,
                dateStr,
                totalMs: dayData?.totalMs || 0,
                totalFormatted: dayData?.totalFormatted || '00:00',
            });
        }

        return cells;
    };

    const getHeatColor = (totalMs) => {
        const hours = totalMs / 3600000;
        if (hours === 0) return 'cal-level-0';
        if (hours < 2) return 'cal-level-1';
        if (hours < 4) return 'cal-level-2';
        if (hours < 6) return 'cal-level-3';
        if (hours < 8) return 'cal-level-4';
        return 'cal-level-5';
    };

    const isToday = (dateStr) => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        return dateStr === todayStr;
    };

    const isSelected = (dateStr) => {
        return selectedDate === dateStr;
    };

    const monthName = new Date(currentDate.year, currentDate.month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const cells = buildCalendarGrid();

    return (
        <div className="work-calendar" id="work-calendar">
            {/* Calendar header */}
            <div className="cal-header">
                <button className="cal-nav-btn" onClick={goToPrevMonth} aria-label="Previous month" id="cal-prev">
                    ◀
                </button>
                <h3 className="cal-month-title">📅 {monthName}</h3>
                <button className="cal-nav-btn" onClick={goToNextMonth} aria-label="Next month" id="cal-next">
                    ▶
                </button>
            </div>

            {/* Day-of-week headers */}
            <div className="cal-grid cal-day-headers">
                {dayHeaders.map((d) => (
                    <div key={d} className="cal-day-header">{d}</div>
                ))}
            </div>

            {/* Calendar grid */}
            {loading ? (
                <div className="cal-loading">
                    <div className="loading-spinner" style={{ width: 24, height: 24 }} />
                </div>
            ) : (
                <div className="cal-grid cal-days">
                    {cells.map((cell) => {
                        if (cell.type === 'empty') {
                            return <div key={cell.key} className="cal-cell cal-empty" />;
                        }
                        const classes = [
                            'cal-cell',
                            'cal-day',
                            getHeatColor(cell.totalMs),
                            isToday(cell.dateStr) ? 'cal-today' : '',
                            isSelected(cell.dateStr) ? 'cal-selected' : '',
                        ].filter(Boolean).join(' ');

                        return (
                            <div
                                key={cell.key}
                                className={classes}
                                title={`${cell.dateStr}: ${cell.totalFormatted}`}
                                onClick={() => onDateSelect?.(cell.dateStr)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') onDateSelect?.(cell.dateStr); }}
                            >
                                <span className="cal-day-num">{cell.day}</span>
                                {cell.totalMs > 0 && (
                                    <span className="cal-day-hours">{cell.totalFormatted}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Legend */}
            <div className="cal-legend">
                <span className="cal-legend-label">Less</span>
                <div className="cal-legend-cell cal-level-0" />
                <div className="cal-legend-cell cal-level-1" />
                <div className="cal-legend-cell cal-level-2" />
                <div className="cal-legend-cell cal-level-3" />
                <div className="cal-legend-cell cal-level-4" />
                <div className="cal-legend-cell cal-level-5" />
                <span className="cal-legend-label">More</span>
            </div>
        </div>
    );
}

export default WorkCalendar;

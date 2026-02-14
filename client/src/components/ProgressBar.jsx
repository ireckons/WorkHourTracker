/**
 * Progress bar component with accessible markup and numeric readout.
 *
 * Visual behavior:
 * - Container background: #e0e0e0 (grey)
 * - Fill color: #ff8c00 (orange)
 * - Width of fill = min(100, progressPercent)%
 * - When progress >= 100%, bar is fully orange
 *
 * @param {{ workedMs: number, goalHours: number }} props
 */
function ProgressBar({ workedMs, goalHours }) {
    const goalMs = goalHours * 3600000;
    const percent = goalMs > 0 ? Math.min(100, (workedMs / goalMs) * 100) : 100;
    const workedHours = (workedMs / 3600000).toFixed(1);
    const displayPercent = Math.round(percent);

    return (
        <div className="progress-container">
            <div className="progress-info">
                <span className="progress-label">Today's Progress</span>
                <span className="progress-readout">
                    {workedHours} / {goalHours.toFixed(1)} hrs ({displayPercent}%)
                </span>
            </div>

            <div
                className="progress-bar"
                role="progressbar"
                aria-valuenow={displayPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Work progress: ${workedHours} of ${goalHours} hours (${displayPercent}%)`}
            >
                <div
                    className="progress-fill"
                    style={{
                        width: `${percent}%`,
                        backgroundColor: '#ff8c00',
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    {percent >= 15 && (
                        <span className="progress-fill-text">{displayPercent}%</span>
                    )}
                </div>
            </div>

            {percent >= 100 && (
                <div className="progress-complete">
                    🎉 Goal reached! Great work today!
                </div>
            )}
        </div>
    );
}

export default ProgressBar;

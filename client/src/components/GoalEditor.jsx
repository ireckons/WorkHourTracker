import { useState } from 'react';
import api from '../api/axios';

/**
 * Editable daily goal component.
 * Allows users to adjust their daily work hour target.
 *
 * @param {{ goalHours: number, date: string, onGoalUpdated: Function }} props
 */
function GoalEditor({ goalHours, date, onGoalUpdated }) {
    const [value, setValue] = useState(goalHours);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        if (value === goalHours) return;
        setSaving(true);
        setSaved(false);
        try {
            await api.put('/goals', { date, goalHours: parseFloat(value) });
            onGoalUpdated(parseFloat(value));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save goal:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="goal-editor">
            <h3 className="section-title">
                <span className="section-icon">🎯</span>
                Daily Goal
            </h3>
            <div className="goal-controls">
                <div className="goal-input-group">
                    <button
                        className="goal-btn goal-btn-minus"
                        onClick={() => setValue(Math.max(0.5, value - 0.5))}
                        aria-label="Decrease goal by 30 minutes"
                    >
                        −
                    </button>
                    <input
                        type="number"
                        className="goal-input"
                        value={value}
                        onChange={(e) => setValue(Math.max(0.5, Math.min(24, parseFloat(e.target.value) || 0.5)))}
                        min={0.5}
                        max={24}
                        step={0.5}
                        aria-label="Daily goal in hours"
                    />
                    <span className="goal-unit">hours</span>
                    <button
                        className="goal-btn goal-btn-plus"
                        onClick={() => setValue(Math.min(24, value + 0.5))}
                        aria-label="Increase goal by 30 minutes"
                    >
                        +
                    </button>
                </div>
                <button
                    className="btn btn-primary btn-save"
                    onClick={handleSave}
                    disabled={saving || value === goalHours}
                >
                    {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
                </button>
            </div>
        </div>
    );
}

export default GoalEditor;

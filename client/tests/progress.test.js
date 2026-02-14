import { describe, test, expect } from 'vitest';
import { computeProgressPercent, formatDuration } from '../src/utils/progress';

describe('computeProgressPercent', () => {
    test('returns correct percentage for partial work', () => {
        // 4 hours worked out of 8 hour goal = 50%
        expect(computeProgressPercent(4 * 3600000, 8)).toBe(50);
    });

    test('returns 100% when goal exactly met', () => {
        expect(computeProgressPercent(8 * 3600000, 8)).toBe(100);
    });

    test('caps at 100% when goal exceeded', () => {
        expect(computeProgressPercent(10 * 3600000, 8)).toBe(100);
    });

    test('returns 0% for no work done', () => {
        expect(computeProgressPercent(0, 8)).toBe(0);
    });

    test('returns 100% if goal is 0 or negative', () => {
        expect(computeProgressPercent(1000, 0)).toBe(100);
        expect(computeProgressPercent(1000, -1)).toBe(100);
    });

    test('handles fractional goals', () => {
        // 1.5 hours worked out of 3 hour goal = 50%
        expect(computeProgressPercent(1.5 * 3600000, 3)).toBe(50);
    });
});

describe('formatDuration', () => {
    test('formats zero', () => {
        expect(formatDuration(0)).toBe('00:00');
    });

    test('formats whole hours', () => {
        expect(formatDuration(3600000)).toBe('01:00');
        expect(formatDuration(8 * 3600000)).toBe('08:00');
    });

    test('formats hours and minutes', () => {
        expect(formatDuration(5400000)).toBe('01:30');
        expect(formatDuration(9 * 3600000 + 15 * 60000)).toBe('09:15');
    });
});

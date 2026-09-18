import { describe, it, expect } from 'vitest';
import {
    dowFromDateKey,
    addDaysToKey,
    isValidDateKey,
    dateKeyFromParts,
    DateKeySchema,
} from '@/lib/day-key';

describe('dowFromDateKey', () => {
    it('returns the JS weekday of the calendar date', () => {
        expect(dowFromDateKey('2024-01-15')).toBe(1); // Monday
        expect(dowFromDateKey('2024-01-21')).toBe(0); // Sunday
        expect(dowFromDateKey('2024-01-20')).toBe(6); // Saturday
    });
});

describe('addDaysToKey', () => {
    it('adds and subtracts calendar days across month and year boundaries', () => {
        expect(addDaysToKey('2024-01-15', 7)).toBe('2024-01-22');
        expect(addDaysToKey('2024-01-22', -7)).toBe('2024-01-15');
        expect(addDaysToKey('2024-01-31', 1)).toBe('2024-02-01');
        expect(addDaysToKey('2023-12-31', 1)).toBe('2024-01-01');
        expect(addDaysToKey('2024-02-28', 1)).toBe('2024-02-29');
        expect(addDaysToKey('2023-02-28', 1)).toBe('2023-03-01');
    });
});

describe('isValidDateKey', () => {
    it('accepts real calendar dates', () => {
        expect(isValidDateKey('2024-02-29')).toBe(true); // leap year
        expect(isValidDateKey('2024-04-30')).toBe(true);
        expect(isValidDateKey('2023-12-31')).toBe(true);
    });

    it('rejects days that do not exist', () => {
        expect(isValidDateKey('2023-02-29')).toBe(false); // non-leap year
        expect(isValidDateKey('2024-02-30')).toBe(false);
        expect(isValidDateKey('2024-04-31')).toBe(false);
        expect(isValidDateKey('2024-06-31')).toBe(false);
        expect(isValidDateKey('2024-13-01')).toBe(false);
        expect(isValidDateKey('2024-00-10')).toBe(false);
        expect(isValidDateKey('2024-06-00')).toBe(false);
    });

    it('rejects malformed keys', () => {
        expect(isValidDateKey('2024-6-15')).toBe(false);
        expect(isValidDateKey('2024-06-15T00:00:00Z')).toBe(false);
        expect(isValidDateKey('garbage')).toBe(false);
    });
});

describe('dateKeyFromParts', () => {
    it('builds keys and rejects impossible dates', () => {
        expect(dateKeyFromParts(2024, 2, 29)).toBe('2024-02-29');
        expect(() => dateKeyFromParts(2023, 2, 29)).toThrow();
        expect(() => dateKeyFromParts(2024, 4, 31)).toThrow();
    });
});

describe('DateKeySchema', () => {
    it('validates format and calendar existence', () => {
        expect(DateKeySchema.safeParse('2024-02-29').success).toBe(true);
        expect(DateKeySchema.safeParse('2023-02-29').success).toBe(false);
        expect(DateKeySchema.safeParse('2024-04-31').success).toBe(false);
        expect(DateKeySchema.safeParse('2024-06-15T10:00:00Z').success).toBe(
            false
        );
    });
});

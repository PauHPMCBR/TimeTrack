import { describe, it, expect } from 'vitest';
import { escapeCsvField, toCsv } from '../../lib/csv';

describe('escapeCsvField', () => {
    it('keeps simple values unquoted', () => {
        expect(escapeCsvField('alice@example.com')).toBe('alice@example.com');
        expect(escapeCsvField('42')).toBe('42');
    });

    it('wraps fields containing commas, quotes or newlines', () => {
        expect(escapeCsvField('Work, from home')).toBe('"Work, from home"');
        expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    });

    it('turns null/undefined into empty string', () => {
        expect(escapeCsvField(null)).toBe('');
        expect(escapeCsvField(undefined)).toBe('');
    });
});

describe('toCsv', () => {
    it('writes header and rows separated by CRLF', () => {
        const csv = toCsv(
            ['Name', 'Email'],
            [
                ['Alice', 'alice@example.com'],
                ['Bob', 'bob@example.com'],
            ]
        );
        expect(csv).toBe(
            'Name,Email\r\nAlice,alice@example.com\r\nBob,bob@example.com'
        );
    });
});

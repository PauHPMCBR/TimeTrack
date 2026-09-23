import { describe, it, expect } from 'vitest';
import {
    buildExportSheet,
    sessionsToText,
} from '../../src/lib/export-sheets';
import { ExportDocumentRowsSchema } from '../../src/schemas/export';

const documents = ExportDocumentRowsSchema.parse({
    daily: [
        {
            userId: 'u1',
            userName: 'John',
            date: '2025-07-01',
            dayClassification: 'workday',
            sessions: [
                { type: 'check_in', time: '08:00' },
                {
                    type: 'check_out',
                    time: '17:00',
                    overtime: true,
                    notes: 'late',
                },
            ],
            totalHours: 9,
            overtimeHours: 1,
            expectedHours: 8,
            anomalies: ['hours_over'],
            source: 'userClick',
            edited: true,
        },
    ],
    detailed: [
        {
            userId: 'u1',
            userName: 'John',
            date: '2025-07-01',
            time: '17:00',
            type: 'check_out',
            source: 'userClick',
            overtime: true,
            notes: 'late',
            version: 2,
            edited: true,
            confirmed: false,
        },
    ],
    overtime: [
        {
            userId: 'u1',
            userName: 'John',
            date: '2025-07-01',
            entry: '18:00',
            leave: '20:00',
            worked: '02:00',
            entryNotes: 'start',
            leaveNotes: 'end',
        },
    ],
    monthly: [
        {
            userId: 'u1',
            userName: 'John',
            year: 2025,
            month: 7,
            daysWithSessions: 20,
            totalHours: 160,
            overtimeHours: 4,
            expectedHours: 160,
            electiveVacationDays: 2,
            obligatoryVacationDays: 1,
            authorizedLeaveDays: 0,
            anomalyCount: 1,
            confirmed: false,
        },
    ],
    history: [
        {
            userId: 'u1',
            userName: 'John',
            date: '2025-07-01',
            version: 2,
            status: 'replaced',
            source: 'adminManual',
            replacedByVersion: 3,
            editedAt: new Date('2025-07-02T09:00:00.000Z'),
            sessions: [{ type: 'check_in', time: '08:00' }],
        },
    ],
});

describe('sessionsToText', () => {
    it('renders a plain entry-leave pair list', () => {
        expect(
            sessionsToText([
                { type: 'check_in', time: '08:00' },
                { type: 'check_out', time: '12:00' },
                { type: 'check_in', time: '13:00' },
                { type: 'check_out', time: '17:00' },
            ])
        ).toBe('08:00-12:00; 13:00-17:00');
    });

    it('wraps overtime pairs in parentheses', () => {
        expect(
            sessionsToText([
                { type: 'check_in', time: '08:00' },
                { type: 'check_out', time: '17:00' },
                { type: 'check_in', time: '18:00', overtime: true },
                { type: 'check_out', time: '20:00', overtime: true },
            ])
        ).toBe('08:00-17:00; (18:00-20:00)');
    });

    it('marks unmatched sessions', () => {
        expect(
            sessionsToText([
                { type: 'check_in', time: '08:00' },
                { type: 'check_in', time: '09:00' },
                { type: 'check_out', time: '17:00' },
            ])
        ).toBe('08:00-?; 09:00-17:00');
    });

    it('returns an empty string for no sessions', () => {
        expect(sessionsToText([])).toBe('');
    });
});

describe('buildExportSheet', () => {
    it('builds the daily sheet translated to the requested language', () => {
        const sheet = buildExportSheet('daily', documents, 'en');
        expect(sheet.headers).toEqual([
            'User',
            'Date',
            'Classification',
            'Sessions',
            'Total hours',
            'Overtime hours',
            'Expected hours',
            'Anomalies',
            'Source',
            'Edited',
        ]);
        expect(sheet.rows[0]).toEqual([
            'John',
            '2025-07-01',
            'Workday',
            '(08:00-17:00)',
            9,
            1,
            8,
            'Hours over',
            'Check-in',
            'Yes',
        ]);
    });

    it('builds the detailed sheet with one row per session', () => {
        const sheet = buildExportSheet('detailed', documents, 'en');
        expect(sheet.headers).toContain('Type');
        expect(sheet.headers).toContain('Version');
        expect(sheet.rows[0]).toEqual([
            'John',
            '2025-07-01',
            '17:00',
            'Check-out',
            'Check-in',
            'Yes',
            'late',
            2,
            'Yes',
            'No',
        ]);
    });

    it('builds the overtime sheet with entry/leave pairs and worked time', () => {
        const sheet = buildExportSheet('overtime', documents, 'en');
        expect(sheet.headers).toEqual([
            'User',
            'Date',
            'Entry',
            'Leave',
            'Time worked',
            'Check-in notes',
            'Check-out notes',
        ]);
        expect(sheet.rows[0]).toEqual([
            'John',
            '2025-07-01',
            '18:00',
            '20:00',
            '02:00',
            'start',
            'end',
        ]);
    });

    it('builds the monthly sheet', () => {
        const sheet = buildExportSheet('monthly', documents, 'en');
        expect(sheet.rows[0][0]).toBe('John');
        expect(sheet.rows[0][11]).toBe('No');
    });

    it('builds the history sheet sorted around editedAt', () => {
        const sheet = buildExportSheet('history', documents, 'en');
        expect(sheet.headers).toContain('Edited at');
        expect(sheet.rows[0]).toContain('2025-07-02T09:00:00.000Z');
        expect(sheet.rows[0][3]).toBe('Replaced');
    });

    it('translates headers and content into Catalan', () => {
        const sheet = buildExportSheet('daily', documents, 'ca');
        expect(sheet.headers[0]).toBe('Persona');
        expect(sheet.rows[0][2]).toBe('Laborable');
        expect(sheet.rows[0][7]).toBe('Hores excessives');
    });
});

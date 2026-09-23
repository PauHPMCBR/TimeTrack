import { describe, it, expect } from 'vitest';
import {
    ExportDocumentIdSchema,
    ExportFormatSchema,
    ExportRequestSchema,
    ExportManifestSchema,
    ExportDailyRowSchema,
    ExportDetailedRowSchema,
    ExportOvertimeRowSchema,
    ExportMonthlyRowSchema,
    ExportHistoryRowSchema,
    ExportPayloadSchema,
} from '../../src/schemas/export';

describe('Export Schemas', () => {
    describe('ExportDocumentIdSchema', () => {
        it('should accept every document id', () => {
            for (const id of [
                'daily',
                'detailed',
                'overtime',
                'monthly',
                'history',
            ]) {
                expect(ExportDocumentIdSchema.safeParse(id).success).toBe(true);
            }
        });

        it('should reject an unknown document id', () => {
            expect(ExportDocumentIdSchema.safeParse('pdf').success).toBe(false);
            expect(ExportDocumentIdSchema.safeParse('summary').success).toBe(
                false
            );
        });
    });

    describe('ExportFormatSchema', () => {
        it('should accept the supported formats', () => {
            for (const format of ['csv', 'json', 'xlsx']) {
                expect(ExportFormatSchema.safeParse(format).success).toBe(true);
            }
        });

        it('should reject an unsupported format', () => {
            expect(ExportFormatSchema.safeParse('ods').success).toBe(false);
            expect(ExportFormatSchema.safeParse('pdf').success).toBe(false);
        });
    });

    describe('ExportRequestSchema', () => {
        it('should validate a correct request', () => {
            const result = ExportRequestSchema.safeParse({
                year: 2025,
                month: 7,
                userIds: ['user1'],
                documents: ['daily', 'monthly'],
                format: 'csv',
            });
            expect(result.success).toBe(true);
        });

        it('should allow a self export without userIds', () => {
            const result = ExportRequestSchema.safeParse({
                year: 2025,
                month: 7,
                documents: ['daily'],
                format: 'json',
            });
            expect(result.success).toBe(true);
        });

        it('should require at least one document', () => {
            const result = ExportRequestSchema.safeParse({
                year: 2025,
                month: 7,
                documents: [],
                format: 'csv',
            });
            expect(result.success).toBe(false);
        });

        it('should reject a month outside 1-12', () => {
            const result = ExportRequestSchema.safeParse({
                year: 2025,
                month: 13,
                documents: ['daily'],
                format: 'csv',
            });
            expect(result.success).toBe(false);
        });

        it('should reject an out-of-range year', () => {
            const result = ExportRequestSchema.safeParse({
                year: 1999,
                month: 1,
                documents: ['daily'],
                format: 'csv',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('ExportManifestSchema', () => {
        it('should validate a manifest', () => {
            const result = ExportManifestSchema.safeParse({
                generatedAt: new Date(),
                generatedBy: 'admin1',
                year: 2025,
                month: 7,
                userIds: ['user1'],
                documents: ['daily'],
                rowCounts: { daily: 3 },
                timezone: 'Europe/Madrid',
                integrity: { daily: 'abc123' },
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ExportDailyRowSchema', () => {
        it('should validate a daily row without sessions', () => {
            const result = ExportDailyRowSchema.safeParse({
                userId: 'user1',
                userName: 'John',
                date: '2025-07-01',
                dayClassification: 'workday',
                sessions: [],
                totalHours: 8,
                overtimeHours: 0,
                expectedHours: 8,
                anomalies: [],
                edited: true,
            });
            expect(result.success).toBe(true);
        });

        it('should validate a daily row with a session sequence', () => {
            const result = ExportDailyRowSchema.safeParse({
                userId: 'user1',
                userName: 'John',
                date: '2025-07-01',
                dayClassification: 'workday',
                sessions: [
                    { type: 'check_in', time: '08:00' },
                    {
                        type: 'check_out',
                        time: '17:00',
                        overtime: true,
                    },
                ],
                totalHours: 9,
                overtimeHours: 1.5,
                expectedHours: 8,
                anomalies: [],
                source: 'userClick',
                edited: false,
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ExportDetailedRowSchema', () => {
        it('should validate a detailed session row', () => {
            const result = ExportDetailedRowSchema.safeParse({
                userId: 'user1',
                userName: 'John',
                date: '2025-07-01',
                time: '08:00',
                type: 'check_in',
                source: 'userClick',
                overtime: false,
                version: 1,
                edited: false,
                confirmed: true,
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ExportOvertimeRowSchema', () => {
        it('should validate an overtime interval row', () => {
            const result = ExportOvertimeRowSchema.safeParse({
                userId: 'user1',
                userName: 'John',
                date: '2025-07-01',
                entry: '18:00',
                leave: '20:00',
                worked: '02:00',
                entryNotes: 'start',
                leaveNotes: 'end',
            });
            expect(result.success).toBe(true);
        });

        it('should accept unmatched sides as null', () => {
            const result = ExportOvertimeRowSchema.safeParse({
                userId: 'user1',
                userName: 'John',
                date: '2025-07-01',
                entry: '18:00',
                leave: null,
                worked: '',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ExportMonthlyRowSchema', () => {
        it('should validate a monthly row', () => {
            const result = ExportMonthlyRowSchema.safeParse({
                userId: 'user1',
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
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ExportHistoryRowSchema', () => {
        it('should validate a replaced version row', () => {
            const result = ExportHistoryRowSchema.safeParse({
                userId: 'user1',
                userName: 'John',
                date: '2025-07-01',
                version: 2,
                status: 'replaced',
                source: 'adminManual',
                replacedByVersion: 3,
                editedAt: new Date(),
                sessions: [{ type: 'check_in', time: '08:00' }],
            });
            expect(result.success).toBe(true);
        });
    });

    describe('ExportPayloadSchema', () => {
        it('should validate a payload with all document arrays', () => {
            const result = ExportPayloadSchema.safeParse({
                manifest: {
                    generatedAt: new Date(),
                    generatedBy: 'admin1',
                    year: 2025,
                    month: 7,
                    userIds: ['user1'],
                    documents: ['daily'],
                    rowCounts: { daily: 0 },
                    timezone: 'Europe/Madrid',
                    integrity: { daily: 'abc123' },
                },
                documents: {
                    daily: [],
                    detailed: [],
                    overtime: [],
                    monthly: [],
                    history: [],
                },
            });
            expect(result.success).toBe(true);
        });
    });
});

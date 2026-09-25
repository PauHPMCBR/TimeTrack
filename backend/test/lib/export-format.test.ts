import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { formatExport } from '@/lib/export/format';
import { ExportPayloadSchema } from 'shared/src/schemas/export';
import type { ExportPayload } from 'shared/src/schemas/export';

function payload(
    documents: (
        | 'daily'
        | 'detailed'
        | 'overtime'
        | 'monthly'
        | 'history'
    )[]
): ExportPayload {
    return ExportPayloadSchema.parse({
        manifest: {
            generatedAt: new Date('2025-08-01T10:00:00.000Z'),
            generatedBy: 'admin1',
            generatedByName: 'Admin One',
            year: 2025,
            month: 7,
            userIds: ['u1'],
            documents,
            rowCounts: { daily: 1, monthly: 1, history: 1 },
            timezone: 'Europe/Madrid',
            integrity: { daily: 'a', monthly: 'b', history: 'c' },
            language: 'en',
            logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        },
        documents: {
            daily: [
                {
                    userId: 'u1',
                    userName: 'John',
                    date: '2025-07-01',
                    dayClassification: 'workday',
                    sessions: [
                        { type: 'check_in', time: '08:00', overtime: false },
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
                    anomalies: [],
                    source: 'userClick',
                    edited: false,
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
            detailed: [
                {
                    userId: 'u1',
                    userName: 'John',
                    date: '2025-07-01',
                    time: '17:00',
                    type: 'check_out',
                    source: 'userClick',
                    overtime: true,
                    version: 1,
                    edited: false,
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
                    sessions: [{ type: 'check_in', time: '08:00', overtime: false }],
                },
            ],
        },
    });
}

describe('formatExport', () => {
    describe('json', () => {
        it('serializes the payload directly', async () => {
            const result = await formatExport('json', payload(['daily', 'monthly']));
            expect(result.contentType).toBe('application/json; charset=utf-8');
            expect(result.filename).toMatch(/^export_2025-07_.*\.json$/);
            const parsed = JSON.parse(result.body.toString('utf-8'));
            expect(parsed.manifest.documents).toEqual(['daily', 'monthly']);
            expect(parsed.documents.daily).toHaveLength(1);
        });
    });

    describe('csv', () => {
        it('zips one csv per document plus a manifest', async () => {
            const result = await formatExport('csv', payload(['daily', 'monthly']));
            expect(result.contentType).toBe('application/zip');
            expect(result.filename).toMatch(/^export_2025-07_.*\.zip$/);

            const zip = await JSZip.loadAsync(result.body);
            expect(Object.keys(zip.files).sort()).toEqual([
                'daily.csv',
                'monthly.csv',
            ]);

            const dailyCsv = await zip.file('daily.csv')!.async('string');
            expect(dailyCsv).toContain('User,Date,Classification');
            expect(dailyCsv).toContain('John,2025-07-01,Workday');
            expect(dailyCsv).toContain('(08:00-17:00)');
        });

        it('omits documents that were not selected', async () => {
            const result = await formatExport('csv', payload(['daily']));
            const zip = await JSZip.loadAsync(result.body);
            expect(Object.keys(zip.files).sort()).toEqual(['daily.csv']);
        });
    });

    describe('xlsx', () => {
        it('creates one sheet per document plus a manifest sheet', async () => {
            const result = await formatExport(
                'xlsx',
                payload(['daily', 'monthly', 'history'])
            );
            expect(result.contentType).toBe(
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            expect(result.filename).toMatch(/^export_2025-07_.*\.xlsx$/);

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(result.body as unknown as ArrayBuffer);
            expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
                'Daily summary',
                'Monthly stats',
                'Edit history',
                'Metadata',
            ]);

            const daily = workbook.getWorksheet('Daily summary')!;
            expect(daily.getRow(1).getCell(1).value).toBe('User');
            expect(daily.getRow(2).getCell(1).value).toBe('John');
            expect(daily.getRow(2).getCell(4).value).toBe('(08:00-17:00)');

            const metadata = workbook.getWorksheet('Metadata')!;
            expect(metadata.getRow(3).getCell(2).value).toBe('Admin One');
        });

        it('omits documents that were not selected', async () => {
            const result = await formatExport('xlsx', payload(['monthly']));
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(result.body as unknown as ArrayBuffer);
            expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
                'Monthly stats',
                'Metadata',
            ]);
        });
    });

    describe('pdf', () => {
        it('renders a pdf with a page per selected document', async () => {
            const result = await formatExport(
                'pdf',
                payload(['daily', 'monthly'])
            );
            expect(result.contentType).toBe('application/pdf');
            expect(result.filename).toMatch(/^export_2025-07_.*\.pdf$/);
            expect(result.body.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
            expect(result.body.length).toBeGreaterThan(500);

            const pageCount = (
                result.body.toString('latin1').match(/\/Type \/Page\b/g) ?? []
            ).length;
            expect(pageCount).toBeGreaterThanOrEqual(2);
        });

        it('paginates long documents', async () => {
            const many = payload(['daily']);
            const base = many.documents.daily[0];
            many.documents.daily = Array.from({ length: 150 }, (_, index) => ({
                ...base,
                userName: `User ${index}`,
            }));

            const result = await formatExport('pdf', many);
            expect(result.body.subarray(0, 5).toString('utf-8')).toBe('%PDF-');

            const pageCount = (
                result.body.toString('latin1').match(/\/Type \/Page\b/g) ?? []
            ).length;
            expect(pageCount).toBeGreaterThanOrEqual(3);
        });
    });
});

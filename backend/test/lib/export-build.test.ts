import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/models', () => ({
    User: { find: vi.fn() },
    MonthlyApproval: { find: vi.fn() },
}));

vi.mock('@/repositories/work-day-sessions-repository', () => ({
    findActiveDaySessions: vi.fn(),
    findDayVersionRange: vi.fn(),
}));

vi.mock('@/repositories/vacation-repository', () => ({
    findOverlapping: vi.fn(),
    findGlobalTemplates: vi.fn(),
}));

vi.mock('@/repositories/authorized-leave-repository', () => ({
    findLeavesOverlapping: vi.fn(),
}));

vi.mock('@/repositories/work-day-record-repository', () => ({
    findWorkDayRecords: vi.fn(),
}));

vi.mock('@/lib/settings', () => ({
    DEFAULT_TIMEZONE: 'Europe/Madrid',
    getAppSettings: vi.fn(),
}));

vi.mock('@/lib/work-day-records', () => ({
    lastClosedDayKey: vi.fn().mockResolvedValue('2025-07-31'),
}));

vi.mock('@/lib/work-session-rows', () => ({
    computeDaysForPeriod: vi.fn(),
    buildWorkSessionRows: vi.fn(),
    workDayRecordMap: vi.fn(),
}));

import { User, MonthlyApproval } from '@/models';
import { findActiveDaySessions, findDayVersionRange } from '@/repositories/work-day-sessions-repository';
import { findOverlapping, findGlobalTemplates } from '@/repositories/vacation-repository';
import { findLeavesOverlapping } from '@/repositories/authorized-leave-repository';
import { findWorkDayRecords } from '@/repositories/work-day-record-repository';
import { getAppSettings } from '@/lib/settings';
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
    workDayRecordMap,
} from '@/lib/work-session-rows';
import { buildExportPayload } from '@/lib/export/build';

const chain = (value: unknown) => ({ lean: vi.fn().mockResolvedValue(value) });

const builtRows = [
    {
        userId: 'u1',
        userName: 'Anna',
        date: '2025-07-01',
        totalHours: 8,
        overtimeHours: 0,
        expectedHours: 8,
        sessions: [
            { type: 'check_in', time: '08:00' },
            { type: 'check_out', time: '16:00' },
        ],
        status: 'ok',
        dayClassification: 'workday',
        anomalies: [],
    },
    {
        userId: 'u1',
        userName: 'Anna',
        date: '2025-07-02',
        totalHours: 0,
        overtimeHours: 0,
        expectedHours: 0,
        sessions: [],
        status: 'nonWorkingDay',
        dayClassification: 'nonWorkingWeekday',
        anomalies: [],
    },
    {
        userId: 'u1',
        userName: 'Anna',
        date: '2025-07-03',
        totalHours: 7,
        overtimeHours: 1,
        expectedHours: 8,
        sessions: [
            { type: 'check_in', time: '09:00' },
            { type: 'check_out', time: '16:00' },
        ],
        status: 'anomaly',
        dayClassification: 'workday',
        anomalies: ['hours_short'],
        editedBy: 'admin1',
    },
    {
        userId: 'u2',
        userName: 'Bob',
        date: '2025-07-01',
        totalHours: 0,
        overtimeHours: 0,
        expectedHours: 0,
        sessions: [],
        status: 'electiveVacation',
        dayClassification: 'electiveVacation',
        anomalies: [],
    },
];

const versionDocs = [
    {
        userId: 'u1',
        date: '2025-07-01',
        version: 1,
        status: 'replaced',
        source: 'userClick',
        replacedByVersion: 2,
        replacedAt: new Date('2025-07-02T10:00:00.000Z'),
        sessions: [{ type: 'check_in', time: '08:00' }],
    },
    {
        userId: 'u1',
        date: '2025-07-01',
        version: 2,
        status: 'active',
        source: 'adminManual',
        editedBy: 'admin1',
        editReason: 'fix',
        createdAt: new Date('2025-07-02T11:00:00.000Z'),
        sessions: [
            { type: 'check_in', time: '08:00' },
            { type: 'check_out', time: '16:00' },
        ],
    },
    {
        userId: 'u1',
        date: '2025-07-05',
        version: 1,
        status: 'active',
        source: 'userClick',
        createdAt: new Date('2025-07-05T10:00:00.000Z'),
        sessions: [{ type: 'check_in', time: '08:00' }],
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(computeDaysForPeriod).mockReturnValue([
        '2025-07-01',
        '2025-07-02',
    ] as any);
    vi.mocked(User.find).mockReturnValue(
        chain([
            { _id: 'u1', name: 'Anna' },
            { _id: 'u2', name: 'Bob' },
        ]) as any
    );
    vi.mocked(findActiveDaySessions).mockReturnValue(chain([]) as any);
    vi.mocked(findDayVersionRange).mockReturnValue(
        chain(versionDocs) as any
    );
    vi.mocked(findOverlapping).mockReturnValue(chain([]) as any);
    vi.mocked(findGlobalTemplates).mockReturnValue(chain([]) as any);
    vi.mocked(findLeavesOverlapping).mockReturnValue(chain([]) as any);
    vi.mocked(findWorkDayRecords).mockResolvedValue([] as any);
    vi.mocked(getAppSettings).mockResolvedValue({
        defaultWeeklyExpectedHours: [],
        toleranceMinutes: 60,
        timetableToleranceMinutes: 10,
        timezone: 'Europe/Madrid',
    } as any);
    vi.mocked(workDayRecordMap).mockReturnValue(new Map());
    vi.mocked(buildWorkSessionRows).mockReturnValue(builtRows as any);
    vi.mocked(MonthlyApproval.find).mockReturnValue(
        chain([
            { userId: 'u2', approvedAt: new Date('2025-08-01T00:00:00.000Z') },
        ]) as any
    );
});

describe('buildExportPayload', () => {
    it('assembles daily, monthly and history documents', async () => {
        const payload = await buildExportPayload({
            userIds: ['u1', 'u2'],
            year: 2025,
            month: 7,
            documents: ['daily', 'monthly', 'history'],
            generatedBy: 'admin1',
            generatedByName: 'Admin One',
            language: 'en',
        });

        expect(payload.documents.daily).toHaveLength(3);
        expect(payload.documents.daily[1]).toMatchObject({
            date: '2025-07-03',
            edited: true,
        });

        const anna = payload.documents.monthly.find(
            (row) => row.userId === 'u1'
        );
        expect(anna).toMatchObject({
            daysWithSessions: 2,
            totalHours: 15,
            overtimeHours: 1,
            expectedHours: 16,
            anomalyCount: 1,
            confirmed: false,
        });

        const bob = payload.documents.monthly.find(
            (row) => row.userId === 'u2'
        );
        expect(bob).toMatchObject({
            daysWithSessions: 0,
            electiveVacationDays: 1,
            confirmed: true,
        });

        expect(payload.documents.history).toHaveLength(2);
        expect(payload.documents.history[0]).toMatchObject({
            version: 1,
            status: 'replaced',
            replacedByVersion: 2,
        });
        expect(
            payload.documents.history.some((row) => row.date === '2025-07-05')
        ).toBe(false);

        expect(payload.manifest).toMatchObject({
            year: 2025,
            month: 7,
            userIds: ['u1', 'u2'],
            generatedByName: 'Admin One',
            documents: ['daily', 'monthly', 'history'],
            rowCounts: { daily: 3, monthly: 2, history: 2 },
            timezone: 'Europe/Madrid',
        });
        expect(payload.manifest.integrity.daily).toHaveLength(64);
    });

    it('only builds the selected documents', async () => {
        const payload = await buildExportPayload({
            userIds: ['u1'],
            year: 2025,
            month: 7,
            documents: ['daily'],
            generatedBy: 'admin1',
            language: 'en',
        });

        expect(payload.manifest.documents).toEqual(['daily']);
        expect(payload.documents.daily).toHaveLength(3);
        expect(payload.documents.monthly).toEqual([]);
        expect(payload.documents.history).toEqual([]);
        expect(findDayVersionRange).not.toHaveBeenCalled();
    });

    it('builds detailed and overtime rows from the day sessions', async () => {
        vi.mocked(findActiveDaySessions).mockReturnValue(
            chain([
                {
                    userId: 'u1',
                    date: '2025-07-01',
                    source: 'userClick',
                    version: 1,
                    status: 'active',
                    sessions: [
                        { type: 'check_in', time: '08:00', overtime: false },
                        {
                            type: 'check_out',
                            time: '17:00',
                            overtime: true,
                            notes: 'late',
                        },
                    ],
                },
            ]) as any
        );

        const payload = await buildExportPayload({
            userIds: ['u1'],
            year: 2025,
            month: 7,
            documents: ['detailed', 'overtime'],
            generatedBy: 'admin1',
            language: 'en',
        });

        expect(payload.documents.detailed).toHaveLength(2);
        expect(payload.documents.detailed[1]).toMatchObject({
            time: '17:00',
            type: 'check_out',
            overtime: true,
            notes: 'late',
            version: 1,
            edited: false,
            confirmed: false,
        });
        expect(payload.documents.overtime).toHaveLength(1);
        expect(payload.documents.overtime[0]).toMatchObject({
            entry: '08:00',
            leave: '17:00',
            worked: '09:00',
            leaveNotes: 'late',
        });
        expect(payload.manifest.rowCounts).toMatchObject({
            detailed: 2,
            overtime: 1,
        });
    });
});

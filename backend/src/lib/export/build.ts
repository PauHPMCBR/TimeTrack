import { createHash } from 'node:crypto';
import { MonthlyApproval, User } from '@/models';
import {
    findActiveDaySessions,
    findDayVersionRange,
} from '@/repositories/work-day-sessions-repository';
import {
    findGlobalTemplates,
    findOverlapping,
} from '@/repositories/vacation-repository';
import { findLeavesOverlapping } from '@/repositories/authorized-leave-repository';
import { findWorkDayRecords } from '@/repositories/work-day-record-repository';
import { notDeleted } from '@/repositories/user-repository';
import { getAppSettings, DEFAULT_TIMEZONE } from '@/lib/settings';
import { lastClosedDayKey } from '@/lib/work-day-records';
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
    workDayRecordMap,
} from '@/lib/work-session-rows';
import {
    APPROVAL_APPROVED,
    VACATION_APPROVED,
} from 'shared/src/lib/constants';
import {
    formatHoursMinutes,
    pairSessions,
    pairWorkedMinutes,
} from 'shared/src/lib/work-hours';
import type { AdminWorkSessionRow } from 'shared/src/schemas/api';
import type {
    ExportDailyRow,
    ExportDetailedRow,
    ExportDocumentId,
    ExportDocumentRows,
    ExportHistoryRow,
    ExportManifest,
    ExportMonthlyRow,
    ExportOvertimeRow,
    ExportPayload,
} from 'shared/src/schemas/export';
import type { WorkDayClassification } from 'shared/src/schemas/database';
import type { Language } from 'shared/src/lib/constants';
import type {
    AuthorizedLeaveRow,
    DaySessionsRow,
    ElectiveVacationRow,
    UserRow,
    YearlyVacationRow,
} from '@/lib/rows';

const ABSENCE_CLASSIFICATIONS: WorkDayClassification[] = [
    'electiveVacation',
    'obligatoryVacation',
    'authorizedLeave',
];

export interface BuildExportInput {
    userIds: string[];
    year: number;
    month: number;
    documents: ExportDocumentId[];
    generatedBy: string;
    generatedByName?: string;
    language: Language;
    logo?: string;
    appName?: string;
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

function hashRows(rows: unknown): string {
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function includeDailyRow(row: AdminWorkSessionRow): boolean {
    return (
        row.sessions.length > 0 ||
        row.anomalies.length > 0 ||
        ABSENCE_CLASSIFICATIONS.includes(row.dayClassification)
    );
}

function toDailyRow(row: AdminWorkSessionRow): ExportDailyRow {
    return {
        userId: row.userId,
        userName: row.userName,
        date: row.date,
        dayClassification: row.dayClassification,
        sessions: row.sessions,
        totalHours: row.totalHours,
        overtimeHours: row.overtimeHours,
        expectedHours: row.expectedHours,
        anomalies: row.anomalies,
        ...(row.source ? { source: row.source } : {}),
        edited: Boolean(row.editedBy || row.editReason),
    };
}

function toHistoryRow(
    doc: DaySessionsRow,
    userName: string,
    editorName: string | undefined
): ExportHistoryRow {
    const editedAt = doc.replacedAt ?? doc.updatedAt ?? doc.createdAt;
    return {
        userId: String(doc.userId),
        userName,
        date: doc.date,
        version: doc.version,
        status: doc.status,
        source: doc.source,
        ...(doc.editedBy ? { editedBy: doc.editedBy } : {}),
        ...(editorName ? { editedByName: editorName } : {}),
        ...(doc.editReason ? { editReason: doc.editReason } : {}),
        ...(doc.replacedByVersion !== undefined
            ? { replacedByVersion: doc.replacedByVersion }
            : {}),
        ...(editedAt ? { editedAt } : {}),
        sessions: doc.sessions,
    };
}

function toDetailedRows(
    dayDocs: DaySessionsRow[],
    userMap: Map<string, UserRow>,
    approvals: Map<string, Date | undefined>
): ExportDetailedRow[] {
    const rows: ExportDetailedRow[] = [];
    for (const doc of dayDocs) {
        const userId = String(doc.userId);
        const user = userMap.get(userId);
        if (!user) continue;
        const edited = Boolean(doc.editedBy || doc.editReason);
        const confirmed = approvals.has(userId);
        for (const session of doc.sessions) {
            rows.push({
                userId,
                userName: user.name,
                date: doc.date,
                time: session.time,
                type: session.type,
                source: doc.source,
                overtime: session.overtime ?? false,
                ...(session.notes ? { notes: session.notes } : {}),
                version: doc.version,
                edited,
                confirmed,
            });
        }
    }
    return rows;
}

function toOvertimeRows(
    dayDocs: DaySessionsRow[],
    userMap: Map<string, UserRow>
): ExportOvertimeRow[] {
    const rows: ExportOvertimeRow[] = [];
    for (const doc of dayDocs) {
        const userId = String(doc.userId);
        const user = userMap.get(userId);
        if (!user) continue;
        for (const pair of pairSessions(doc.sessions)) {
            if (!pair.overtime) continue;
            const minutes = pairWorkedMinutes(pair);
            rows.push({
                userId,
                userName: user.name,
                date: doc.date,
                entry: pair.entry?.time ?? null,
                leave: pair.leave?.time ?? null,
                worked: minutes === null ? '' : formatHoursMinutes(minutes),
                ...(pair.entry?.notes ? { entryNotes: pair.entry.notes } : {}),
                ...(pair.leave?.notes ? { leaveNotes: pair.leave.notes } : {}),
            });
        }
    }
    return rows;
}

function buildMonthlyRows(
    users: UserRow[],
    dailyRows: ExportDailyRow[],
    approvals: Map<string, Date | undefined>,
    year: number,
    month: number
): ExportMonthlyRow[] {
    const rowsByUser = new Map<string, ExportDailyRow[]>();
    for (const row of dailyRows) {
        const list = rowsByUser.get(row.userId) ?? [];
        list.push(row);
        rowsByUser.set(row.userId, list);
    }

    return users
        .map((user) => {
            const userId = user._id.toString();
            const rows = rowsByUser.get(userId) ?? [];
            const countClassification = (classification: WorkDayClassification) =>
                rows.filter((row) => row.dayClassification === classification)
                    .length;
            const approvedAt = approvals.get(userId);
            return {
                userId,
                userName: user.name,
                year,
                month,
                daysWithSessions: rows.filter(
                    (row) => row.sessions.length > 0
                ).length,
                totalHours: round2(sum(rows.map((row) => row.totalHours))),
                overtimeHours: round2(
                    sum(rows.map((row) => row.overtimeHours))
                ),
                expectedHours: round2(
                    sum(rows.map((row) => row.expectedHours))
                ),
                electiveVacationDays: countClassification('electiveVacation'),
                obligatoryVacationDays: countClassification(
                    'obligatoryVacation'
                ),
                authorizedLeaveDays: countClassification('authorizedLeave'),
                anomalyCount: rows.filter((row) => row.anomalies.length > 0)
                    .length,
                confirmed: approvals.has(userId),
                ...(approvedAt ? { approvedAt } : {}),
            };
        })
        .sort((a, b) => a.userName.localeCompare(b.userName));
}

export async function buildExportPayload(
    input: BuildExportInput
): Promise<ExportPayload> {
    const { userIds, year, month, generatedBy, generatedByName, language, logo, appName } =
        input;
    const documents = Array.from(new Set(input.documents));

    const days = computeDaysForPeriod('month', undefined, year, month);
    const from = days[0];
    const to = days[days.length - 1];
    const yearSet = Array.from(new Set(days.map((d) => Number(d.slice(0, 4)))));

    const needsRows =
        documents.includes('daily') ||
        documents.includes('monthly') ||
        documents.includes('detailed') ||
        documents.includes('overtime');

    const [
        users,
        activeDocs,
        versionDocs,
        approvedVacations,
        yearlyTemplates,
        settings,
        authorizedLeaves,
        dayRecords,
        approvalDocs,
    ] = await Promise.all([
        User.find(
            { _id: { $in: userIds }, ...notDeleted },
            'name weeklyExpectedHours scheduleMode timetable trackingStartDate'
        ).lean<UserRow[]>(),
        needsRows
            ? findActiveDaySessions(from, to, {
                  userId: { $in: userIds },
              }).lean<DaySessionsRow[]>()
            : Promise.resolve([] as DaySessionsRow[]),
        documents.includes('history')
            ? findDayVersionRange(from, to, {
                  userId: { $in: userIds },
              }).lean<DaySessionsRow[]>()
            : Promise.resolve([] as DaySessionsRow[]),
        findOverlapping(from, to, {
            userId: { $in: userIds },
            statuses: VACATION_APPROVED,
        }).lean<ElectiveVacationRow[]>(),
        findGlobalTemplates(yearSet).lean<YearlyVacationRow[]>(),
        getAppSettings(),
        findLeavesOverlapping(from, to, {
            userId: { $in: userIds },
        }).lean<AuthorizedLeaveRow[]>(),
        findWorkDayRecords(days, { $in: userIds }),
        MonthlyApproval.find({
            userId: { $in: userIds },
            year,
            month,
            status: APPROVAL_APPROVED,
        }).lean<{ userId: string; approvedAt?: Date }[]>(),
    ]);

    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const builtRows = needsRows
        ? buildWorkSessionRows({
              days,
              users,
              daySessions: activeDocs,
              approvedVacations,
              yearlyTemplates,
              authorizedLeaves,
              records: workDayRecordMap(dayRecords),
              defaultWeeklyExpectedHours: settings.defaultWeeklyExpectedHours,
              toleranceMinutes: settings.toleranceMinutes,
              timetableToleranceMinutes: settings.timetableToleranceMinutes,
              closedThrough: await lastClosedDayKey(),
          })
        : [];

    const dailyRows = builtRows.filter(includeDailyRow).map(toDailyRow);
    const approvals = new Map(
        approvalDocs.map((doc) => [String(doc.userId), doc.approvedAt])
    );

    const editorNames = new Map<string, string>();
    if (documents.includes('history')) {
        const editorIds = Array.from(
            new Set(
                versionDocs
                    .map((doc) => doc.editedBy)
                    .filter((value): value is string => Boolean(value))
            )
        );
        if (editorIds.length > 0) {
            const editors = await User.find(
                { _id: { $in: editorIds } },
                'name'
            ).lean<{ _id: string; name: string }[]>();
            for (const editor of editors) {
                editorNames.set(String(editor._id), editor.name);
            }
        }
    }

    const result: ExportDocumentRows = {
        daily: [],
        detailed: [],
        overtime: [],
        monthly: [],
        history: [],
    };
    if (documents.includes('daily')) {
        result.daily = dailyRows;
    }
    if (documents.includes('detailed')) {
        result.detailed = toDetailedRows(activeDocs, userMap, approvals);
    }
    if (documents.includes('overtime')) {
        result.overtime = toOvertimeRows(activeDocs, userMap);
    }
    if (documents.includes('monthly')) {
        result.monthly = buildMonthlyRows(
            users,
            dailyRows,
            approvals,
            year,
            month
        );
    }
    if (documents.includes('history')) {
        // Only days that were actually edited (more than the initial version)
        // belong in the edit history.
        const versionCounts = new Map<string, number>();
        for (const doc of versionDocs) {
            const key = `${doc.userId}:${doc.date}`;
            versionCounts.set(key, (versionCounts.get(key) ?? 0) + 1);
        }
        result.history = versionDocs
            .filter((doc) => {
                const key = `${doc.userId}:${doc.date}`;
                return (
                    userMap.has(String(doc.userId)) &&
                    (versionCounts.get(key) ?? 0) >= 2
                );
            })
            .map((doc) =>
                toHistoryRow(
                    doc,
                    userMap.get(String(doc.userId))!.name,
                    doc.editedBy
                        ? editorNames.get(String(doc.editedBy))
                        : undefined
                )
            )
            .sort(
                (a, b) =>
                    (a.editedAt?.getTime() ?? 0) -
                    (b.editedAt?.getTime() ?? 0)
            );
    }

    const rowCounts: Partial<Record<ExportDocumentId, number>> = {};
    const integrity: Partial<Record<ExportDocumentId, string>> = {};
    for (const document of documents) {
        rowCounts[document] = result[document].length;
        integrity[document] = hashRows(result[document]);
    }

    const manifest: ExportManifest = {
        generatedAt: new Date(),
        generatedBy,
        ...(generatedByName ? { generatedByName } : {}),
        year,
        month,
        userIds: users.map((user) => user._id.toString()),
        documents,
        rowCounts,
        timezone: settings.timezone ?? DEFAULT_TIMEZONE,
        integrity,
        language,
        ...(logo ? { logo } : {}),
        ...(appName ? { appName } : {}),
    };

    return { manifest, documents: result };
}

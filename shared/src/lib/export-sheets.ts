import type {
    ExportDailyRow,
    ExportDetailedRow,
    ExportDocumentId,
    ExportDocumentRows,
    ExportHistoryRow,
    ExportMonthlyRow,
    ExportOvertimeRow,
} from '../schemas/export';
import type { DaySessionRow } from '../schemas/api';
import {
    EXPORT_TERMS,
    localizeEditReason,
    type ExportHeaderKey,
} from './export-i18n';
import type { Language } from './constants';
import { pairSessions } from './work-hours';

export interface ExportSheet {
    headers: string[];
    rows: (string | number)[][];
}

function isoOrEmpty(value: Date | undefined): string {
    return value instanceof Date ? value.toISOString() : '';
}

function headersFor(language: Language, keys: ExportHeaderKey[]): string[] {
    return keys.map((key) => EXPORT_TERMS[language].headers[key]);
}

/** Plain "entry-leave" pair list; overtime pairs are wrapped in parentheses. */
export function sessionsToText(sessions: DaySessionRow[]): string {
    return pairSessions(sessions)
        .map((pair) => {
            const text = `${pair.entry?.time ?? '?'}-${pair.leave?.time ?? '?'}`;
            return pair.overtime ? `(${text})` : text;
        })
        .join('; ');
}

function dailySheet(
    rows: ExportDailyRow[],
    language: Language
): ExportSheet {
    const terms = EXPORT_TERMS[language];
    return {
        headers: headersFor(language, [
            'user',
            'date',
            'classification',
            'sessions',
            'totalHours',
            'overtimeHours',
            'expectedHours',
            'anomalies',
            'source',
            'edited',
        ]),
        rows: rows.map((row) => [
            row.userName,
            row.date,
            terms.classification[row.dayClassification],
            sessionsToText(row.sessions),
            row.totalHours,
            row.overtimeHours,
            row.expectedHours,
            row.anomalies.map((anomaly) => terms.anomaly[anomaly]).join(', '),
            row.source ? terms.source[row.source] : '',
            row.edited ? terms.yes : terms.no,
        ]),
    };
}

function detailedSheet(
    rows: ExportDetailedRow[],
    language: Language
): ExportSheet {
    const terms = EXPORT_TERMS[language];
    return {
        headers: headersFor(language, [
            'user',
            'date',
            'time',
            'type',
            'source',
            'overtime',
            'notes',
            'version',
            'edited',
            'confirmed',
        ]),
        rows: rows.map((row) => [
            row.userName,
            row.date,
            row.time,
            terms.sessionType[row.type],
            terms.source[row.source],
            row.overtime ? terms.yes : terms.no,
            row.notes ?? '',
            row.version,
            row.edited ? terms.yes : terms.no,
            row.confirmed ? terms.yes : terms.no,
        ]),
    };
}

function overtimeSheet(
    rows: ExportOvertimeRow[],
    language: Language
): ExportSheet {
    return {
        headers: headersFor(language, [
            'user',
            'date',
            'entry',
            'leave',
            'worked',
            'checkInNotes',
            'checkOutNotes',
        ]),
        rows: rows.map((row) => [
            row.userName,
            row.date,
            row.entry ?? '?',
            row.leave ?? '?',
            row.worked,
            row.entryNotes ?? '',
            row.leaveNotes ?? '',
        ]),
    };
}

function monthlySheet(
    rows: ExportMonthlyRow[],
    language: Language
): ExportSheet {
    const terms = EXPORT_TERMS[language];
    const confirmedOf = (row: ExportMonthlyRow) =>
        row.confirmed
            ? [terms.yes, isoOrEmpty(row.approvedAt)].filter(Boolean).join(' · ')
            : terms.no;
    return {
        headers: headersFor(language, [
            'user',
            'daysWithSessions',
            'totalHours',
            'overtimeHours',
            'expectedHours',
            'electiveVacationDays',
            'obligatoryVacationDays',
            'authorizedLeaveDays',
            'anomalyCount',
            'confirmed',
        ]),
        rows: rows.map((row) => [
            row.userName,
            row.daysWithSessions,
            row.totalHours,
            row.overtimeHours,
            row.expectedHours,
            row.electiveVacationDays,
            row.obligatoryVacationDays,
            row.authorizedLeaveDays,
            row.anomalyCount,
            confirmedOf(row),
        ]),
    };
}

function historySheet(
    rows: ExportHistoryRow[],
    language: Language
): ExportSheet {
    const terms = EXPORT_TERMS[language];
    return {
        headers: headersFor(language, [
            'user',
            'date',
            'version',
            'versionStatus',
            'source',
            'editedBy',
            'editReason',
            'replacedByVersion',
            'editedAt',
            'sessions',
        ]),
        rows: rows.map((row) => [
            row.userName,
            row.date,
            row.version,
            terms.versionStatus[row.status],
            terms.source[row.source],
            row.editedByName ?? row.editedBy ?? '',
            localizeEditReason(row.editReason, language),
            row.replacedByVersion ?? '',
            isoOrEmpty(row.editedAt),
            sessionsToText(row.sessions),
        ]),
    };
}

export function buildExportSheet(
    document: ExportDocumentId,
    documents: ExportDocumentRows,
    language: Language
): ExportSheet {
    if (document === 'daily') return dailySheet(documents.daily, language);
    if (document === 'detailed') {
        return detailedSheet(documents.detailed, language);
    }
    if (document === 'overtime') {
        return overtimeSheet(documents.overtime, language);
    }
    if (document === 'monthly') {
        return monthlySheet(documents.monthly, language);
    }
    return historySheet(documents.history, language);
}

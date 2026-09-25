import { Fragment, type ReactNode } from 'react';
import { View, Text } from '@react-pdf/renderer';
import { EXPORT_TERMS, localizeEditReason } from 'shared/src/lib/export-i18n';
import type {
    ExportDailyRow,
    ExportDetailedRow,
    ExportDocumentId,
    ExportHistoryRow,
    ExportMonthlyRow,
    ExportOvertimeRow,
    ExportPayload,
} from 'shared/src/schemas/export';
import type { Language } from 'shared/src/lib/constants';
import {
    Badge,
    CheckIcon,
    EditIcon,
    SectionTitle,
    SessionChips,
    StatusIcon,
    Table,
    type Column,
} from './components';
import {
    classificationStatus,
    colors,
    statusRowColors,
    styles,
    type DayStatus,
} from './theme';

const LOCALES: Record<Language, string> = {
    ca: 'ca-ES',
    es: 'es-ES',
    en: 'en-US',
};

function formatDayKey(key: string, language: Language): string {
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = new Intl.DateTimeFormat(LOCALES[language], {
        weekday: 'short',
        timeZone: 'UTC',
    })
        .format(date)
        .replace('.', '');
    return `${weekday} ${day}`;
}

/** Minimum-but-growing weight for a name column: hugs short names, grows for long ones. */
function nameFlex(names: string[]): number {
    const longest = names.reduce((max, name) => Math.max(max, name.length), 0);
    return Math.min(2.2, Math.max(1, longest / 9));
}

function formatHM(hours: number): string {
    let h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);
    if (m === 60) {
        h += 1;
        m = 0;
    }
    return `${h}h ${m}m`;
}

function formatWorked(worked: string): string {
    const match = /^(\d{1,2}):(\d{2})$/.exec(worked);
    if (!match) return worked;
    return formatHM(Number(match[1]) + Number(match[2]) / 60);
}

function yesNo(value: boolean, language: Language, truthColor = colors.ok) {
    const terms = EXPORT_TERMS[language];
    return value ? (
        <Badge text={terms.yes} color={truthColor} />
    ) : (
        <Text style={styles.tableCellText}>{terms.no}</Text>
    );
}

function dateTimeText(value: Date | undefined): string {
    if (!(value instanceof Date)) return '';
    return value.toISOString().slice(0, 16).replace('T', ' ');
}

function dailyStatus(row: ExportDailyRow): DayStatus {
    return row.anomalies.length > 0
        ? 'anomaly'
        : classificationStatus[row.dayClassification];
}

function EventCell({
    flex,
    align = 'left',
    tight = false,
    children,
}: {
    flex: number;
    align?: 'left' | 'right';
    tight?: boolean;
    children: ReactNode;
}) {
    return (
        <View
            style={[
                styles.eventCell,
                tight ? styles.eventCellTight : {},
                {
                    flex,
                    alignItems: align === 'right' ? 'flex-end' : 'flex-start',
                },
            ]}
        >
            {children}
        </View>
    );
}

/** Compact per-day table mirroring the admin/events list (FitxatgesTable). */
export function DailySection({
    rows,
    language,
    showEmployee,
}: {
    rows: ExportDailyRow[];
    language: Language;
    showEmployee: boolean;
}) {
    const terms = EXPORT_TERMS[language];
    const header = (label: string) => label.toUpperCase();
    const employeeFlex = nameFlex(rows.map((row) => row.userName));

    if (rows.length === 0) {
        return <Text style={styles.empty}>{terms.noData}</Text>;
    }

    return (
        <View style={styles.table}>
            <View style={styles.tableHeader} wrap={false}>
                <EventCell flex={0.14} tight>
                    <Text style={styles.tableHeaderText}> </Text>
                </EventCell>
                <EventCell flex={0.385} tight>
                    <Text style={styles.tableHeaderText}>
                        {header(terms.headers.date)}
                    </Text>
                </EventCell>
                {showEmployee && (
                    <EventCell flex={employeeFlex}>
                        <Text style={styles.tableHeaderText}>
                            {header(terms.headers.user)}
                        </Text>
                    </EventCell>
                )}
                <EventCell flex={0.65} align="right">
                    <Text style={styles.tableHeaderText}>
                        {header(terms.headers.expectedHours)}
                    </Text>
                </EventCell>
                <EventCell flex={0.6} align="right">
                    <Text style={styles.tableHeaderText}>
                        {header(terms.headers.totalHours)}
                    </Text>
                </EventCell>
                <EventCell flex={0.7} align="right">
                    <Text style={styles.tableHeaderText}>
                        {header(terms.headers.difference)}
                    </Text>
                </EventCell>
                <EventCell flex={2.0}>
                    <Text style={styles.tableHeaderText}>
                        {header(terms.headers.sessions)}
                    </Text>
                </EventCell>
                <EventCell flex={1.235}>
                    <Text style={styles.tableHeaderText}>
                        {header(terms.headers.source)}
                    </Text>
                </EventCell>
            </View>

            {rows.map((row, index) => {
                const status = dailyStatus(row);
                const tint = statusRowColors[status];
                const newDay = index > 0 && rows[index - 1].date !== row.date;
                const difference =
                    Math.round((row.totalHours - row.expectedHours) * 100) / 100;
                const differenceColor =
                    difference > 0
                        ? colors.ok
                        : difference < 0
                          ? colors.anomaly
                          : colors.textMuted;
                const differenceText = `${difference > 0 ? '+' : difference < 0 ? '-' : ''}${formatHM(Math.abs(difference))}`;
                return (
                    <Fragment key={`${row.date}:${row.userId}`}>
                        {newDay && <View style={styles.daySeparator} />}
                        <View
                            wrap={false}
                            style={[
                                styles.eventRow,
                                {
                                    backgroundColor: tint.bg,
                                    borderLeftColor: tint.border,
                                },
                            ]}
                        >
                            <EventCell flex={0.14} tight>
                                <StatusIcon status={status} />
                            </EventCell>
                            <EventCell flex={0.385} tight>
                                <Text style={styles.dateText}>
                                    {formatDayKey(row.date, language)}
                                </Text>
                            </EventCell>
                            {showEmployee && (
                                <EventCell flex={employeeFlex}>
                                    <Text style={styles.employeeText}>
                                        {row.userName}
                                    </Text>
                                </EventCell>
                            )}
                            <EventCell flex={0.65} align="right">
                                <Text style={styles.mutedText}>
                                    {formatHM(row.expectedHours)}
                                </Text>
                            </EventCell>
                            <EventCell flex={0.6} align="right">
                                <Text style={styles.hoursText}>
                                    {row.totalHours > 0
                                        ? formatHM(row.totalHours)
                                        : '-'}
                                </Text>
                            </EventCell>
                            <EventCell flex={0.7} align="right">
                                <Text
                                    style={[
                                        styles.hoursText,
                                        { color: differenceColor },
                                    ]}
                                >
                                    {differenceText}
                                </Text>
                            </EventCell>
                            <EventCell flex={2.0}>
                                {row.sessions.length > 0 ? (
                                    <SessionChips sessions={row.sessions} />
                                ) : (
                                    <Text style={styles.mutedText}>-</Text>
                                )}
                            </EventCell>
                            <EventCell flex={1.235}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        width: '100%',
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.mutedText,
                                            { flex: 1 },
                                        ]}
                                    >
                                        {row.source
                                            ? terms.source[row.source]
                                            : '-'}
                                    </Text>
                                    {row.edited && <EditIcon />}
                                </View>
                            </EventCell>
                        </View>
                    </Fragment>
                );
            })}
        </View>
    );
}

export function DetailedSection({
    rows,
    language,
}: {
    rows: ExportDetailedRow[];
    language: Language;
}) {
    const terms = EXPORT_TERMS[language];
    const columns: Column[] = [
        { label: terms.headers.user, flex: nameFlex(rows.map((row) => row.userName)) },
        { label: terms.headers.date, flex: 0.8 },
        { label: terms.headers.time, flex: 0.5 },
        { label: terms.headers.type, flex: 0.7 },
        { label: terms.headers.source, flex: 0.9 },
        { label: terms.headers.overtime, flex: 0.6 },
        { label: terms.headers.notes, flex: 1.7 },
        { label: terms.headers.version, flex: 0.5, align: 'right' },
        { label: terms.headers.edited, flex: 0.6 },
        { label: terms.headers.confirmed, flex: 0.7 },
    ];
    return (
        <Table
            columns={columns}
            emptyLabel={terms.noData}
            rows={rows.map((row) => [
                row.userName,
                formatDayKey(row.date, language),
                row.time,
                terms.sessionType[row.type],
                terms.source[row.source],
                yesNo(row.overtime, language, colors.overtime),
                row.notes ?? '',
                row.version,
                yesNo(row.edited, language, colors.edit),
                yesNo(row.confirmed, language, colors.ok),
            ])}
        />
    );
}

export function OvertimeSection({
    rows,
    language,
}: {
    rows: ExportOvertimeRow[];
    language: Language;
}) {
    const terms = EXPORT_TERMS[language];
    const columns: Column[] = [
        { label: terms.headers.user, flex: nameFlex(rows.map((row) => row.userName)) },
        { label: terms.headers.date, flex: 0.8 },
        { label: terms.headers.entry, flex: 0.6 },
        { label: terms.headers.leave, flex: 0.6 },
        { label: terms.headers.worked, flex: 0.7 },
        { label: terms.headers.checkInNotes, flex: 1.5 },
        { label: terms.headers.checkOutNotes, flex: 1.5 },
    ];
    return (
        <Table
            columns={columns}
            emptyLabel={terms.noData}
            rows={rows.map((row) => [
                row.userName,
                formatDayKey(row.date, language),
                row.entry ?? '?',
                row.leave ?? '?',
                formatWorked(row.worked),
                row.entryNotes ?? '',
                row.leaveNotes ?? '',
            ])}
        />
    );
}

export function MonthlySection({
    rows,
    language,
}: {
    rows: ExportMonthlyRow[];
    language: Language;
}) {
    const terms = EXPORT_TERMS[language];
    const nameColumn: Column = {
        label: terms.headers.user,
        flex: nameFlex(rows.map((row) => row.userName)),
    };
    const hoursColumns: Column[] = [
        nameColumn,
        { label: terms.headers.daysWithSessions, flex: 0.7, align: 'right' },
        { label: terms.headers.totalHours, flex: 0.8, align: 'right' },
        { label: terms.headers.overtimeHours, flex: 0.8, align: 'right' },
        { label: terms.headers.expectedHours, flex: 0.8, align: 'right' },
        { label: terms.headers.anomalyCount, flex: 0.6, align: 'right' },
        { label: terms.headers.confirmed, flex: 1.1 },
    ];
    const vacationColumns: Column[] = [
        nameColumn,
        { label: terms.headers.electiveVacationDays, flex: 1, align: 'right' },
        {
            label: terms.headers.obligatoryVacationDays,
            flex: 1,
            align: 'right',
        },
        { label: terms.headers.authorizedLeaveDays, flex: 1, align: 'right' },
    ];
    const sum = (selector: (row: ExportMonthlyRow) => number) =>
        rows.reduce((total, row) => total + selector(row), 0);

    const confirmation = (row: ExportMonthlyRow) =>
        row.confirmed ? (
            <View style={styles.confirmRow}>
                <CheckIcon />
                <Text style={styles.mutedText}>
                    {dateTimeText(row.approvedAt).slice(0, 10)}
                </Text>
            </View>
        ) : (
            <Text style={styles.tableCellText}>-</Text>
        );

    return (
        <View>
            <Text style={styles.tableCaption}>{terms.workedHours}</Text>
            <Table
                columns={hoursColumns}
                emptyLabel={terms.noData}
                rows={rows.map((row) => [
                    row.userName,
                    row.daysWithSessions,
                    formatHM(row.totalHours),
                    formatHM(row.overtimeHours),
                    formatHM(row.expectedHours),
                    row.anomalyCount,
                    confirmation(row),
                ])}
                totals={[
                    '',
                    sum((row) => row.daysWithSessions),
                    formatHM(sum((row) => row.totalHours)),
                    formatHM(sum((row) => row.overtimeHours)),
                    formatHM(sum((row) => row.expectedHours)),
                    sum((row) => row.anomalyCount),
                    '',
                ]}
            />

            <Text style={styles.tableCaptionSpaced}>{terms.vacations}</Text>
            <Table
                columns={vacationColumns}
                emptyLabel={terms.noData}
                rows={rows.map((row) => [
                    row.userName,
                    row.electiveVacationDays,
                    row.obligatoryVacationDays,
                    row.authorizedLeaveDays,
                ])}
                totals={[
                    '',
                    sum((row) => row.electiveVacationDays),
                    sum((row) => row.obligatoryVacationDays),
                    sum((row) => row.authorizedLeaveDays),
                ]}
            />
        </View>
    );
}

export function HistorySection({
    rows,
    language,
}: {
    rows: ExportHistoryRow[];
    language: Language;
}) {
    const terms = EXPORT_TERMS[language];
    const columns: Column[] = [
        { label: terms.headers.user, flex: nameFlex(rows.map((row) => row.userName)) },
        { label: terms.headers.date, flex: 0.8 },
        { label: terms.headers.version, flex: 0.5, align: 'right' },
        { label: terms.headers.versionStatus, flex: 0.7 },
        { label: terms.headers.source, flex: 0.9 },
        { label: terms.headers.editedBy, flex: 1.0 },
        { label: terms.headers.editReason, flex: 1.3 },
        { label: terms.headers.replacedByVersion, flex: 0.7, align: 'right' },
        { label: terms.headers.editedAt, flex: 1.1 },
        { label: terms.headers.sessions, flex: 2.2 },
    ];
    return (
        <Table
            columns={columns}
            emptyLabel={terms.noData}
            rows={rows.map((row) => [
                row.userName,
                formatDayKey(row.date, language),
                row.version,
                <Badge
                    key="status"
                    text={terms.versionStatus[row.status]}
                    color={
                        row.status === 'active' ? colors.ok : colors.nonWorking
                    }
                />,
                terms.source[row.source],
                row.editedByName ?? row.editedBy ?? '',
                localizeEditReason(row.editReason, language),
                row.replacedByVersion ?? '',
                dateTimeText(row.editedAt),
                <SessionChips key="sessions" sessions={row.sessions} />,
            ])}
        />
    );
}

export function Section({
    document,
    payload,
}: {
    document: ExportDocumentId;
    payload: ExportPayload;
}) {
    const language = payload.manifest.language;
    const showEmployee = payload.manifest.userIds.length > 1;

    return (
        <View style={styles.section}>
            <SectionTitle>
                {EXPORT_TERMS[language].documents[document]}
            </SectionTitle>
            {document === 'daily' && (
                <DailySection
                    rows={payload.documents.daily}
                    language={language}
                    showEmployee={showEmployee}
                />
            )}
            {document === 'detailed' && (
                <DetailedSection
                    rows={payload.documents.detailed}
                    language={language}
                />
            )}
            {document === 'overtime' && (
                <OvertimeSection
                    rows={payload.documents.overtime}
                    language={language}
                />
            )}
            {document === 'monthly' && (
                <MonthlySection
                    rows={payload.documents.monthly}
                    language={language}
                />
            )}
            {document === 'history' && (
                <HistorySection
                    rows={payload.documents.history}
                    language={language}
                />
            )}
        </View>
    );
}

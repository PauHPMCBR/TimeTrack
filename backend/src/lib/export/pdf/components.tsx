import { View, Text, Svg, Path, Image } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { pairSessions } from 'shared/src/lib/work-hours';
import { EXPORT_TERMS } from 'shared/src/lib/export-i18n';
import type { DaySessionRow } from 'shared/src/schemas/api';
import type { Language } from 'shared/src/lib/constants';
import { colors, statusRowColors, styles, type DayStatus } from './theme';

export interface Column {
    label: string;
    flex: number;
    align?: 'left' | 'right' | 'center';
}

function renderCell(
    cell: ReactNode,
    column: Column | undefined,
    variant: 'body' | 'totals'
): ReactNode {
    if (typeof cell === 'string' || typeof cell === 'number') {
        const align = { textAlign: column?.align ?? 'left' } as const;
        return (
            <Text
                style={
                    variant === 'totals'
                        ? [styles.totalsCellText, align]
                        : [styles.tableCellText, align]
                }
            >
                {String(cell)}
            </Text>
        );
    }
    return cell;
}

export function Table({
    columns,
    rows,
    totals,
    emptyLabel,
}: {
    columns: Column[];
    rows: ReactNode[][];
    totals?: ReactNode[];
    emptyLabel: string;
}) {
    if (rows.length === 0) {
        return <Text style={styles.empty}>{emptyLabel}</Text>;
    }
    return (
        <View style={styles.table}>
            <View style={styles.tableHeader} wrap={false}>
                {columns.map((column, index) => (
                    <View
                        key={index}
                        style={[styles.tableHeaderCell, { flex: column.flex }]}
                    >
                        <Text
                            style={[
                                styles.tableHeaderText,
                                { textAlign: column.align ?? 'left' },
                            ]}
                        >
                            {column.label.toUpperCase()}
                        </Text>
                    </View>
                ))}
            </View>
            {rows.map((row, rowIndex) => (
                <View
                    key={rowIndex}
                    wrap={false}
                    style={
                        rowIndex % 2 === 1
                            ? [styles.tableRow, styles.tableRowAlt]
                            : styles.tableRow
                    }
                >
                    {row.map((cell, cellIndex) => (
                        <View
                            key={cellIndex}
                            style={[
                                styles.tableCell,
                                { flex: columns[cellIndex]?.flex ?? 1 },
                            ]}
                        >
                            {renderCell(
                                cell,
                                columns[cellIndex],
                                'body'
                            )}
                        </View>
                    ))}
                </View>
            ))}
            {totals && (
                <View style={[styles.tableRow, styles.totalsRow]} wrap={false}>
                    {totals.map((cell, cellIndex) => (
                        <View
                            key={cellIndex}
                            style={[
                                styles.tableCell,
                                { flex: columns[cellIndex]?.flex ?? 1 },
                            ]}
                        >
                            {renderCell(
                                cell,
                                columns[cellIndex],
                                'totals'
                            )}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

export function Badge({
    text,
    color,
    textColor = '#FFFFFF',
}: {
    text: string;
    color: string;
    textColor?: string;
}) {
    return (
        <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: color }]}>
                <Text style={[styles.badgeText, { color: textColor }]}>
                    {text}
                </Text>
            </View>
        </View>
    );
}

export function StatusDot({ color }: { color: string }) {
    return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export function SessionChips({ sessions }: { sessions: DaySessionRow[] }) {
    const intervals = pairSessions(sessions);
    if (intervals.length === 0) return null;
    return (
        <View style={styles.chipRow}>
            {intervals.map((pair, index) => {
                const unclosed = !pair.entry || !pair.leave;
                const color = unclosed
                    ? colors.anomaly
                    : pair.overtime
                      ? colors.overtime
                      : colors.ok;
                const text = `${pair.entry?.time ?? '?'}-${pair.leave?.time ?? '?'}`;
                return (
                    <Text
                        key={index}
                        style={[styles.chip, { backgroundColor: color }]}
                    >
                        {text}
                    </Text>
                );
            })}
        </View>
    );
}

export function PageChrome({
    title,
    monthYear,
    generated,
    logo,
}: {
    title: string;
    monthYear: string;
    generated: string;
    logo?: string | null;
}) {
    return (
        <View style={styles.header} fixed>
            <View style={styles.headerLeft}>
                {logo ? <Image src={logo} style={styles.logo} /> : null}
                <Text style={styles.brand}>{title}</Text>
            </View>
            <View style={styles.headerRight}>
                <Text style={styles.monthYear}>{monthYear}</Text>
                <Text style={styles.headerMeta}>{generated}</Text>
            </View>
        </View>
    );
}

export function Footer() {
    return (
        <Text
            style={styles.footer}
            fixed
            render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
            }
        />
    );
}

export function SectionTitle({ children }: { children: string }) {
    return (
        <View style={styles.sectionTitleRow} wrap={false}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>{children}</Text>
        </View>
    );
}

export function CheckIcon() {
    return (
        <View style={styles.check}>
            <Svg width={7} height={7} viewBox="0 0 24 24">
                <Path
                    d="M20 6 9 17l-5-5"
                    stroke="#FFFFFF"
                    strokeWidth={4}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
        </View>
    );
}

export function EditIcon() {
    return (
        <Svg width={8} height={8} viewBox="0 0 24 24">
            <Path
                d="M12 20h9"
                stroke={colors.edit}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                stroke={colors.edit}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

const LEGEND_STATUSES: DayStatus[] = [
    'ok',
    'anomaly',
    'electiveVacation',
    'obligatoryVacation',
    'authorizedLeave',
];

export function Legend({ language }: { language: Language }) {
    const terms = EXPORT_TERMS[language];
    const sessionItems = [
        { color: colors.ok, label: terms.headers.worked },
        { color: colors.overtime, label: terms.headers.overtime },
        { color: colors.anomaly, label: terms.problem },
    ];
    return (
        <View style={styles.legend}>
            {LEGEND_STATUSES.map((status) => (
                <View key={status} style={styles.legendItem}>
                    <View
                        style={[
                            styles.legendChip,
                            {
                                borderRadius: 4,
                                backgroundColor: statusRowColors[status].border,
                            },
                        ]}
                    />
                    <Text style={styles.legendText}>
                        {terms.status[status]}
                    </Text>
                </View>
            ))}
            {sessionItems.map((item) => (
                <View key={item.label} style={styles.legendItem}>
                    <View
                        style={[
                            styles.legendChip,
                            { backgroundColor: item.color },
                        ]}
                    />
                    <Text style={styles.legendText}>{item.label}</Text>
                </View>
            ))}
            <View style={styles.legendItem}>
                <EditIcon />
                <Text style={styles.legendText}>{terms.headers.edited}</Text>
            </View>
        </View>
    );
}

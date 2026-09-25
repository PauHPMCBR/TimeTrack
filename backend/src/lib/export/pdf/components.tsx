import { View, Text, Svg, Path, Circle, Image } from '@react-pdf/renderer';
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

const ICON_STROKE = {
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
} as const;

/** Day-type glyphs mirroring `statusIconOf` in the frontend (lucide paths). */
function statusIconGlyph(status: DayStatus, stroke: string): ReactNode {
    switch (status) {
        case 'ok':
            return (
                <>
                    <Circle cx={12} cy={12} r={10} stroke={stroke} {...ICON_STROKE} />
                    <Path d="m9 12 2 2 4-4" stroke={stroke} {...ICON_STROKE} />
                </>
            );
        case 'anomaly':
            return (
                <>
                    <Path
                        d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                    <Path d="M12 9v4" stroke={stroke} {...ICON_STROKE} />
                    <Path d="M12 17h.01" stroke={stroke} {...ICON_STROKE} />
                </>
            );
        case 'electiveVacation':
            return (
                <>
                    <Path
                        d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                    <Path
                        d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                    <Path
                        d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                    <Path
                        d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                </>
            );
        case 'obligatoryVacation':
            return (
                <>
                    <Path d="M5.8 11.3 2 22l10.7-3.79" stroke={stroke} {...ICON_STROKE} />
                    <Path d="M4 3h.01" stroke={stroke} {...ICON_STROKE} />
                    <Path d="M22 8h.01" stroke={stroke} {...ICON_STROKE} />
                    <Path d="M15 2h.01" stroke={stroke} {...ICON_STROKE} />
                    <Path d="M22 20h.01" stroke={stroke} {...ICON_STROKE} />
                    <Path
                        d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                    <Path
                        d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                    <Path
                        d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                    <Path
                        d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                </>
            );
        case 'authorizedLeave':
            return (
                <>
                    <Path
                        d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
                        stroke={stroke}
                        {...ICON_STROKE}
                    />
                    <Path d="m9 12 2 2 4-4" stroke={stroke} {...ICON_STROKE} />
                </>
            );
        case 'planned':
            return (
                <>
                    <Path d="M12 6v6l4 2" stroke={stroke} {...ICON_STROKE} />
                    <Circle cx={12} cy={12} r={10} stroke={stroke} {...ICON_STROKE} />
                </>
            );
        case 'nonWorkingDay':
            return (
                <>
                    <Path d="M4.929 4.929 19.07 19.071" stroke={stroke} {...ICON_STROKE} />
                    <Circle cx={12} cy={12} r={10} stroke={stroke} {...ICON_STROKE} />
                </>
            );
    }
}

export function StatusIcon({
    status,
    size = 9,
}: {
    status: DayStatus;
    size?: number;
}) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            {statusIconGlyph(status, statusRowColors[status].border)}
        </Svg>
    );
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
    logoWidth,
    logoHeight,
}: {
    title: string;
    monthYear: string;
    generated: string;
    logo?: string | null;
    logoWidth?: number;
    logoHeight?: number;
}) {
    return (
        <View style={styles.header} fixed>
            <View style={styles.headerLeft}>
                {logo ? (
                    <Image
                        src={logo}
                        style={[
                            styles.logo,
                            {
                                width: logoWidth,
                                height: logoHeight,
                            },
                        ]}
                    />
                ) : null}
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
                    <StatusIcon status={status} />
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

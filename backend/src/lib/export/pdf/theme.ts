import { StyleSheet } from '@react-pdf/renderer';
import type { WorkDayClassification } from 'shared/src/schemas/database';

export const colors = {
    primary: '#4F46E5',
    primaryDark: '#3730A3',
    primarySoft: '#EEF2FF',
    text: '#18181B',
    textMuted: '#71717A',
    border: '#E4E4E7',
    surface: '#FFFFFF',
    surfaceMuted: '#FAFAFA',
    surfaceSubtle: '#F4F4F5',
    ok: '#22C55E',
    anomaly: '#EF4444',
    nonWorking: '#A1A1AA',
    electiveVacation: '#3B82F6',
    obligatoryVacation: '#0EA5E9',
    authorizedLeave: '#14B8A6',
    planned: '#D4D4D8',
    overtime: '#A855F7',
    edit: '#F59E0B',
};

/** Work-session row status, as used by the admin/events list. */
export type DayStatus =
    | 'ok'
    | 'anomaly'
    | 'nonWorkingDay'
    | 'planned'
    | 'electiveVacation'
    | 'obligatoryVacation'
    | 'authorizedLeave';

/** Left border + tinted background, mirroring TONE_CLASSES[row]. */
export const statusRowColors: Record<DayStatus, { bg: string; border: string }> =
    {
        ok: { bg: '#DCFCE7', border: '#22C55E' },
        anomaly: { bg: '#FEE2E2', border: '#EF4444' },
        nonWorkingDay: { bg: '#F4F4F5', border: '#D4D4D8' },
        planned: { bg: '#F4F4F5', border: '#D4D4D8' },
        electiveVacation: { bg: '#DBEAFE', border: '#3B82F6' },
        obligatoryVacation: { bg: '#E0F2FE', border: '#0EA5E9' },
        authorizedLeave: { bg: '#CCFBF1', border: '#14B8A6' },
    };

export const classificationStatus: Record<WorkDayClassification, DayStatus> = {
    workday: 'ok',
    nonWorkingWeekday: 'nonWorkingDay',
    electiveVacation: 'electiveVacation',
    obligatoryVacation: 'obligatoryVacation',
    authorizedLeave: 'authorizedLeave',
};

export const styles = StyleSheet.create({
    page: {
        paddingTop: 76,
        paddingBottom: 42,
        paddingHorizontal: 32,
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: colors.text,
        backgroundColor: colors.surface,
    },
    header: {
        position: 'absolute',
        top: 22,
        left: 32,
        right: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 6,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    logo: {
        marginRight: 6,
        objectFit: 'contain',
    },
    brand: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        color: colors.primary,
    },
    monthYear: {
        fontSize: 13,
        fontFamily: 'Helvetica-Bold',
        color: colors.text,
    },
    headerMeta: {
        fontSize: 8,
        color: colors.textMuted,
        textAlign: 'right',
    },
    footer: {
        position: 'absolute',
        bottom: 16,
        left: 32,
        right: 32,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 3,
        fontSize: 7.5,
        color: colors.textMuted,
        textAlign: 'center',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    section: {
        marginBottom: 12,
    },
    sectionAccent: {
        width: 4,
        height: 15,
        borderRadius: 2,
        backgroundColor: colors.primary,
        marginRight: 6,
    },
    sectionTitle: {
        fontSize: 13,
        fontFamily: 'Helvetica-Bold',
        color: colors.text,
    },
    table: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceSubtle,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tableHeaderCell: {
        paddingVertical: 4,
        paddingHorizontal: 5,
    },
    tableHeaderText: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: colors.textMuted,
        letterSpacing: 0.4,
    },
    tableCaption: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: colors.textMuted,
        marginBottom: 4,
    },
    tableCaptionSpaced: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: colors.textMuted,
        marginBottom: 4,
        marginTop: 10,
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderLeftWidth: 3,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    eventCell: {
        paddingVertical: 3,
        paddingHorizontal: 5,
    },
    eventCellTight: {
        paddingLeft: 0,
    },
    dateText: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: colors.text,
    },
    employeeText: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: colors.text,
    },
    mutedText: {
        fontSize: 8.5,
        color: colors.textMuted,
    },
    hoursText: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: colors.text,
        textAlign: 'right',
    },
    daySeparator: {
        height: 4,
        backgroundColor: colors.surfaceSubtle,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tableRowAlt: {
        backgroundColor: colors.surfaceMuted,
    },
    tableCell: {
        paddingVertical: 3.5,
        paddingHorizontal: 5,
    },
    tableCellText: {
        fontSize: 8.5,
        color: colors.text,
    },
    totalsRow: {
        flexDirection: 'row',
        backgroundColor: colors.primarySoft,
    },
    totalsCellText: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: colors.primaryDark,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    chip: {
        borderRadius: 3,
        paddingHorizontal: 3.5,
        paddingVertical: 1,
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: '#FFFFFF',
        marginRight: 2,
        marginBottom: 1,
    },
    badgeRow: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
    },
    badge: {
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    badgeText: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
    },
    empty: {
        fontSize: 10,
        color: colors.textMuted,
        fontStyle: 'italic',
        paddingVertical: 8,
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
        marginBottom: 3,
    },
    legendText: {
        fontSize: 7.5,
        color: colors.textMuted,
        marginLeft: 3,
    },
    legendChip: {
        width: 8,
        height: 8,
        borderRadius: 2,
    },
    check: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.ok,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 3,
    },
    confirmRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

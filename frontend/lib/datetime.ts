import { MS_PER_HOUR, MS_PER_MINUTE } from 'shared/src/lib/constants';
import {
    addDaysToKey,
    dowFromDateKey,
    type DateKey,
} from 'shared/src/lib/day-key';

export function formatDateKey(
    key: string,
    locale: string,
    options?: Intl.DateTimeFormatOptions
): string {
    const [y, m, d] = key.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function toLocalDateKey(date: Date | string): DateKey {
    const d = typeof date === 'string' ? new Date(date) : date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` as DateKey;
}

export function formatHM(ms: number, t?: (k: string) => string): string {
    const h = Math.floor(ms / MS_PER_HOUR);
    const m = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
    const labelH = t ? t('time.h') : 'h';
    const labelM = t ? t('time.m') : 'm';
    return `${h}${labelH} ${m}${labelM}`;
}

export function localeTag(lang: string): string {
    switch (lang) {
        case 'es':
            return 'es-ES';
        case 'en':
            return 'en-US';
        default:
            return 'ca-ES';
    }
}

/** Short weekday labels in Mon..Sun order for a BCP-47 locale. */
export function weekDayShortLabels(locale: string): string[] {
    const base = new Date(2024, 0, 1); // 2024-01-01 is a Monday
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
    });
}

export function formatPeriodLabel(
    cursor: DateKey,
    period: 'day' | 'week' | 'month' | 'year',
    locale: string
): string {
    if (period === 'month') {
        const [y, m] = cursor.split('-').map(Number);
        const label = new Intl.DateTimeFormat(locale, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(Date.UTC(y, m - 1, 1)));
        return label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (period === 'year') return cursor.slice(0, 4);
    const start = formatDateKey(cursor, locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    if (period === 'day') return start;
    const mondayOffset = (dowFromDateKey(cursor) + 6) % 7;
    const monday = addDaysToKey(cursor, -mondayOffset);
    const end = formatDateKey(addDaysToKey(monday, 6), locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return `${start} - ${end}`;
}

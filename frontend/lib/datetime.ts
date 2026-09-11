import { MS_PER_HOUR, MS_PER_MINUTE } from 'shared/src/lib/constants';
import { dateKeyToLocalMidnight } from 'shared/src/schemas/api';

export { dateKeyToLocalMidnight as parseDateKey };

export function toLocalDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
    cursor: Date,
    period: 'day' | 'week' | 'month' | 'year',
    locale: string
): string {
    if (period === 'month') {
        const label = cursor.toLocaleDateString(locale, {
            month: 'long',
            year: 'numeric',
        });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (period === 'year') return String(cursor.getFullYear());
    const start = cursor.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    if (period === 'day') return start;
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    const endLabel = end.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return `${start} — ${endLabel}`;
}

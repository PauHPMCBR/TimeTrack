/**
 * Single source of truth for the app's semantic color coding.
 *
 * Every recurring "meaning" (vacation, obligatory holiday, authorized leave,
 * correct day, pending, rejected, team events, non-working, anomaly) has one
 * tone here. Consumers pick the shape they need so the same meaning keeps the
 * same color everywhere:
 *   - `row`    : left-bordered tinted table row (work-session reports)
 *   - `dot`    : small round indicator (legends, status badges)
 *   - `icon`   : icon text color
 *   - `chip`   : soft labeled chip (calendar events, tooltips)
 *   - `swatch` : small square color key (legend)
 *
 * Rule of thumb when adding a meaning: pick a tone below instead of hardcoding
 * Tailwind classes in the component, and reuse an existing tone for a related
 * meaning (e.g. team versions of an event reuse their personal tone family).
 */
export type SemanticTone =
    | 'electiveVacation'
    | 'obligatoryVacation'
    | 'authorizedLeave'
    | 'ok'
    | 'planned'
    | 'nonWorking'
    | 'anomaly'
    | 'pending'
    | 'rejected'
    | 'teamVacation'
    | 'teamPending';

export interface ToneClasses {
    row: string;
    dot: string;
    icon: string;
    chip: string;
    swatch: string;
}

export const TONE_CLASSES: Record<SemanticTone, ToneClasses> = {
    electiveVacation: {
        row: 'border-l-4 border-l-blue-500 bg-blue-100/90 dark:bg-blue-900/40',
        dot: 'bg-blue-500',
        icon: 'text-blue-600 dark:text-blue-400',
        chip: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/50',
        swatch: 'bg-blue-100 border border-blue-200 dark:bg-blue-900/40 dark:border-blue-800/50',
    },
    obligatoryVacation: {
        row: 'border-l-4 border-l-sky-500 bg-sky-100/90 dark:bg-sky-900/40',
        dot: 'bg-sky-500',
        icon: 'text-sky-600 dark:text-sky-400',
        chip: 'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800/50',
        swatch: 'bg-sky-100 border border-sky-200 dark:bg-sky-900/40 dark:border-sky-800/50',
    },
    authorizedLeave: {
        row: 'border-l-4 border-l-teal-500 bg-teal-100/90 dark:bg-teal-900/40',
        dot: 'bg-teal-500',
        icon: 'text-teal-600 dark:text-teal-400',
        chip: 'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800/50',
        swatch: 'bg-teal-100 border border-teal-200 dark:bg-teal-900/40 dark:border-teal-800/50',
    },
    ok: {
        row: 'border-l-4 border-l-green-500 bg-green-100/90 dark:bg-green-900/40',
        dot: 'bg-green-500',
        icon: 'text-green-600 dark:text-green-400',
        chip: 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/50',
        swatch: 'bg-green-100 border border-green-200 dark:bg-green-900/40 dark:border-green-800/50',
    },
    planned: {
        row: 'border-l-4 border-l-zinc-300 bg-zinc-100/60 dark:bg-zinc-800/40 dark:border-l-zinc-700',
        dot: 'bg-zinc-300 dark:bg-zinc-600',
        icon: 'text-zinc-400',
        chip: 'bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:border-zinc-700',
        swatch: 'bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700',
    },
    nonWorking: {
        row: 'border-l-4 border-l-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/60 dark:border-l-zinc-600',
        dot: 'bg-zinc-400',
        icon: 'text-zinc-400',
        chip: 'bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:border-zinc-700',
        swatch: 'bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700',
    },
    anomaly: {
        row: 'border-l-4 border-l-red-500 bg-red-100/90 dark:bg-red-900/40',
        dot: 'bg-red-500',
        icon: 'text-red-600 dark:text-red-400',
        chip: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/50',
        swatch: 'bg-red-100 border border-red-200 dark:bg-red-900/40 dark:border-red-800/50',
    },
    pending: {
        row: 'border-l-4 border-l-yellow-400 bg-yellow-100/90 dark:bg-yellow-900/40',
        dot: 'bg-yellow-400',
        icon: 'text-yellow-600 dark:text-yellow-400',
        chip: 'bg-yellow-100 text-yellow-800 border border-dashed border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/50',
        swatch: 'bg-yellow-100 border border-dashed border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-800/50',
    },
    rejected: {
        row: 'border-l-4 border-l-red-300 bg-red-50/90 dark:bg-red-900/20',
        dot: 'bg-red-300',
        icon: 'text-red-400 dark:text-red-400',
        chip: 'bg-red-100 text-red-800 border border-dashed border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50',
        swatch: 'bg-red-100 border border-dashed border-red-300 dark:bg-red-900/30 dark:border-red-800/50',
    },
    teamVacation: {
        row: 'border-l-4 border-l-pink-400 bg-pink-100/90 dark:bg-pink-900/30',
        dot: 'bg-pink-400',
        icon: 'text-pink-600 dark:text-pink-300',
        chip: 'bg-pink-100 text-pink-800 border border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800/50',
        swatch: 'bg-pink-100 border border-pink-200 dark:bg-pink-900/30 dark:border-pink-800/50',
    },
    teamPending: {
        row: 'border-l-4 border-l-pink-300 bg-pink-50/90 dark:bg-pink-900/20',
        dot: 'bg-pink-300',
        icon: 'text-pink-500 dark:text-pink-300',
        chip: 'bg-pink-50 text-pink-700 border border-dashed border-pink-300 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800/50',
        swatch: 'bg-pink-50 border border-dashed border-pink-300 dark:bg-pink-900/20 dark:border-pink-800/50',
    },
};

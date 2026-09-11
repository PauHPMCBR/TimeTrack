import type { ReactNode } from 'react';
import { TimetableEntry } from '@/lib/timetable';

export const TIMETABLE_CHIP_BASE_CLASS =
    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium tabular-nums';

export const TIMETABLE_CHIP_NEUTRAL_CLASS =
    'border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

interface TimetableListProps<E extends TimetableEntry = TimetableEntry> {
    timetable: E[];
    entryClassName?: (entry: E, index: number) => string | undefined;
    entryTitle?: (entry: E, index: number) => string | undefined;
    entryIcon?: (entry: E, index: number) => ReactNode;
}

export default function TimetableList<
    E extends TimetableEntry = TimetableEntry,
>({
    timetable,
    entryClassName,
    entryTitle,
    entryIcon,
}: TimetableListProps<E>) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {timetable.map((entry, index) => (
                <span
                    key={index}
                    title={entryTitle?.(entry, index)}
                    className={`${TIMETABLE_CHIP_BASE_CLASS} ${
                        entryClassName?.(entry, index) ??
                        TIMETABLE_CHIP_NEUTRAL_CLASS
                    }`}
                >
                    {entryIcon?.(entry, index)}
                    {entry.checkIn} – {entry.checkOut}
                </span>
            ))}
        </div>
    );
}

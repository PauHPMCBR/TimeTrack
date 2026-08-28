import { TimetableEntry } from '@/lib/timetable';

export default function TimetableList({
    timetable,
}: {
    timetable: TimetableEntry[];
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {timetable.map((entry, index) => (
                <span
                    key={index}
                    className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium tabular-nums text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                    {entry.checkIn} – {entry.checkOut}
                </span>
            ))}
        </div>
    );
}
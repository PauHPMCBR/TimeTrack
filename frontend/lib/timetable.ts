export type TimetableEntry = { checkIn: string; checkOut: string };

export function timetableText(timetable: TimetableEntry[]): string {
    return timetable.map((e) => `${e.checkIn} – ${e.checkOut}`).join(', ');
}

// The automatic timetable: a list of check-in/check-out intervals ("HH:MM").
// Defaults live in the shared schema (DEFAULT_AUTO_TIMETABLE) and are applied
// on user creation; getAutoTimetable() only guards against legacy docs.

import {
    AutoScheduleEntry,
    DEFAULT_AUTO_TIMETABLE,
} from 'shared/src/schemas/database';

export { DEFAULT_AUTO_TIMETABLE };
export type { AutoScheduleEntry };

export function getAutoTimetable(user: {
    autoTimetable?: AutoScheduleEntry[];
}): AutoScheduleEntry[] {
    if (Array.isArray(user.autoTimetable) && user.autoTimetable.length > 0) {
        return user.autoTimetable;
    }
    return DEFAULT_AUTO_TIMETABLE;
}
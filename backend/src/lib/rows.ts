import { z } from 'zod';
import {
    UserSchema,
    GroupSchema,
    WorkDaySessionsSchema,
    DaySessionSchema,
    ElectiveVacationSchema,
    YearlyVacationDaysSchema,
    AuthorizedLeaveSchema,
    WorkDayRecordSchema,
} from 'shared/src/schemas/database';
import type { DateKey, DateKeyInterval } from 'shared/src/lib/day-key';
import type { TimeKey } from 'shared/src/lib/time-key';

export type UserRow = Omit<z.infer<typeof UserSchema>, 'trackingStartDate'> & {
    _id: string;
    trackingStartDate: DateKey;
};
export type GroupRow = z.infer<typeof GroupSchema> & { _id: string };
export type DaySessionRow = Omit<z.infer<typeof DaySessionSchema>, 'time'> & {
    time: TimeKey;
};
export type DaySessionsRow = Omit<
    z.infer<typeof WorkDaySessionsSchema>,
    'date' | 'sessions'
> & {
    _id: string;
    date: DateKey;
    sessions: DaySessionRow[];
};
export type ElectiveVacationRow = Omit<
    z.infer<typeof ElectiveVacationSchema>,
    'startDate' | 'endDate'
> &
    DateKeyInterval & { _id: string };
export type YearlyVacationRow = Omit<
    z.infer<typeof YearlyVacationDaysSchema>,
    'obligatoryIntervals'
> & {
    _id: string;
    obligatoryIntervals: DateKeyInterval[];
};
export type AuthorizedLeaveRow = Omit<
    z.infer<typeof AuthorizedLeaveSchema>,
    'startDate' | 'endDate'
> &
    DateKeyInterval & { _id: string };
export type WorkDayRecordRow = Omit<
    z.infer<typeof WorkDayRecordSchema>,
    'date'
> & {
    _id: string;
    date: DateKey;
};

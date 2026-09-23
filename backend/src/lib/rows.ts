import { z } from 'zod';
import {
    UserSchema,
    GroupSchema,
    ElectiveVacationSchema,
    YearlyVacationDaysSchema,
    AuthorizedLeaveSchema,
    WorkDayRecordSchema,
} from 'shared/src/schemas/database';
import type { DaySessionRow, DaySessionsRow } from 'shared/src/schemas/api';
import type { DateKey, DateKeyInterval } from 'shared/src/lib/day-key';

export type { DaySessionRow, DaySessionsRow };

export type UserRow = Omit<z.infer<typeof UserSchema>, 'trackingStartDate'> & {
    _id: string;
    trackingStartDate: DateKey;
};
export type GroupRow = z.infer<typeof GroupSchema> & { _id: string };
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

import { z } from 'zod';
import {
    UserSchema,
    GroupSchema,
    WorkSessionSchema,
    ElectiveVacationSchema,
    YearlyVacationDaysSchema,
} from 'shared/src/schemas/database';
import type { DateKey } from 'shared/src/lib/day-key';

export type UserRow = Omit<z.infer<typeof UserSchema>, 'trackingStartDate'> & {
    _id: string;
    trackingStartDate: DateKey;
};
export type GroupRow = z.infer<typeof GroupSchema> & { _id: string };
export type WorkSessionRow = z.infer<typeof WorkSessionSchema> & {
    _id: string;
};
export type ElectiveVacationRow = Omit<
    z.infer<typeof ElectiveVacationSchema>,
    'startDate' | 'endDate'
> & {
    _id: string;
    startDate: DateKey;
    endDate: DateKey;
};
export type YearlyVacationRow = Omit<
    z.infer<typeof YearlyVacationDaysSchema>,
    'obligatoryDays'
> & {
    _id: string;
    obligatoryDays: DateKey[];
};

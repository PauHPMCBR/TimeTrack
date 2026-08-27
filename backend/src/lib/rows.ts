import { z } from 'zod';
import {
    UserSchema,
    GroupSchema,
    WorkSessionSchema,
    ElectiveVacationSchema,
    YearlyVacationDaysSchema,
} from 'shared/src/schemas/database';

export type UserRow = z.infer<typeof UserSchema> & { _id: string };
export type GroupRow = z.infer<typeof GroupSchema> & { _id: string };
export type WorkSessionRow = z.infer<typeof WorkSessionSchema> & {
    _id: string;
};
export type ElectiveVacationRow = z.infer<typeof ElectiveVacationSchema> & {
    _id: string;
};
export type YearlyVacationRow = z.infer<typeof YearlyVacationDaysSchema> & {
    _id: string;
};

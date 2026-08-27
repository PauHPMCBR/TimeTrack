import { z } from 'zod';
import {
    AppSettingsSchema,
    ElectiveVacationSchema,
    GroupSchema,
    UserSchema,
    WorkSessionReasonSchema,
    WorkSessionSchema,
    YearlyVacationDaysSchema,
} from '@/schemas/database';
import { AdminWorkSessionRowSchema } from '@/schemas/api';
import type { AdminWorkSessionRow } from '@/schemas/api';

export type User = z.infer<typeof UserSchema> & { _id: string };
export type Group = z.infer<typeof GroupSchema> & { _id: string };
export type WorksessionReason = z.infer<typeof WorkSessionReasonSchema> & {
    _id: string;
};
export type WorkSession = z.infer<typeof WorkSessionSchema> & { _id: string };
export type ElectiveVacation = z.infer<typeof ElectiveVacationSchema> & {
    _id: string;
};
export type YearlyVacationDays = z.infer<typeof YearlyVacationDaysSchema> & {
    _id: string;
};
export type AppSettings = z.infer<typeof AppSettingsSchema> & { _id: string };
export type AdminWorkSessionRow = z.infer<typeof AdminWorkSessionRowSchema>;

export type AdminWorkSessionsResponse = {
    rows: AdminWorkSessionRow[];
    total?: number;
    limit?: number;
    offset?: number;
};

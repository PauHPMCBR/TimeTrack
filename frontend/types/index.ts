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
import type { AdminWorkSessionRow } from '@/schemas/api';

export type User = z.infer<typeof UserSchema> & { _id: string };
export type Group = z.infer<typeof GroupSchema> & { _id: string };
// Group routes populate the `members` array with these user fields.
export type GroupMember = {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
    registered?: boolean;
};
export type WorksessionReason = z.infer<typeof WorkSessionReasonSchema> & {
    _id: string;
};
export type WorkSession = z.infer<typeof WorkSessionSchema> & { _id: string };
export type ElectiveVacation = z.infer<typeof ElectiveVacationSchema> & {
    _id: string;
    approvedByName?: string;
};
export type YearlyVacationDays = z.infer<typeof YearlyVacationDaysSchema> & {
    _id: string;
};
export type AppSettings = z.infer<typeof AppSettingsSchema> & { _id: string };
export type { AdminWorkSessionRow };

export type PopulatedUserRef = { _id: string; name: string; email: string };
export type TeamVacation = Omit<ElectiveVacation, 'userId'> & {
    userId: string | PopulatedUserRef;
};

export type AdminDashboardUser = User & { workingNow: boolean };

export type AdminDashboardResponse = {
    users: AdminDashboardUser[];
    groups: Group[];
    usersCount: number;
    groupsCount: number;
    pendingVacations: number;
    currentlyWorking: number;
    anomalyCount: number;
};

export type AdminWorkSessionsResponse = {
    rows: AdminWorkSessionRow[];
    total?: number;
    limit?: number;
    offset?: number;
};

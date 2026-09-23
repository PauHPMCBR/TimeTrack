import { z } from 'zod';
import {
    AppSettingsSchema,
    ElectiveVacationSchema,
    GroupSchema,
    UserSchema,
    WorkSessionReasonSchema,
    YearlyVacationDaysSchema,
} from '@/schemas/database';
import type {
    AdminWorkSessionRow,
    DaySessionRow,
    DaySessionsRow,
    UserRef,
} from '@/schemas/api';
import type { DateKeyInterval } from 'shared/src/lib/day-key';

export type {
    AdminWorkSessionRow,
    DaySessionRow,
    DaySessionsRow,
    UserRef,
};

export type User = z.infer<typeof UserSchema> & { _id: string };
export type Group = z.infer<typeof GroupSchema> & { _id: string };
// Group routes populate the `members` array with these user fields.
export type GroupMember = {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
    registered?: boolean;
    avatar?: string;
};
export type WorksessionReason = z.infer<typeof WorkSessionReasonSchema> & {
    _id: string;
};
export type ElectiveVacation = Omit<
    z.infer<typeof ElectiveVacationSchema>,
    'startDate' | 'endDate'
> &
    DateKeyInterval & {
        _id: string;
        approvedByName?: string;
    };
export type YearlyVacationDays = Omit<
    z.infer<typeof YearlyVacationDaysSchema>,
    'obligatoryIntervals'
> & {
    _id: string;
    obligatoryIntervals: DateKeyInterval[];
};
export type AppSettings = z.infer<typeof AppSettingsSchema> & { _id: string };

export type DeletedUserRow = User & { deletedAt: string };

export type TeamVacation = Omit<ElectiveVacation, 'userId'> & {
    userId: string | UserRef;
};

export type AdminDashboardUser = User & { workingNow: boolean };

export type AdminDashboardResponse = {
    users: AdminDashboardUser[];
    groups: Group[];
    usersCount: number;
    groupsCount: number;
    pendingVacations: number;
    pendingApprovals: number;
    currentlyWorking: number;
    anomalyCount: number;
};

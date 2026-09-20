import { z } from 'zod';
import {
    AppSettingsSchema,
    DaySessionSchema,
    ElectiveVacationSchema,
    GroupSchema,
    UserSchema,
    WorkDaySessionsSchema,
    WorkSessionReasonSchema,
    YearlyVacationDaysSchema,
} from '@/schemas/database';
import type { AdminWorkSessionRow } from '@/schemas/api';
import type { DateKey, DateKeyInterval } from 'shared/src/lib/day-key';
import type { TimeKey } from 'shared/src/lib/time-key';

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
export type DaySession = Omit<z.infer<typeof DaySessionSchema>, 'time'> & {
    time: TimeKey;
};
export type WorkDaySessions = Omit<
    z.infer<typeof WorkDaySessionsSchema>,
    'date' | 'sessions'
> & {
    _id: string;
    date: DateKey;
    sessions: DaySession[];
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
export type { AdminWorkSessionRow };

export type DeletedUserRow = User & { deletedAt: string };

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
    pendingApprovals: number;
    currentlyWorking: number;
    anomalyCount: number;
};

export type AdminWorkSessionsResponse = {
    rows: AdminWorkSessionRow[];
    total?: number;
    limit?: number;
    offset?: number;
    approvedMonths?: string[];
    timetableToleranceMinutes?: number;
};

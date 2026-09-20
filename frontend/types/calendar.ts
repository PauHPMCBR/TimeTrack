import {
    YearlyVacationResponse,
    MonthlyWorkRecordResponse,
    AuthorizedLeaveRow,
} from '@/schemas/api';
import {
    ElectiveVacation,
    TeamVacation,
    DaySession,
} from '.';
import type { DateKey } from 'shared/src/lib/day-key';

export type TeamAuthorizedLeave = AuthorizedLeaveRow & {
    userName?: string;
};

export type VacationEvent = {
    type:
        | 'obligatory'
        | 'elective-approved'
        | 'elective-pending'
        | 'elective-rejected'
        | 'authorized-leave'
        | 'team-elective'
        | 'team-elective-pending'
        | 'team-authorized-leave';
    label: string;
    elective?: ElectiveVacation | TeamVacation;
    leave?: AuthorizedLeaveRow;
    userName?: string;
};

export type WorkSessionEvent = {
    hoursWorked: number;
    sessions: number;
    sessionsList?: DaySession[];
};

export interface CalendarDayData {
    date: DateKey;
    vacationEvents: VacationEvent[];
    workEvent: WorkSessionEvent | null;
    isToday: boolean;
    isWeekend: boolean;
    /** The user does not work this day: weekend, company obligatory holiday or own approved elective vacation. */
    isNonWorking: boolean;
}

export interface CalendarProps {
    cursor: DateKey;
    onMonthChange: (newCursor: DateKey) => void;
    onDayClick?: (date: DateKey) => void;
    onDayDetailAction?: (date: DateKey) => void;
    vacations: YearlyVacationResponse | null;
    workSessions: MonthlyWorkRecordResponse | null;
    teamVacations?: TeamVacation[];
    authorizedLeaves?: AuthorizedLeaveRow[];
    teamAuthorizedLeaves?: TeamAuthorizedLeave[];
    usersMap?: Record<string, string>;
    nonWorkingDays?: number[];
    loading?: boolean;
    showWorkSessions?: boolean;
    showVacations?: boolean;
    locale: string;
    t: (key: string) => string;
    className?: string;
}

export interface CalendarDayProps {
    day: CalendarDayData;
    onHover: (date: DateKey, event: React.MouseEvent) => void;
    onClick?: (date: DateKey) => void;
    getVacationClass: (type: VacationEvent['type']) => string;
    t: (key: string) => string;
}

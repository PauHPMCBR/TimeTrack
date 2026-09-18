import {
    YearlyVacationResponse,
    MonthlyWorkRecordResponse,
    AuthorizedLeaveRow,
} from '@/schemas/api';
import { ElectiveVacation, TeamVacation, WorkSession } from '.';

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
    sessionsList?: WorkSession[];
};

export interface CalendarDayData {
    date: Date;
    vacationEvents: VacationEvent[];
    workEvent: WorkSessionEvent | null;
    isToday: boolean;
    isWeekend: boolean;
    /** The user does not work this day: weekend, company obligatory holiday or own approved elective vacation. */
    isNonWorking: boolean;
}

export interface CalendarProps {
    cursor: Date;
    onMonthChange: (newCursor: Date) => void;
    onDayClick?: (date: Date) => void;
    onDayDetailAction?: (date: Date) => void;
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
    onHover: (date: Date, event: React.MouseEvent) => void;
    onClick?: (date: Date) => void;
    getVacationClass: (type: VacationEvent['type']) => string;
    t: (key: string) => string;
}

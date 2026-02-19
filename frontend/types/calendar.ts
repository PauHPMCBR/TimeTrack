import { YearlyVacationResponse, MonthlyWorkRecordResponse } from "@/schemas/api";
import { ElectiveVacation, WorkSession } from ".";

export type VacationEvent = {
  type: 'obligatory' | 'elective-approved' | 'elective-pending' | 'elective-rejected';
  label: string;
  elective?: ElectiveVacation;
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
}

export interface CalendarProps {
  cursor: Date;
  onMonthChange: (newCursor: Date) => void;
  onDayClick?: (date: Date) => void;
  vacations: YearlyVacationResponse | null;
  workSessions: MonthlyWorkRecordResponse | null;
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
"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarProps, CalendarDayData, VacationEvent } from "@/types/calendar";
import { CalendarDay } from "./CalendarDay";
import { CalendarTooltip, getVacationClass } from "./CalendarTooltip";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildMonthMatrix(year: number, monthIndex0: number): (Date | null)[][] {
  const first = new Date(year, monthIndex0, 1);
  const last = new Date(year, monthIndex0 + 1, 0);
  const startWeekday = (first.getDay() + 6) % 7; // dilluns=0
  const daysInMonth = last.getDate();

  const cells: (Date | null)[] = Array.from({ length: startWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex0, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function Calendar({
  cursor,
  onMonthChange,
  onDayClick,
  vacations,
  workSessions,
  teamVacations = [],
  loading = false,
  showWorkSessions = true,
  showVacations = true,
  locale,
  t,
  className = ""
}: CalendarProps) {
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () => buildMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const today = new Date();

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
    .format(cursor)
    .replace(/^./, (c) => c.toLocaleUpperCase(locale));

  const prevMonth = () => onMonthChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const nextMonth = () => onMonthChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  // Get detailed vacations for the day
  const getVacationsForDay = (date: Date): VacationEvent[] => {
    if (!vacations || !showVacations) return [];
    
    const dateStr = ymd(date);
    const events: VacationEvent[] = [];

    const isObligatory = vacations.yearlyVacationDays?.obligatoryDays?.some(obligatoryDate => {
      const obligatoryDateObj = new Date(obligatoryDate);
      obligatoryDateObj.setHours(0, 0, 0, 0);
      const dateToCheck = new Date(date);
      dateToCheck.setHours(0, 0, 0, 0);
      return obligatoryDateObj.getTime() === dateToCheck.getTime();
    }) || false;
    
    if (isObligatory) {
      events.push({
        type: 'obligatory',
        label: t('calendar.obligatoryVacation')
      });
    }

    // Check elective vacation requests with full details
    const electiveRequests = vacations.electives?.filter(elective => {
      if (!elective.date) return false;
      const electiveDate = new Date(elective.date);
      electiveDate.setHours(0, 0, 0, 0);
      const dateToCheck = new Date(date);
      dateToCheck.setHours(0, 0, 0, 0);
      return electiveDate.getTime() === dateToCheck.getTime();
    }) || [];
    
    electiveRequests.forEach(elective => {
      if (elective.status === 'approved') {
        events.push({
          type: 'elective-approved',
          label: t('calendar.electiveVacation'),
          elective: elective
        });
      } else if (elective.status === 'pending') {
        events.push({
          type: 'elective-pending',
          label: t('calendar.pendingVacation'),
          elective: elective
        });
      } else if (elective.status === 'rejected') {
        events.push({
          type: 'elective-rejected',
          label: t('calendar.rejectedVacation'),
          elective: elective
        });
      }
    });
    
    // Add team vacations
    if (teamVacations && teamVacations.length > 0) {
        teamVacations.forEach(vac => {
            const vacDate = new Date(vac.date);
            vacDate.setHours(0, 0, 0, 0);
            const dateToCheck = new Date(date);
            dateToCheck.setHours(0, 0, 0, 0);
            
            if (vacDate.getTime() === dateToCheck.getTime()) {
                // Check if it's not the same as one we already have (own elective)
                // Actually, own approved elective will already be in events.
                // But for team vacations, we want to show other users.
                
                // Assuming vacations from API are populated with userId
                const vacUser = vac.userId;
                const vacUserName = typeof vacUser === 'object' ? vacUser.name : null;
                
                events.push({
                    type: 'team',
                    label: vacUserName || t('calendar.electiveVacation'),
                    userName: vacUserName
                });
            }
        });
    }

    return events;
  };

  // Get detailed work sessions for the day
  const getWorkSessionsForDay = (date: Date) => {
    if (!workSessions || !showWorkSessions) return null;
    
    const day = date.getDate();
    const dailyStat = workSessions.summary?.dailyStats?.[day];
    const sessionsList = workSessions.sessionsByDay?.[day];
    
    if (dailyStat && dailyStat.sessions > 0) {
      return {
        hoursWorked: dailyStat.hoursWorked || 0,
        sessions: dailyStat.sessions || 0,
        sessionsList: sessionsList || []
      };
    }
    
    return null;
  };

  // Get calendar day data
  const getCalendarDayData = (date: Date): CalendarDayData => {
    const key = ymd(date);
    return {
      date,
      vacationEvents: getVacationsForDay(date),
      workEvent: getWorkSessionsForDay(date),
      isToday: ymd(date) === ymd(today),
      isWeekend: [6, 0].includes(date.getDay())
    };
  };

  // Handle day hover for tooltip
  const handleDayHover = (date: Date, event: React.MouseEvent) => {
    setHoveredDay(date);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  // Handle day click for modal
  const handleDayClick = (date: Date) => {
    setHoveredDay(null);
    setSelectedDay(date);
    // Call external onClick handler if provided
    onDayClick?.(date);
  };

  // Handle mouse leave from calendar area
  const handleCalendarMouseLeave = () => {
    setHoveredDay(null);
  };

  // Close modal
  const closeModal = () => {
    setSelectedDay(null);
  };

  return (
    <section 
      ref={calendarRef}
      className={`space-y-4 relative ${className}`}
      onMouseLeave={handleCalendarMouseLeave}
    >
      {/* Hover Tooltip */}
      {hoveredDay && (
        <CalendarTooltip
          date={hoveredDay}
          vacationEvents={getVacationsForDay(hoveredDay)}
          workEvent={getWorkSessionsForDay(hoveredDay)}
          position={tooltipPosition}
          locale={locale}
          t={t}
        />
      )}

      {/* Modal for clicked day */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop - click outside to close */}
          <div 
            className="absolute inset-0 bg-black/20"
            onClick={closeModal}
          />
          {/* Modal container */}
          <div className="relative bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-300 dark:border-zinc-600 max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <CalendarTooltip
                date={selectedDay}
                vacationEvents={getVacationsForDay(selectedDay)}
                workEvent={getWorkSessionsForDay(selectedDay)}
                position={{ x: 0, y: 0 }}
                locale={locale}
                t={t}
                isModal={true}
              />
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 flex justify-end">
              <button
                onClick={closeModal}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
          disabled={loading}
        >
          ← {t("calendar.prevMonth")}
        </button>

        <div className="text-lg font-semibold flex items-center gap-2">
          {monthLabel}
        </div>

        <button
          onClick={nextMonth}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
          disabled={loading}
        >
          {t("calendar.nextMonth")} →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
          {["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"].map((d) => (
            <div key={d} className="px-2 py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-zinc-200/60 dark:bg-zinc-800/60">
          {rows.flat().map((date, idx) => {
            if (!date) return (
              <div 
                key={idx} 
                className="h-28 bg-white dark:bg-zinc-900"
                onMouseLeave={handleCalendarMouseLeave}
              />
            );

            const dayData = getCalendarDayData(date);

            return (
              <CalendarDay
                key={idx}
                day={dayData}
                onHover={handleDayHover}
                onClick={handleDayClick}
                getVacationClass={getVacationClass}
                t={t}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
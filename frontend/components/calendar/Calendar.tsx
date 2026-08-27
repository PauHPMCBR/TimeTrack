'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    CalendarProps,
    CalendarDayData,
    VacationEvent,
} from '@/types/calendar';
import { CalendarDay } from './CalendarDay';
import { CalendarTooltip, getVacationClass } from './CalendarTooltip';
import { weekDayShortLabels } from '@/lib/datetime';
import {
    VACATION_APPROVED,
    VACATION_PENDING,
    VACATION_REJECTED,
} from 'shared/src/lib/constants';
import { DEFAULT_NON_WORKING_DAYS } from 'shared/src/lib/defaults';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

function pad(n: number): string {
    return n.toString().padStart(2, '0');
}

function ymd(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildMonthMatrix(
    year: number,
    monthIndex0: number
): (Date | null)[][] {
    const first = new Date(year, monthIndex0, 1);
    const last = new Date(year, monthIndex0 + 1, 0);
    const startWeekday = (first.getDay() + 6) % 7; // dilluns=0
    const daysInMonth = last.getDate();

    const cells: (Date | null)[] = Array.from(
        { length: startWeekday },
        () => null
    );
    for (let d = 1; d <= daysInMonth; d++)
        cells.push(new Date(year, monthIndex0, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
}

export function Calendar({
    cursor,
    onMonthChange,
    onDayClick,
    onDayDetailAction,
    vacations,
    workSessions,
    teamVacations = [],
    usersMap,
    nonWorkingDays = DEFAULT_NON_WORKING_DAYS,
    loading = false,
    showWorkSessions = true,
    showVacations = true,
    locale,
    t,
    className = '',
}: CalendarProps) {
    const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    const rows = useMemo(
        () => buildMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
        [cursor]
    );

    const today = useMemo(() => new Date(), []);

    const monthLabel = new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
    })
        .format(cursor)
        .replace(/^./, (c) => c.toLocaleUpperCase(locale));

    const weekdayLabels = useMemo(() => weekDayShortLabels(locale), [locale]);

    const prevMonth = () =>
        onMonthChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    const nextMonth = () =>
        onMonthChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

    const getVacationsForDay = useCallback(
        (date: Date): VacationEvent[] => {
            if (!vacations || !showVacations) return [];

            const events: VacationEvent[] = [];

            const isObligatory =
                vacations.yearlyVacationDays?.obligatoryDays?.some(
                    (obligatoryDate) => {
                        const obligatoryDateObj = new Date(obligatoryDate);
                        obligatoryDateObj.setHours(0, 0, 0, 0);
                        const dateToCheck = new Date(date);
                        dateToCheck.setHours(0, 0, 0, 0);
                        return (
                            obligatoryDateObj.getTime() ===
                            dateToCheck.getTime()
                        );
                    }
                ) || false;

            if (isObligatory) {
                events.push({
                    type: 'obligatory',
                    label: t('calendar.obligatoryVacation'),
                });
            }

            const electiveRequests =
                vacations.electives?.filter((elective) => {
                    if (!elective.date) return false;
                    const electiveDate = new Date(elective.date);
                    electiveDate.setHours(0, 0, 0, 0);
                    const dateToCheck = new Date(date);
                    dateToCheck.setHours(0, 0, 0, 0);
                    return electiveDate.getTime() === dateToCheck.getTime();
                }) || [];

            electiveRequests.forEach((elective) => {
                const userName = usersMap
                    ? usersMap[elective.userId]
                    : undefined;
                const label = userName ?? t('calendar.electiveVacation');

                if (elective.status === VACATION_APPROVED) {
                    events.push({
                        type: 'elective-approved',
                        label: label,
                        elective: elective,
                    });
                } else if (elective.status === VACATION_PENDING) {
                    events.push({
                        type: 'elective-pending',
                        label: label,
                        elective: elective,
                    });
                } else if (elective.status === VACATION_REJECTED) {
                    events.push({
                        type: 'elective-rejected',
                        label: label,
                        elective: elective,
                    });
                }
            });

            if (teamVacations && teamVacations.length > 0) {
                teamVacations.forEach((vac) => {
                    const vacDate = new Date(vac.date);
                    vacDate.setHours(0, 0, 0, 0);
                    const dateToCheck = new Date(date);
                    dateToCheck.setHours(0, 0, 0, 0);

                    if (vacDate.getTime() === dateToCheck.getTime()) {
                        const vacUser = vac.userId;
                        const vacUserName =
                            typeof vacUser === 'object' ? vacUser.name : null;

                        events.push({
                            type: 'team',
                            label:
                                vacUserName || t('calendar.electiveVacation'),
                            userName: vacUserName ?? undefined,
                        });
                    }
                });
            }

            return events;
        },
        [vacations, teamVacations, showVacations, usersMap, t]
    );

    const getWorkSessionsForDay = useCallback(
        (date: Date) => {
            if (!workSessions || !showWorkSessions) return null;

            const day = date.getDate();
            const dailyStat = workSessions.summary?.dailyStats?.[day];
            const sessionsList = workSessions.sessionsByDay?.[day];

            if (dailyStat && dailyStat.sessions > 0) {
                return {
                    hoursWorked: dailyStat.hoursWorked || 0,
                    sessions: dailyStat.sessions || 0,
                    sessionsList: sessionsList || [],
                };
            }

            return null;
        },
        [workSessions, showWorkSessions]
    );

    // Precompute every cell's data once per month/data — avoids O(days × events)
    // recomputation and full-grid re-renders on every hover/tooltip move.
    const daysData = useMemo(() => {
        const map = new Map<string, CalendarDayData>();
        rows.flat().forEach((date) => {
            if (!date) return;
            const key = ymd(date);
            map.set(key, {
                date,
                vacationEvents: getVacationsForDay(date),
                workEvent: getWorkSessionsForDay(date),
                isToday: key === ymd(today),
                isWeekend: nonWorkingDays.includes(date.getDay()),
            });
        });
        return map;
    }, [
        rows,
        getVacationsForDay,
        getWorkSessionsForDay,
        today,
        nonWorkingDays,
    ]);

    const handleDayHover = useCallback(
        (date: Date, event: React.MouseEvent) => {
            setHoveredDay(date);
            const rect = event.currentTarget.getBoundingClientRect();
            setTooltipPosition({
                x: rect.left + rect.width / 2,
                y: rect.top,
            });
        },
        []
    );

    const handleDayClick = useCallback(
        (date: Date) => {
            setHoveredDay(null);
            setSelectedDay(date);
            onDayClick?.(date);
        },
        [onDayClick]
    );

    const handleCalendarMouseLeave = useCallback(() => {
        setHoveredDay(null);
    }, []);

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
            {selectedDay &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop - click outside to close */}
                        <div
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                            onClick={closeModal}
                        />
                        {/* Modal container */}
                        <div className="relative bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-300 dark:border-zinc-600 max-w-md w-full max-h-[80vh] overflow-hidden">
                            <div className="p-6 max-h-[70vh] overflow-y-auto">
                                <CalendarTooltip
                                    date={selectedDay}
                                    vacationEvents={getVacationsForDay(
                                        selectedDay
                                    )}
                                    workEvent={getWorkSessionsForDay(
                                        selectedDay
                                    )}
                                    position={{ x: 0, y: 0 }}
                                    locale={locale}
                                    t={t}
                                    isModal={true}
                                />
                            </div>
                            <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 flex justify-end gap-2">
                                {onDayDetailAction && (
                                    <Button
                                        onClick={() =>
                                            onDayDetailAction(selectedDay)
                                        }
                                        variant="soft"
                                    >
                                        {t('calendar.viewFitxatges')}
                                    </Button>
                                )}
                                <Button onClick={closeModal} variant="primary">
                                    {t('common.close')}
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <Button
                    onClick={prevMonth}
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                >
                    ← {t('calendar.prevMonth')}
                </Button>

                <div className="text-lg font-semibold flex items-center gap-2">
                    {monthLabel}
                </div>

                <Button
                    onClick={nextMonth}
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                >
                    {t('calendar.nextMonth')} →
                </Button>
            </div>

            {/* Calendar Grid */}
            <Card className="overflow-hidden">
                <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    {weekdayLabels.map((d) => (
                        <div key={d} className="px-2 py-2">
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-px bg-zinc-200/60 dark:bg-zinc-800/60">
                    {rows.flat().map((date, idx) => {
                        if (!date)
                            return (
                                <div
                                    key={idx}
                                    className="h-28 bg-white dark:bg-zinc-900"
                                    onMouseLeave={handleCalendarMouseLeave}
                                />
                            );

                        const dayData = daysData.get(ymd(date))!;

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
            </Card>
        </section>
    );
}

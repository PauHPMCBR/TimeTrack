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
import { todayKey } from '@/lib/timezone';
import {
    dateKeyFromParts,
    daysInMonth,
    dowFromDateKey,
    type DateKey,
} from 'shared/src/lib/day-key';
import {
    VACATION_APPROVED,
    VACATION_PENDING,
    VACATION_REJECTED,
} from 'shared/src/lib/constants';
import { DEFAULT_WEEKLY_EXPECTED_HOURS } from 'shared/src/lib/defaults';
import { nonWorkingDaysOfWeek } from 'shared/src/lib/user-overrides';
import {
    keyIsWithinAnyInterval,
    keyIsWithinInterval,
} from 'shared/src/lib/vacation-days';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

function buildMonthMatrix(
    year: number,
    month: number
): (DateKey | null)[][] {
    const startWeekday = (dowFromDateKey(dateKeyFromParts(year, month, 1)) + 6) % 7; // dilluns=0

    const cells: (DateKey | null)[] = Array.from(
        { length: startWeekday },
        () => null
    );
    for (let d = 1; d <= daysInMonth(year, month); d++)
        cells.push(dateKeyFromParts(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (DateKey | null)[][] = [];
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
    authorizedLeaves = [],
    teamAuthorizedLeaves = [],
    usersMap,
    nonWorkingDays = nonWorkingDaysOfWeek(DEFAULT_WEEKLY_EXPECTED_HOURS),
    loading = false,
    showWorkSessions = true,
    showVacations = true,
    locale,
    t,
    className = '',
}: CalendarProps) {
    const [hoveredDay, setHoveredDay] = useState<DateKey | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [selectedDay, setSelectedDay] = useState<DateKey | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    const rows = useMemo(() => {
        const [y, m] = cursor.split('-').map(Number);
        return buildMonthMatrix(y, m);
    }, [cursor]);

    const monthLabel = (() => {
        const [y, m] = cursor.split('-').map(Number);
        return new Intl.DateTimeFormat(locale, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        })
            .format(new Date(Date.UTC(y, m - 1, 1)))
            .replace(/^./, (c) => c.toLocaleUpperCase(locale));
    })();

    const weekdayLabels = useMemo(() => weekDayShortLabels(locale), [locale]);

    const prevMonth = () => {
        const [y, m] = cursor.split('-').map(Number);
        onMonthChange(
            m === 1 ? dateKeyFromParts(y - 1, 12, 1) : dateKeyFromParts(y, m - 1, 1)
        );
    };
    const nextMonth = () => {
        const [y, m] = cursor.split('-').map(Number);
        onMonthChange(
            m === 12 ? dateKeyFromParts(y + 1, 1, 1) : dateKeyFromParts(y, m + 1, 1)
        );
    };

    const getVacationsForDay = useCallback(
        (dayKey: DateKey): VacationEvent[] => {
            if (!vacations || !showVacations) return [];

            const events: VacationEvent[] = [];

            const isObligatory = keyIsWithinAnyInterval(
                dayKey,
                vacations.yearlyVacationDays?.obligatoryIntervals ?? []
            );

            if (isObligatory) {
                events.push({
                    type: 'obligatory',
                    label: t('calendar.obligatoryVacation'),
                });
            }

            const electiveRequests =
                vacations.electives?.filter(
                    (elective) =>
                        elective.startDate &&
                        elective.endDate &&
                        keyIsWithinInterval(
                            dayKey,
                            elective.startDate,
                            elective.endDate
                        )
                ) || [];

            electiveRequests.forEach((elective) => {
                const userName = usersMap
                    ? usersMap[elective.userId]
                    : undefined;
                // Status-appropriate fallback when the owner's name is unknown.
                const fallbackLabel =
                    elective.status === VACATION_PENDING
                        ? t('calendar.pendingVacation')
                        : elective.status === VACATION_REJECTED
                          ? t('calendar.rejectedVacation')
                          : t('calendar.electiveVacation');
                const label = userName ?? fallbackLabel;

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
                    if (
                        vac.startDate &&
                        vac.endDate &&
                        keyIsWithinInterval(
                            dayKey,
                            vac.startDate,
                            vac.endDate
                        )
                    ) {
                        const vacUser = vac.userId;
                        const vacUserName =
                            typeof vacUser === 'object' ? vacUser.name : null;
                        const isPending =
                            vac.status === VACATION_PENDING;

                        events.push({
                            type: isPending
                                ? 'team-elective-pending'
                                : 'team-elective',
                            label:
                                vacUserName ||
                                (isPending
                                    ? t('calendar.pendingVacation')
                                    : t('calendar.electiveVacation')),
                            userName: vacUserName ?? undefined,
                            elective: vac,
                        });
                    }
                });
            }

            teamAuthorizedLeaves.forEach((leave) => {
                if (
                    leave.startDate &&
                    leave.endDate &&
                    keyIsWithinInterval(dayKey, leave.startDate, leave.endDate)
                ) {
                    events.push({
                        type: 'team-authorized-leave',
                        label:
                            leave.userName ||
                            leave.notes?.trim() ||
                            t('calendar.authorizedLeave'),
                        userName: leave.userName,
                        leave,
                    });
                }
            });

            authorizedLeaves.forEach((leave) => {
                if (
                    leave.startDate &&
                    leave.endDate &&
                    keyIsWithinInterval(dayKey, leave.startDate, leave.endDate)
                ) {
                    events.push({
                        type: 'authorized-leave',
                        label:
                            leave.notes?.trim() ||
                            t('calendar.authorizedLeave'),
                        leave,
                    });
                }
            });

            return events;
        },
        [
            vacations,
            teamVacations,
            authorizedLeaves,
            teamAuthorizedLeaves,
            showVacations,
            usersMap,
            t,
        ]
    );

    const getWorkSessionsForDay = useCallback(
        (dayKey: DateKey) => {
            if (!workSessions || !showWorkSessions) return null;

            const day = Number(dayKey.slice(8, 10));
            const dailyStat = workSessions.summary?.dailyStats?.[day];
            const sessionsList = workSessions.sessionsByDay?.[day];

            if (dailyStat && sessionsList && sessionsList.length > 0) {
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
        rows.flat().forEach((dayKey) => {
            if (!dayKey) return;
            map.set(dayKey, {
                date: dayKey,
                vacationEvents: getVacationsForDay(dayKey),
                workEvent: getWorkSessionsForDay(dayKey),
                isToday: dayKey === todayKey(),
                isWeekend: nonWorkingDays.includes(dowFromDateKey(dayKey)),
                // Grey out any day the user does not work: weekly non-working
                // days, company obligatory holidays, own approved vacations
                // and authorized leave.
                isNonWorking:
                    nonWorkingDays.includes(dowFromDateKey(dayKey)) ||
                    getVacationsForDay(dayKey).some(
                        (event) =>
                            event.type === 'obligatory' ||
                            event.type === 'elective-approved' ||
                            event.type === 'authorized-leave'
                    ),
            });
        });
        return map;
    }, [
        rows,
        getVacationsForDay,
        getWorkSessionsForDay,
        nonWorkingDays,
    ]);

    const handleDayHover = useCallback(
        (dayKey: DateKey, event: React.MouseEvent) => {
            setHoveredDay(dayKey);
            const rect = event.currentTarget.getBoundingClientRect();
            setTooltipPosition({
                x: rect.left + rect.width / 2,
                y: rect.top,
            });
        },
        []
    );

    const handleDayClick = useCallback(
        (dayKey: DateKey) => {
            setHoveredDay(null);
            setSelectedDay(dayKey);
            onDayClick?.(dayKey);
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
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    onClick={prevMonth}
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    aria-label={t('calendar.prevMonth')}
                >
                    <span aria-hidden>←</span>{' '}
                    <span className="hidden sm:inline">
                        {t('calendar.prevMonth')}
                    </span>
                </Button>

                <div className="min-w-0 flex-1 truncate px-1 text-center text-base font-semibold sm:text-lg">
                    {monthLabel}
                </div>

                <Button
                    onClick={nextMonth}
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    aria-label={t('calendar.nextMonth')}
                >
                    <span className="hidden sm:inline">
                        {t('calendar.nextMonth')}
                    </span>{' '}
                    <span aria-hidden>→</span>
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
                    {rows.flat().map((dayKey, idx) => {
                        if (!dayKey)
                            return (
                                <div
                                    key={idx}
                                    className="h-28 bg-white dark:bg-zinc-900"
                                    onMouseLeave={handleCalendarMouseLeave}
                                />
                            );

                        const dayData = daysData.get(dayKey)!;

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

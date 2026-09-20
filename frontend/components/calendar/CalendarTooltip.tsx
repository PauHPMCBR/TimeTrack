import { VacationEvent, WorkSessionEvent } from '@/types/calendar';
import {
    workedIntervals,
    workedIntervalTone,
    workedIntervalVisuals,
} from '@/lib/worked-intervals';
import { formatDateKey } from '@/lib/datetime';
import TimetableList from '@/components/autoTimetable/TimetableList';
import { Clock } from 'lucide-react';

interface CalendarTooltipProps {
    date: string;
    vacationEvents: VacationEvent[];
    workEvent: WorkSessionEvent | null;
    position: { x: number; y: number };
    locale: string;
    t: (key: string) => string;
    isModal?: boolean;
}

export function getVacationClass(type: VacationEvent['type']): string {
    switch (type) {
        case 'obligatory':
            return 'bg-blue-100 text-blue-800 border border-blue-200';
        case 'elective-approved':
            return 'bg-green-100 text-green-800 border border-green-200';
        case 'elective-pending':
            return 'bg-yellow-100 text-yellow-800 border border-dashed border-yellow-300';
        case 'elective-rejected':
            return 'bg-red-100 text-red-800 border border-dashed border-red-300';
        case 'authorized-leave':
            return 'bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/50';
        case 'team-elective':
        case 'team-authorized-leave':
            return 'bg-pink-100 text-pink-800 border border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800/50';
        case 'team-elective-pending':
            return 'bg-pink-50 text-pink-700 border border-dashed border-pink-300 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800/50';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

export function CalendarTooltip({
    date,
    vacationEvents,
    workEvent,
    position,
    locale,
    t,
    isModal = false,
}: CalendarTooltipProps) {
    const tooltipContent = (
        <>
            {/* Date Header */}
            <div className="font-semibold text-lg mb-3 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                {formatDateKey(date, locale, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })}
            </div>

            {/* Scrollable content container with fixed max height */}
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                {/* Vacations */}
                {vacationEvents.length > 0 && (
                    <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                            {t('calendar.vacations')}
                        </div>
                        <div className="space-y-2">
                            {vacationEvents.map((event, index) => (
                                <div
                                    key={index}
                                    className={`p-2 rounded text-sm ${getVacationClass(event.type)}`}
                                >
                                    <div className="font-medium flex items-center gap-1.5">
                                        {event.type === 'team-elective-pending' && (
                                            <Clock
                                                size={12}
                                                className="shrink-0"
                                            />
                                        )}
                                        {event.label}
                                    </div>
                                    {event.elective && (
                                        <div className="mt-1 space-y-1">
                                            {event.elective.reason && (
                                                <div className="text-xs">
                                                    <span className="font-medium">
                                                        {t('calendar.reason')}:
                                                    </span>{' '}
                                                    {event.elective.reason}
                                                </div>
                                            )}
                                            {event.elective.notes && (
                                                <div className="text-xs">
                                                    <span className="font-medium">
                                                        {t('calendar.notes')}:
                                                    </span>{' '}
                                                    {event.elective.notes}
                                                </div>
                                            )}
                                            {event.elective.approvedByName ||
                                            event.elective.approvedBy ? (
                                                <div className="text-xs">
                                                    <span className="font-medium">
                                                        {t(
                                                            'calendar.approvedBy'
                                                        )}
                                                        :
                                                    </span>{' '}
                                                    {event.elective
                                                        .approvedByName ||
                                                        event.elective
                                                            .approvedBy}
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Work Sessions */}
                {workEvent &&
                    workEvent.sessionsList &&
                    workEvent.sessionsList.length > 0 && (
                        <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                                {t('calendar.workSessions')} (
                                {workEvent.hoursWorked.toFixed(1)}h)
                            </div>
                            <TimetableList
                                timetable={workedIntervals(
                                    workEvent.sessionsList
                                )}
                                entryClassName={(entry) =>
                                    workedIntervalVisuals[
                                        workedIntervalTone(entry)
                                    ].className
                                }
                                entryTitle={(entry) =>
                                    entry.overtime
                                        ? t('admin.events.overtime')
                                        : entry.problem
                                          ? t('admin.events.intervalProblem')
                                          : undefined
                                }
                                entryIcon={(entry) =>
                                    workedIntervalVisuals[
                                        workedIntervalTone(entry)
                                    ].icon
                                }
                            />
                            {workEvent.sessionsList.some(
                                (session) => session.notes
                            ) && (
                                <ul className="mt-2 space-y-1">
                                    {workEvent.sessionsList
                                        .filter((session) => session.notes)
                                        .map((session, index) => (
                                            <li
                                                key={index}
                                                className="text-xs text-zinc-600 dark:text-zinc-300"
                                            >
                                                <span className="font-medium tabular-nums">
                                                    {session.time}
                                                </span>{' '}
                                                <span className="italic">
                                                    {session.notes}
                                                </span>
                                            </li>
                                        ))}
                                </ul>
                            )}
                        </div>
                    )}

                {/* No activities message */}
                {vacationEvents.length === 0 &&
                    (!workEvent ||
                        (workEvent.sessionsList ?? []).length === 0) && (
                        <div className="text-zinc-500 dark:text-zinc-400 text-sm italic">
                            {t('calendar.noActivities')}
                        </div>
                    )}
            </div>
        </>
    );

    if (isModal) {
        return tooltipContent;
    }

    return (
        <div
            className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg shadow-xl p-4 max-w-sm max-h-60 overflow-hidden pointer-events-none transition-opacity duration-200"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(-50%, -100%)',
            }}
        >
            {tooltipContent}
        </div>
    );
}

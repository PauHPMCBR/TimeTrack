import { VacationEvent, WorkSessionEvent } from '@/types/calendar';
import { TONE_CLASSES, type SemanticTone } from '@/lib/semanticColors';
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

const vacationEventTones: Record<VacationEvent['type'], SemanticTone> = {
    obligatory: 'obligatoryVacation',
    'elective-approved': 'electiveVacation',
    'elective-pending': 'pending',
    'elective-rejected': 'rejected',
    'authorized-leave': 'authorizedLeave',
    'team-elective': 'teamVacation',
    'team-elective-pending': 'teamPending',
    'team-authorized-leave': 'teamVacation',
};

export function getVacationClass(type: VacationEvent['type']): string {
    return TONE_CLASSES[vacationEventTones[type] ?? 'planned'].chip;
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

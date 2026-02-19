import { VacationEvent, WorkSessionEvent } from "@/types/calendar";

interface CalendarTooltipProps {
  date: Date;
  vacationEvents: VacationEvent[];
  workEvent: WorkSessionEvent | null;
  position: { x: number; y: number };
  locale: string;
  t: (key: string) => string;
  isModal?: boolean;
}

function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  }).format(date);
}

export function getVacationClass(type: VacationEvent['type']): string {
  switch (type) {
    case 'obligatory':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'elective-approved':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'elective-pending':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    case 'elective-rejected':
      return 'bg-red-100 text-red-800 border border-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function CalendarTooltip({ date, vacationEvents, workEvent, position, locale, t, isModal = false }: CalendarTooltipProps) {
  const tooltipContent = (
    <>
      {/* Date Header */}
      <div className="font-semibold text-lg mb-3 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
        {date.toLocaleDateString(locale, { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
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
                <div key={index} className={`p-2 rounded text-sm ${getVacationClass(event.type)}`}>
                  <div className="font-medium">{event.label}</div>
                  {event.elective && (
                    <div className="mt-1 space-y-1">
                      {event.elective.reason && (
                        <div className="text-xs">
                          <span className="font-medium">{t('calendar.reason')}:</span> {event.elective.reason}
                        </div>
                      )}
                      {event.elective.notes && (
                        <div className="text-xs">
                          <span className="font-medium">{t('calendar.notes')}:</span> {event.elective.notes}
                        </div>
                      )}
                      {event.elective.approvedBy && (
                        <div className="text-xs">
                          <span className="font-medium">{t('calendar.approvedBy')}:</span> {event.elective.approvedBy}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Work Sessions */}
        {workEvent && workEvent.sessionsList && workEvent.sessionsList.length > 0 && (
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              {t('calendar.workSessions')} ({workEvent.hoursWorked.toFixed(1)}h)
            </div>
            <div className="space-y-2">
              {workEvent.sessionsList
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((session, index) => (
                  <div key={index} className="p-2 bg-zinc-50 dark:bg-zinc-700/50 rounded border border-zinc-200 dark:border-zinc-600">
                    <div className="flex justify-between items-start">
                      <div className={`font-medium text-sm ${
                        session.type === 'check_in' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {session.type === 'check_in' ? t('calendar.checkIn') : t('calendar.checkOut')}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatTime(new Date(session.timestamp), locale)}
                      </div>
                    </div>
                    {(session.reason || session.notes) && (
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        {session.reason && <div>{session.reason}</div>}
                        {session.notes && <div className="italic">{session.notes}</div>}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* No activities message */}
        {vacationEvents.length === 0 && (!workEvent || workEvent.sessions === 0) && (
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

  // Regular hover tooltip (non-interactive with fixed max height)
  return (
    <div 
      className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg shadow-xl p-4 max-w-sm max-h-60 overflow-hidden pointer-events-none transition-opacity duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)'
      }}
    >
      {tooltipContent}
    </div>
  );
}
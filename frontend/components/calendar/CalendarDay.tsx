import { CalendarDayProps } from "@/types/calendar";

export function CalendarDay({ day, onHover, onClick, getVacationClass, t }: CalendarDayProps) {
  const { date, vacationEvents, workEvent, isToday, isWeekend } = day;

  const cellCls = [
    "min-h-28 p-2 text-sm flex flex-col relative group",
    "bg-white dark:bg-zinc-900",
    "transition-all duration-200",
    "hover:bg-zinc-50 hover:dark:bg-zinc-800/80 hover:shadow-md hover:z-10 hover:scale-105",
    isWeekend ? "bg-zinc-50 dark:bg-zinc-900/80" : "",
    isToday ? "outline outline-2 outline-indigo-500" : "",
    onClick ? "cursor-pointer" : "",
  ].join(" ");

  const handleClick = () => {
    // Clear hover state first, then call onClick
    onClick?.(date);
  };

  return (
    <div 
      className={cellCls}
      onMouseEnter={(e) => onHover(date, e)}
      onMouseLeave={() => {}}
      onClick={handleClick}
    >
      {/* Date header */}
      <div className="flex items-center justify-between mb-1">
        <div className={`text-xs ${isToday ? "font-bold text-indigo-600" : "text-zinc-500"}`}>
          {date.getDate()}
        </div>
      </div>

      {/* Vacation Events */}
      <div className="space-y-1 flex-1">
        {vacationEvents.map((event, eventIdx) => (
          <div
            key={eventIdx}
            className={`text-xs rounded px-1 py-0.5 ${getVacationClass(event.type)}`}
          >
            <div className="truncate">{event.label}</div>
          </div>
        ))}
      </div>

      {/* Work Sessions Summary */}
      {workEvent && (
        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="font-medium">
            {workEvent.hoursWorked.toFixed(1)}h
          </div>
          <div className="text-[10px]">
            {workEvent.sessions} {t('calendar.sessions')}
          </div>
        </div>
      )}

      {/* Hover indicator */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-zinc-300 dark:group-hover:border-zinc-600 rounded pointer-events-none transition-colors" />
    </div>
  );
}
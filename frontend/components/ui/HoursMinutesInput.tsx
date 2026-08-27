type Props = {
  value: number; // decimal hours, e.g. 7.5 = 7h 30m
  onChange: (decimalHours: number) => void;
  minHours?: number;
  disabled?: boolean;
};

const inputClass =
  "w-20 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-center text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400";

/**
 * Edits a decimal-hours value as two separate hour + minute fields.
 * The stored value stays a decimal (e.g. 7.5), only the input is split.
 */
export default function HoursMinutesInput({ value, onChange, minHours = 0, disabled }: Props) {
  let hours = Math.floor(value);
  let minutes = Math.round((value - hours) * 60);
  if (minutes === 60) {
    minutes = 0;
    hours += 1;
  }

  const setHours = (h: number) => onChange(Math.max(minHours, h) + minutes / 60);
  const setMinutes = (m: number) => onChange(hours + Math.min(59, Math.max(0, m)) / 60);

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        step="1"
        value={hours}
        disabled={disabled}
        onChange={(e) => setHours(parseInt(e.target.value, 10) || 0)}
        className={inputClass}
        aria-label="hours"
      />
      <span className="text-sm text-zinc-500">h</span>
      <input
        type="number"
        min="0"
        max="59"
        step="5"
        value={minutes}
        disabled={disabled}
        onChange={(e) => setMinutes(parseInt(e.target.value, 10) || 0)}
        className={inputClass}
        aria-label="minutes"
      />
      <span className="text-sm text-zinc-500">m</span>
    </div>
  );
}
import type { ReactNode } from 'react';

export type OptionPickerOption<T extends string> = {
    value: T;
    label: ReactNode;
};

type Props<T extends string> = {
    options: OptionPickerOption<T>[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
};

/**
 * Single-choice selector rendered as a row of equal buttons; the selected
 * option is highlighted.
 */
export default function OptionPicker<T extends string>({
    options,
    value,
    onChange,
    className = '',
}: Props<T>) {
    return (
        <div className={`grid grid-cols-2 gap-2 ${className}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                        value === option.value
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-500'
                            : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/50'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

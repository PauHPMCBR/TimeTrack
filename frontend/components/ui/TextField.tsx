import type { InputHTMLAttributes } from "react";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-600 disabled:dark:bg-zinc-800 disabled:dark:text-zinc-400 readOnly:cursor-not-allowed readOnly:bg-zinc-100 readOnly:text-zinc-600 readOnly:dark:bg-zinc-800 readOnly:dark:text-zinc-400";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  help?: string;
};

/** Labeled text/number/date/email/password input with the app's standard styling. */
export default function TextField({ label, help, className = "", id, ...input }: TextFieldProps) {
  const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>
      <input id={inputId} className={inputClass} {...input} />
      {help && <p className="mt-1.5 text-xs text-zinc-500">{help}</p>}
    </div>
  );
}
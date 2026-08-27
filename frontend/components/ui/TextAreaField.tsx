import type { TextareaHTMLAttributes } from "react";

const textareaClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400";

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  help?: string;
};

/** Labeled multi-line text area with the app's standard styling. */
export default function TextAreaField({
  label,
  help,
  className = "",
  id,
  ...input
}: TextAreaFieldProps) {
  const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>
      <textarea id={inputId} className={textareaClass} {...input} />
      {help && <p className="mt-1.5 text-xs text-zinc-500">{help}</p>}
    </div>
  );
}
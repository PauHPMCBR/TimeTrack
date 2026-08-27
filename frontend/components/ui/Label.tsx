import type { LabelHTMLAttributes } from "react";

/** Standard form label used across the app. */
export default function Label({
  className = "",
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100 ${className}`}
      {...rest}
    />
  );
}
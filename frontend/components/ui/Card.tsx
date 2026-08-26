import type { HTMLAttributes } from "react";

export default function Card({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
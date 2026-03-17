"use client";

import React from "react";
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "destructive" | "default";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
}

const variantStyles: Record<AlertVariant, string> = {
  default: "bg-zinc-50 text-zinc-900 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-100 dark:border-zinc-800",
  info: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30",
  success: "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/30",
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900/30",
  destructive: "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30",
};

const icons: Record<AlertVariant, React.ElementType> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

export function Alert({ 
  variant = "default", 
  title, 
  children, 
  onClose,
  className,
  ...props 
}: AlertProps) {
  const Icon = icons[variant];

  function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
  }

  return (
    <div 
      className={cn(
        "relative w-full rounded-lg border p-4 flex gap-3 items-start animate-in fade-in duration-200",
        variantStyles[variant],
        className
      )} 
      role="alert"
      {...props}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        {title && <h5 className="font-semibold leading-none tracking-tight mb-1">{title}</h5>}
        <div className="text-sm [&_p]:leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button 
          onClick={onClose}
          className="ml-auto -mr-1 -mt-1 p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

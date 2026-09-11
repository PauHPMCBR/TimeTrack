'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StepperNavProps {
    onPrev: () => void;
    onNext: () => void;
    prevDisabled?: boolean;
    nextDisabled?: boolean;
    children: ReactNode;
    className?: string;
    centerClassName?: string;
}

export default function StepperNav({
    onPrev,
    onNext,
    prevDisabled,
    nextDisabled,
    children,
    className = '',
    centerClassName = '',
}: StepperNavProps) {
    const buttonClass =
        'shrink-0 rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';

    return (
        <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
            <button
                onClick={onPrev}
                disabled={prevDisabled}
                className={buttonClass}
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            <div
                className={`min-w-0 flex-1 px-1 text-center text-sm font-semibold text-zinc-900 dark:text-white ${centerClassName}`}
            >
                {children}
            </div>
            <button
                onClick={onNext}
                disabled={nextDisabled}
                className={buttonClass}
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}

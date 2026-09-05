'use client';

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({
    open,
    title,
    subtitle,
    children,
    footer,
    onClose,
}: {
    open: boolean;
    title: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
}) {
    if (!open || typeof document === 'undefined') return null;

    // Portal to <body> so position:fixed is viewport-relative even when a parent
    // has a transform (e.g. the layout's fade-in animation would otherwise make
    // the modal cover only the content area, not the top toolbar).
    return createPortal(
        <div
            className="fixed inset-x-0 top-12 bottom-16 z-[100] flex justify-center overflow-y-auto"
            aria-modal="true"
            role="dialog"
        >
            {/* backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* content – constrained between header (h-12) and bottom nav (h-16) */}
            <div className="relative z-10 flex w-full max-w-md flex-col mx-4 my-auto max-h-full rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-semibold">{title}</h3>
                        {subtitle && (
                            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        aria-label="Tanca"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {children}
                </div>

                {footer && (
                    <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

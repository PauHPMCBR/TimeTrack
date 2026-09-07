'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { useI18n } from '@/app/i18n';
import { Eye, EyeOff } from 'lucide-react';
import { inputClass } from './TextField';

export type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    help?: string;
    id?: string;
};

/**
 * Standard password input with a show/hide toggle. Reuse everywhere a password
 * is entered (login, registration, reset, profile, admin) so the look and the
 * reveal behaviour stay consistent.
 *
 * Why the toggle does NOT use React's onClick:
 * React 17+ attaches ONE delegated listener per event type on the root
 * container. On some real mobile browsers that delegated dispatch never runs —
 * most commonly on Firefox Android with password-manager extensions, whose
 * Xray-wrapped nodes make React's getEventTarget/getClosestInstanceFromNode
 * throw "Permission denied to access property ..." — so onClick handlers
 * simply never fire, while the same button works fine in desktop emulators.
 * Attaching a native click listener directly to the button element bypasses
 * React's delegated system entirely and keeps the toggle working there.
 * A pre-hydration bridge in app/layout.tsx additionally covers taps that land
 * before React hydrates (slow phones running the dev server).
 */
export default function PasswordField({
    label,
    help,
    className = '',
    id,
    ...input
}: PasswordFieldProps) {
    const { t } = useI18n();
    const [show, setShow] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const autoId = useId();
    const inputId = id ?? autoId;

    useEffect(() => {
        const button = buttonRef.current;
        if (!button) return;

        // Tell the pre-hydration bridge to stop handling this button: from now
        // on the listener below owns it. If a tap already revealed the password
        // before hydration, keep that state in React so a re-render doesn't
        // silently hide it again.
        button.dataset.hydrated = '1';
        if (button.dataset.preRevealed === '1') {
            setShow(true);
            delete button.dataset.preRevealed;
        }

        const toggle = (event: Event) => {
            // Capture phase + stopPropagation keeps this independent of (and
            // shielded from) whatever else is listening up the tree.
            event.preventDefault();
            event.stopPropagation();
            setShow((s) => !s);
        };

        button.addEventListener('click', toggle, { capture: true });
        return () =>
            button.removeEventListener('click', toggle, { capture: true });
    }, []);

    return (
        <div className={className}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    id={inputId}
                    type={show ? 'text' : 'password'}
                    className={`${inputClass} pr-12`}
                    {...input}
                />
                {/* Full-height, 48px-wide touch target: a tiny icon-only button
                    is nearly impossible to hit on phones (the tap lands on the
                    input instead, which opens the keyboard over the button).
                    The extra right padding (pr-12) also leaves room for
                    password-manager inline icons, so ours never sits under
                    theirs. */}
                <button
                    ref={buttonRef}
                    type="button"
                    data-password-toggle=""
                    data-password-target={inputId}
                    aria-label={
                        show ? t('common.password.hide') : t('common.password.show')
                    }
                    aria-pressed={show}
                    className="absolute inset-y-0 right-0 z-10 flex w-12 touch-manipulation items-center justify-center rounded-r-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:active:bg-zinc-700"
                >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            {help && <p className="mt-1.5 text-xs text-zinc-500">{help}</p>}
        </div>
    );
}

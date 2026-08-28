'use client';

import { useState } from 'react';
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

    const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

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
                    className={`${inputClass} pr-10`}
                    {...input}
                />
                <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={
                        show ? t('common.password.hide') : t('common.password.show')
                    }
                    className="absolute inset-y-0 right-2 my-auto rounded px-1.5 text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
            {help && <p className="mt-1.5 text-xs text-zinc-500">{help}</p>}
        </div>
    );
}
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'soft' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary:
        'border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    soft: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30',
    ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50',
};

const sizes: Record<Size, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
};

export default function Button({
    variant = 'primary',
    size = 'md',
    className = '',
    type = 'button',
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
}) {
    return (
        <button
            type={type}
            className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
            {...rest}
        />
    );
}

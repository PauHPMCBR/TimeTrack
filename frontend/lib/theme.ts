import { useEffect, useState } from 'react';

export type ThemeFlavor = 'latte' | 'frappe' | 'macchiato' | 'mocha';

export const THEME_FLAVORS: ThemeFlavor[] = [
    'latte',
    'frappe',
    'macchiato',
    'mocha',
];

export function getThemeFlavor(): ThemeFlavor {
    if (typeof document === 'undefined') return 'latte';
    const v = document.documentElement.getAttribute('data-theme');
    return v && (THEME_FLAVORS as string[]).includes(v)
        ? (v as ThemeFlavor)
        : 'latte';
}

export function applyTheme(theme: ThemeFlavor) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme !== 'latte');
}

export function useThemeFlavor(): ThemeFlavor {
    const [flavor, setFlavor] = useState<ThemeFlavor>(getThemeFlavor);

    useEffect(() => {
        const update = () => setFlavor(getThemeFlavor());
        update();
        const observer = new MutationObserver(update);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });
        window.addEventListener('storage', update);
        return () => {
            observer.disconnect();
            window.removeEventListener('storage', update);
        };
    }, []);

    return flavor;
}

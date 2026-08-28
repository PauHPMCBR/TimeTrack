export type ThemeFlavor = 'latte' | 'frappe' | 'macchiato' | 'mocha';

export const DEFAULT_THEME_FLAVOR: ThemeFlavor = 'latte';
// Legacy "dark" theme value maps to mocha (kept for users who set it before
// flavors existed).
export const DARK_THEME_FLAVOR: ThemeFlavor = 'mocha';

export const THEME_FLAVORS: ThemeFlavor[] = [
    'latte',
    'frappe',
    'macchiato',
    'mocha',
];

export function getThemeFlavor(): ThemeFlavor {
    if (typeof document === 'undefined') return DEFAULT_THEME_FLAVOR;
    const v = document.documentElement.getAttribute('data-theme');
    return v && (THEME_FLAVORS as string[]).includes(v)
        ? (v as ThemeFlavor)
        : DEFAULT_THEME_FLAVOR;
}

export function applyTheme(theme: ThemeFlavor) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme !== DEFAULT_THEME_FLAVOR);
}

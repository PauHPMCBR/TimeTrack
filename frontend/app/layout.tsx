import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import I18nProvider from './i18n';
import { NotificationProvider } from '@/context/NotificationContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ApiNotificationManager } from '@/components/ApiNotificationManager';
import { APP_NAME, FAVICON_URL } from '@/lib/brand';
import {
    DARK_THEME_FLAVOR,
    DEFAULT_THEME_FLAVOR,
    THEME_FLAVORS,
} from '@/lib/theme';
import { THEME_KEY } from '@/lib/storage';

const inter = Inter({ subsets: ['latin'] });
const sora = Sora({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
    title: APP_NAME,
    description: 'Employee time tracking application',
    icons: {
        icon: [{ url: FAVICON_URL ?? '/favicon.ico', sizes: 'any' }],
    },
};

const themeInitScript = `
  try {
    var _theme = localStorage.getItem('${THEME_KEY}') || '${DEFAULT_THEME_FLAVOR}';
    if (_theme === 'dark') _theme = '${DARK_THEME_FLAVOR}';
    else if (_theme === 'light') _theme = '${DEFAULT_THEME_FLAVOR}';
    var _valid = ${JSON.stringify(THEME_FLAVORS)}.indexOf(_theme) !== -1;
    if (!_valid) _theme = '${DEFAULT_THEME_FLAVOR}';
    var _root = document.documentElement;
    _root.setAttribute('data-theme', _theme);
    _root.classList.toggle('dark', _theme !== '${DEFAULT_THEME_FLAVOR}');
  } catch (_) {}
`;

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ca" suppressHydrationWarning className={sora.variable}>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body
                className={`${inter.className} min-h-dvh antialiased
        bg-gradient-to-b from-zinc-50 to-white text-zinc-900
        dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100`}
            >
                <I18nProvider>
                    <NotificationProvider>
                        <ApiNotificationManager />
                        <ErrorBoundary>
                            <Suspense fallback={null}>{children}</Suspense>
                        </ErrorBoundary>
                    </NotificationProvider>
                </I18nProvider>
            </body>
        </html>
    );
}

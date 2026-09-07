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

// Pre-hydration password-reveal bridge.
// On slow phones a tap on the eye toggle can land before React hydrates
// (handlers not attached yet → tap silently lost). This capture-phase
// listener runs as soon as the HTML parses and toggles the input directly.
// Once the PasswordField mounts it sets data-hydrated="1" on its button and
// this bridge stops touching it, so the two never double-toggle.
const passwordRevealBridgeScript = `
  (function () {
    if (window.__ttRevealBridge) return;
    window.__ttRevealBridge = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('[data-password-toggle]');
      if (!btn || btn.getAttribute('data-hydrated') === '1') return;
      var input = document.getElementById(btn.getAttribute('data-password-target') || '');
      if (!input) return;
      e.preventDefault();
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.setAttribute('data-pre-revealed', input.type === 'text' ? '1' : '0');
    }, true);
  })();
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
                <script
                    dangerouslySetInnerHTML={{
                        __html: passwordRevealBridgeScript,
                    }}
                />
            </head>
            <body
                className={`${inter.className} min-h-svh antialiased
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

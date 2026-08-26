import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import I18nProvider from "./i18n";
import { NotificationProvider } from "@/context/NotificationContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApiNotificationManager } from "@/components/ApiNotificationManager";
import { APP_NAME, FAVICON_URL } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"] });
const sora = Sora({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Employee time tracking application",
  icons: {
    icon: [{ url: FAVICON_URL ?? "/favicon.ico", sizes: "any" }],
  },
};

// 🟢 Script per inicialitzar el tema abans de React (evita parpelleig)
const themeInitScript = `
  try {
    var _theme = localStorage.getItem('theme') || 'latte';
    if (_theme === 'dark') _theme = 'mocha';
    else if (_theme === 'light') _theme = 'latte';
    var _valid = ['latte', 'frappe', 'macchiato', 'mocha'].indexOf(_theme) !== -1;
    if (!_valid) _theme = 'latte';
    var _root = document.documentElement;
    _root.setAttribute('data-theme', _theme);
    _root.classList.toggle('dark', _theme !== 'latte');
  } catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
              {children}
            </ErrorBoundary>
          </NotificationProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
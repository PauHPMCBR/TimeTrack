import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import I18nProvider from "./i18n";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TimeTrack App",
  description: "Employee time tracking application",
};

// 🟢 Script per inicialitzar el tema abans de React (evita parpelleig)
const themeInitScript = `
  try {
    const theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.className} min-h-dvh antialiased
        bg-gradient-to-b from-zinc-50 to-white text-zinc-900
        dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100`}
      >
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
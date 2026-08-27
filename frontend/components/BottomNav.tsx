'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    CheckCircle,
    History,
    CalendarDays,
    User,
    CalendarOff,
    LayoutDashboard,
} from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { User as UserType } from '@/types';

export default function BottomNav() {
    const pathname = usePathname();
    const { t } = useI18n();
    const [user, setUser] = useState<UserType | null>(null);

    useEffect(() => {
        apiClient.getCurrentUser().then((u) => setUser(u || null));
    }, []);

    const isAdmin = user?.role === 'admin';

    const items = [
        { href: '/check-in', label: t('tabs.checkin'), Icon: CheckCircle },
        { href: '/history', label: t('tabs.history'), Icon: History },
        { href: '/vacations', label: t('tabs.vacations'), Icon: CalendarOff },
        { href: '/calendar', label: t('tabs.calendar'), Icon: CalendarDays },
        { href: '/profile', label: t('tabs.profile'), Icon: User },
    ];

    if (isAdmin) {
        items.push({
            href: '/admin',
            label: t('tabs.admin'),
            Icon: LayoutDashboard,
        });
    }

    const cols = items.length;

    return (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/70 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
            <div
                className="mx-auto grid h-16 max-w-3xl"
                style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                }}
            >
                {items.map(({ href, label, Icon }) => {
                    const active =
                        href === '/admin'
                            ? pathname === '/admin' ||
                              pathname.startsWith('/admin/')
                            : pathname === href;
                    const cls = active
                        ? 'text-indigo-600'
                        : 'text-zinc-500 dark:text-zinc-400';
                    return (
                        <Link
                            key={href}
                            href={href}
                            className="flex flex-col items-center justify-center text-xs"
                            aria-label={label}
                        >
                            <Icon size={22} className={cls} />
                            <span className={`mt-1 scale-90 ${cls}`}>
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

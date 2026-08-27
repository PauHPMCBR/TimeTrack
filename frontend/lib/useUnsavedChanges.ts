'use client';

import { useEffect, useRef } from 'react';
import { useI18n } from '@/app/i18n';

/**
 * Guards a page against losing unsaved edits. Works for:
 *  - closing / reloading the tab (`beforeunload`)
 *  - browser back / forward (`history` guard slot + popstate)
 *  - in-app navigation via links (`<Link>`, bottom nav, back buttons — an
 *    anchor click is intercepted and confirmed before it navigates)
 *
 * Pass `isDirty`; while true, the guards are active.
 */
export function useUnsavedChanges(isDirty: boolean) {
    const { t } = useI18n();
    const dirtyRef = useRef(isDirty);
    dirtyRef.current = isDirty;

    useEffect(() => {
        if (!isDirty) return;

        const message = t('common.unsavedChangesConfirm');

        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', onBeforeUnload);

        const onDocumentClick = (e: MouseEvent) => {
            if (!(e.target instanceof Element)) return;
            const anchor = e.target.closest(
                'a[href]'
            ) as HTMLAnchorElement | null;
            if (!anchor) return;
            if (!anchor.getAttribute('href')) return;
            if (!window.confirm(message)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener('click', onDocumentClick, true);

        // Browser back/forward: keep a guard entry on top of the history stack and
        // ask before letting it pop.
        const onPopState = () => {
            if (window.confirm(message)) {
                window.history.go(-1);
            } else {
                window.history.pushState({ unsavedGuard: true }, '');
            }
        };
        window.addEventListener('popstate', onPopState);
        window.history.pushState({ unsavedGuard: true }, '');

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('click', onDocumentClick, true);
            window.removeEventListener('popstate', onPopState);
        };
    }, [isDirty, t]);
}

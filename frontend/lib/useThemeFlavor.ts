'use client';

import { useEffect, useState } from 'react';
import { getThemeFlavor, ThemeFlavor } from '@/lib/theme';

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

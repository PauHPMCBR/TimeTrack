'use client';

import { useCallback, useState } from 'react';

/**
 * Common "dirty" flag for forms with a save feature. `markDirty()` is called on
 * the first user change and stays true afterwards (so the unsaved-changes guard
 * never triggers when the form was only loaded/populated). Call `resetDirty()`
 * after a successful save or when (re)loading.
 */
export function useDirty() {
    const [dirty, setDirty] = useState(false);
    const markDirty = useCallback(() => setDirty(true), []);
    const resetDirty = useCallback(() => setDirty(false), []);
    return { dirty, markDirty, resetDirty };
}

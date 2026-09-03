'use client';

import { useCallback, useEffect, useState } from 'react';

type UsePersistedStateOptions<T> = {
    serialize?: (value: T) => string;
    deserialize?: (raw: string) => T;
};

export function usePersistedState<T>(
    key: string,
    defaultValue: T | (() => T),
    options?: UsePersistedStateOptions<T>
): [T, (value: T | ((prev: T) => T)) => void] {
    const serialize = options?.serialize ?? JSON.stringify;
    const deserialize = options?.deserialize ?? JSON.parse;

    const [value, setValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return defaultValue instanceof Function ? defaultValue() : defaultValue;
        }
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                return deserialize(stored);
            }
        } catch {
            // ignore corrupt data
        }
        return defaultValue instanceof Function ? defaultValue() : defaultValue;
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, serialize(value));
        } catch {
            // ignore quota errors
        }
    }, [key, value, serialize]);

    const setPersisted = useCallback(
        (updater: T | ((prev: T) => T)) => {
            setValue((prev) => {
                const next = updater instanceof Function ? updater(prev) : updater;
                return next;
            });
        },
        []
    );

    return [value, setPersisted];
}

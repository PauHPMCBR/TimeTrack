'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

interface AvatarProps {
    userId: string;
    version?: string | null;
    alt?: string;
    fallback?: string;
    className?: string;
    fallbackClassName?: string;
}

// Renders a user's profile picture, fetched with the auth token (an <img>
// src can't send the JWT) and shown via a blob URL. Falls back to an initials
// circle while loading, when there is no avatar, or on fetch failure.
export default function Avatar({
    userId,
    version,
    alt = 'avatar',
    fallback = 'U',
    className = 'h-8 w-8 rounded-full object-cover',
    fallbackClassName = 'h-8 w-8 rounded-full bg-zinc-900 text-white',
}: AvatarProps) {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        let cancelled = false;

        if (!version) {
            setSrc(null);
            return;
        }

        setSrc(null);
        apiClient.getAvatarBlob(userId, version).then((blob) => {
            if (cancelled || !blob) return;
            objectUrl = URL.createObjectURL(blob);
            if (!cancelled) setSrc(objectUrl);
        });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [userId, version]);

    if (!src) {
        return (
            <div
                className={`grid shrink-0 place-items-center overflow-hidden ${fallbackClassName}`}
            >
                <span className="font-bold">{fallback}</span>
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={`shrink-0 overflow-hidden ${className}`}
        />
    );
}

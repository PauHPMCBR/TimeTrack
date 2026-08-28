const PUBLIC_USER_FIELDS = [
    '_id',
    'id',
    'name',
    'email',
    'role',
    'groups',
    'registered',
    'dni',
    'expectedWorkHours',
    'workDays',
    'avatar',
    'autoTimetable',
] as const;

/**
 * Returns a copy of a user document safe to send to clients:
 * strips password hash, registration tokens, lockout state and internals.
 */
export function toPublicUser<T extends Record<string, unknown>>(
    user: T | null
): Partial<T> | null {
    if (!user) return null;
    const source =
        typeof (user as { toObject?: unknown }).toObject === 'function'
            ? (
                  user as unknown as { toObject(): Record<string, unknown> }
              ).toObject()
            : user;
    const result: Record<string, unknown> = {};
    for (const field of PUBLIC_USER_FIELDS) {
        if (field in source && source[field] !== undefined) {
            result[field] = source[field];
        }
    }
    return result as Partial<T>;
}

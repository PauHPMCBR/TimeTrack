// In-process per-user mutex. The check-then-insert guards in the work-session
// endpoints are racy (two concurrent requests can both observe "no open
// check-in"); this backend runs as a single instance per company, so an
// in-process lock fully serializes a user's work-session writes. (If the
// backend is ever scaled horizontally, replace this with a DB-level lock.)
const userLocks = new Map<string, Promise<unknown>>();

export async function withUserLock<T>(
    userId: string,
    fn: () => Promise<T>
): Promise<T> {
    const prev = userLocks.get(userId) ?? Promise.resolve();
    const run = prev.catch(() => {}).then(fn);
    userLocks.set(userId, run);
    try {
        return await run;
    } finally {
        if (userLocks.get(userId) === run) userLocks.delete(userId);
    }
}
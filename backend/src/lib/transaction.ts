import mongoose from 'mongoose';

/**
 * Runs `fn` inside a MongoDB transaction (with retries, as `withTransaction`
 * does). Multi-collection writes must go through here so a mid-way failure
 * rolls back atomically.
 *
 * Falls back to running `fn` without a session when there is no live
 * connection — e.g. the vitest suites, which mock the models and never connect
 * to a real MongoDB. In production (real connection) the transaction is used.
 */
export async function runInTransaction<T>(
    fn: (session: mongoose.ClientSession | null) => Promise<T>
): Promise<T> {
    // Only attempt a real transaction when actually connected (readyState 1).
    // In tests the models are mocked and no connection exists, so fall back to
    // running `fn` without a session.
    if (mongoose.connection.readyState !== 1) {
        return fn(null);
    }

    let session: mongoose.ClientSession | null = null;
    try {
        session = await mongoose.startSession();
    } catch {
        return fn(null);
    }

    try {
        let result: T;
        await session.withTransaction(async () => {
            result = await fn(session);
        });
        return result!;
    } finally {
        await session.endSession();
    }
}

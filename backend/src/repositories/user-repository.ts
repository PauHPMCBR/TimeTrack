import { User } from '@/models';

// Soft-deleted users never appear in listings or lookups; their data stays in
// the DB for restore. Spread this instead of hand-writing the rule.
export const notDeleted = { deleted: { $ne: true } } as const;

// Email uniqueness is per non-deleted user. `registered` restricts to
// activated accounts; `excludeId` is for update-style uniqueness checks.
export const findActiveByEmail = (
    email: string,
    options: {
        registered?: boolean;
        excludeId?: string | { toString(): string };
    } = {}
) =>
    User.findOne({
        email,
        ...(options.registered ? { registered: true } : {}),
        ...(options.excludeId ? { _id: { $ne: options.excludeId } } : {}),
        ...notDeleted,
    });

// Deleted users are treated as not found by every consumer.
export const findActiveById = async (id: string) => {
    const user = await User.findById(id);
    return user && !user.deleted ? user : null;
};

// Non-deleted user listing with an optional extra filter.
export const listActive = (filter: Record<string, unknown> = {}) =>
    User.find({ ...filter, ...notDeleted });

// Number of active users among the given ids (group-membership validation).
export const countActiveByIds = (ids: string[]) =>
    User.countDocuments({ _id: { $in: ids }, ...notDeleted });

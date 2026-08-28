import { User } from '@/models';

export interface ResolvedUser {
    _id: string;
    name: string;
    email: string;
}

interface VacationLike {
    userId?: string;
    approvedBy?: string;
}

export type ResolvedVacation<T extends VacationLike> = T & {
    approvedByName?: string;
};

export interface ResolveVacationNamesOptions {
    /** Replace `userId` with its populated { _id, name, email } object. */
    populateUserId?: boolean;
}

/**
 * Attaches display names to vacation rows by resolving the stored user ids
 * (`userId`, `approvedBy`) against the users collection. Used by every
 * endpoint that returns vacations to the calendar, so name resolution (and
 * the approver's name) stays consistent everywhere instead of being
 * duplicated per endpoint.
 */
export async function resolveVacationNames<
    T extends VacationLike & Record<string, unknown>
>(
    vacations: T[],
    options: ResolveVacationNamesOptions = {}
): Promise<ResolvedVacation<T>[]> {
    const neededIds = new Set<string>();
    vacations.forEach((v) => {
        if (options.populateUserId && v.userId) neededIds.add(v.userId);
        if (v.approvedBy) neededIds.add(v.approvedBy);
    });

    if (neededIds.size === 0) return vacations;

    const users = (await User.find({ _id: { $in: Array.from(neededIds) } })
        .select('name email')
        .lean()) as unknown as Array<{
        _id: unknown;
        name: string;
        email: string;
    }>;

    const byId: Record<string, ResolvedUser> = {};
    users.forEach((u) => {
        const id = String(u._id);
        byId[id] = { _id: id, name: u.name, email: u.email };
    });

    return vacations.map((v) => {
        const out: Record<string, unknown> = { ...v };
        if (v.approvedBy && byId[v.approvedBy]) {
            out.approvedByName = byId[v.approvedBy].name;
        }
        if (options.populateUserId && v.userId && byId[v.userId]) {
            out.userId = byId[v.userId];
        }
        return out as ResolvedVacation<T>;
    });
}
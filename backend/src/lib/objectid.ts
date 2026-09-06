// Compares two id-ish values (ObjectId | string) by string form, so callers
// never hand-roll `.toString()` chains. Null/undefined never matches.
export const sameId = (a: unknown, b: unknown): boolean =>
    a != null && b != null && a.toString() === b.toString();

// Whether two group-id lists overlap (shared membership).
export const shareGroup = (
    a: { toString(): string }[] | undefined,
    b: { toString(): string }[] | undefined
): boolean => {
    if (!a?.length || !b?.length) return false;
    const bIds = new Set(b.map((g) => g.toString()));
    return a.some((g) => bIds.has(g.toString()));
};

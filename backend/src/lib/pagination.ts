// Shared pagination for the admin work-sessions report and the personal
// history view. Without a `limit` the full row set is returned and the
// pagination metadata is omitted from the response.
export const parsePagination = (query: Record<string, unknown>) => ({
    limit: query.limit !== undefined ? Number(query.limit) : undefined,
    offset: query.offset !== undefined ? Number(query.offset) : 0,
});

export const paginateRows = <T>(
    rows: T[],
    limit: number | undefined,
    offset: number
) => {
    const total = rows.length;
    const pageRows =
        limit !== undefined ? rows.slice(offset, offset + limit) : rows;
    return { total, pageRows };
};

import { NextApiResponse } from 'next';
import { z } from 'zod';
import dbConnect from '@/lib/mongodb';
import {
    AuthRequest,
    authenticateToken,
    requireInGroupOrAdmin,
    requireRole,
    requireSameGroupOrAdmin,
    requireSelfOrAdmin,
} from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import {
    responseErrorDelete,
    responseErrorGet,
    responseErrorMethodNotAllowed,
    responseErrorPost,
    responseErrorPut,
} from '@/lib/response-error-generator';
import {
    runValidation,
    validateRequestBody,
    validateQueryParams,
} from '@/lib/validation';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Which auth guard wraps the handler. All of them run after token
// verification (same as the hand-written wrappers they replace); 'none' is
// for public routes (login, register, password reset).
type Guard =
    | 'none'
    | 'auth'
    | 'admin'
    | 'selfOrAdmin'
    | 'sameGroupOrAdmin'
    | 'inGroupOrAdmin';

interface ApiOptions<SBody extends z.ZodTypeAny, SQuery extends z.ZodTypeAny> {
    method: Method;
    guard?: Guard;
    body?: SBody;
    query?: SQuery;
}

export type ApiHandler<
    SBody extends z.ZodTypeAny = z.ZodTypeAny,
    SQuery extends z.ZodTypeAny = z.ZodTypeAny,
> = (
    req: AuthRequest,
    res: NextApiResponse,
    ctx: {
        body: SBody extends z.ZodTypeAny ? z.infer<SBody> : undefined;
        query: SQuery extends z.ZodTypeAny ? z.infer<SQuery> : undefined;
    }
) => unknown | Promise<unknown>;

const methodError = {
    GET: responseErrorGet,
    POST: responseErrorPost,
    PUT: responseErrorPut,
    DELETE: responseErrorDelete,
} as const;

function applyGuard(
    guard: Guard,
    inner: (req: AuthRequest, res: NextApiResponse) => unknown
) {
    switch (guard) {
        case 'none':
            return inner;
        case 'admin':
            return requireRole([ADMIN_ROLE], inner);
        case 'selfOrAdmin':
            return requireSelfOrAdmin(inner);
        case 'sameGroupOrAdmin':
            return requireSameGroupOrAdmin(inner);
        case 'inGroupOrAdmin':
            return requireInGroupOrAdmin(inner);
        default:
            return authenticateToken(inner);
    }
}

// Method check + Zod validation + dbConnect + centralized error mapping.
// Guard composition happens outside so token verification and the live-user
// fetch (which tests count on) behave exactly as before.
export function withApi<
    SBody extends z.ZodTypeAny = z.ZodTypeAny,
    SQuery extends z.ZodTypeAny = z.ZodTypeAny,
>(
    options: ApiOptions<SBody, SQuery>,
    handler: ApiHandler<SBody, SQuery>
): (req: AuthRequest, res: NextApiResponse) => unknown {
    // Two-arg shape so the auth guards can wrap it unchanged; the parsed
    // body/query are handed to the user handler via a closure-built ctx.
    const inner = async (req: AuthRequest, res: NextApiResponse) => {
        if (req.method !== options.method) {
            return responseErrorMethodNotAllowed(res);
        }

        if (
            options.body &&
            !(await runValidation(
                validateRequestBody(options.body as z.ZodTypeAny),
                req,
                res
            ))
        )
            return;

        if (
            options.query &&
            !(await runValidation(
                validateQueryParams(options.query as z.ZodTypeAny),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const ctx = {
                body: req.body as z.infer<SBody>,
                query: req.query as z.infer<SQuery>,
            };
            return await handler(req, res, ctx);
        } catch (error) {
            console.error(
                `${options.method} ${req.url ?? ''} handler error:`,
                error
            );
            return methodError[options.method](res);
        }
    };

    return applyGuard(options.guard ?? 'auth', inner);
}
import { responseErrorValidation } from '@/lib/response-error-generator';
import { NextApiRequest, NextApiResponse } from 'next';
import { ZodSchema } from 'zod/v3';

type Next = (err?: unknown) => void;

function toErrorMessages(errors: unknown[]): string[] {
    return errors.map((e) => {
        if (typeof e === 'string') return e;
        if (e && typeof e === 'object' && 'message' in e)
            return String((e as { message: unknown }).message);
        return 'Validation failed';
    });
}

export const validateRequestBody = (schema: ZodSchema) => {
    return (req: NextApiRequest, res: NextApiResponse, next: Next) => {
        try {
            if (typeof req.body === 'string') {
                try {
                    req.body = JSON.parse(req.body);
                } catch {
                    responseErrorValidation(
                        res,
                        ['Invalid JSON in request body'],
                        'Request body must be valid JSON'
                    );
                    return next();
                }
            }

            req.body = schema.parse(req.body);
            return next();
        } catch (error) {
            const zodError = error as { errors?: unknown[]; message?: string };
            responseErrorValidation(
                res,
                toErrorMessages(zodError.errors ?? []),
                zodError.message ?? 'Validation failed'
            );
            return next();
        }
    };
};

export const validateQueryParams = (schema: ZodSchema) => {
    return (req: NextApiRequest, res: NextApiResponse, next: Next) => {
        try {
            req.query = schema.parse(req.query);
            return next();
        } catch (error) {
            const zodError = error as { errors?: unknown[]; message?: string };
            responseErrorValidation(
                res,
                toErrorMessages(zodError.errors ?? []),
                zodError.message ?? 'Validation failed'
            );
            return next();
        }
    };
};

/**
 * Runs a validation middleware and resolves when it's done. Returns false when
 * the middleware already sent an error response, so handlers can early-return.
 */
export async function runValidation(
    middleware: (req: NextApiRequest, res: NextApiResponse, next: Next) => void,
    req: NextApiRequest,
    res: NextApiResponse
): Promise<boolean> {
    await new Promise((resolve) => middleware(req, res, () => resolve(true)));
    return !res.headersSent;
}

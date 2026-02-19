import { NextApiResponse } from "next";
import type { ErrorCode, IllegalAction, IncorrectParameter, IncorrectParameterReason } from "shared/src/types/response-errors";

export function responseError(res: NextApiResponse, code: number, error: ErrorCode, details?: any) {
    return res.status(code).json({
        error: error,
        details: details || {}
    });
}

export function responseErrorMethodNotAllowed(res: NextApiResponse) {
    return responseError(res, 405, 'MethodNotAllowed');
}

export function responseErrorGet(res: NextApiResponse, details?: any) {
    return responseError(res, 500, 'GetError', details);
}

export function responseErrorPost(res: NextApiResponse, details?: any) {
    return responseError(res, 500, 'PostError', details);
}

export function responseErrorPut(res: NextApiResponse, details?: any) {
    return responseError(res, 500, 'PutError', details);
}

export function responseErrorDelete(res: NextApiResponse, details?: any) {
    return responseError(res, 500, 'DeleteError', details);
}

export function responseErrorEntryNotFound(res: NextApiResponse, entryName?: string) {
    return responseError(res, 404, 'EntryNotFound', {
        entry: entryName || null,
    });
}

export function responseErrorInvalidCredentials(res: NextApiResponse) {
    return responseError(res, 401, 'InvalidCredentials');
}

export function responseErrorAccountBlocked(res: NextApiResponse, blockedUntil: Date | null, retryAfterSeconds?: number) {
    return responseError(res, 500, 'AccountBlocked', {
        blockedUntil: blockedUntil?.toISOString() || null,
        retryAfterSeconds: retryAfterSeconds || null,
    });
}

export function responseErrorInvalidRegisterToken(res: NextApiResponse) {
    return responseError(res, 400, 'InvalidRegisterToken');
}

export function responseErrorIncorrectParameter(res: NextApiResponse, parameter?: IncorrectParameter, reasons?: IncorrectParameterReason[]) {
    return responseError(res, 400, 'IncorrectParameter', {
        incorrectParameter: parameter || null,
        reasons: reasons || [],
    });
}

export function responseErrorMissingParameter(res: NextApiResponse, parameter?: IncorrectParameter) {
    return responseError(res, 400, 'MissingParameter', {
        missingParameter: parameter || null,
    });
}

export function responseErrorValidation(res: NextApiResponse, errors?: string[], message?: string) {
    return responseError(res, 400, 'ValidationError', {
        errors: errors || null,
        message: message || null,
    });
}

export function responseErrorIllegalAction(res: NextApiResponse, illegalAction?: IllegalAction) {
    return responseError(res, 400, 'IllegalAction', {
        illegalAction: illegalAction || null,
    });
}
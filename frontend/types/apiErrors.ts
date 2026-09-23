import { ErrorCode } from 'shared/src/types/response-errors';

export type ErrorDetails = {
    incorrectParameter?: string;
    reasons?: string[];
    missingParameter?: string;
    errors?: (string | { message?: string; code?: string })[];
    message?: string;
    entry?: string;
    blockedUntil?: string;
    retryAfterSeconds?: number;
    [key: string]: unknown;
};

export type ApiResponse<T> = {
    data?: T;
    error?: ErrorCode;
    details?: ErrorDetails;
};

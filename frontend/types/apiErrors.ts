import { ErrorCode } from 'shared/src/types/response-errors';

export interface IncorrectParameterError {
    error: 'IncorrectParameter';
    details: {
        incorrectParameter: string;
        reasons?: string[];
    };
}

export interface MissingParameterError {
    error: 'MissingParameter';
    details: {
        missingParameter: string;
    };
}

export interface ValidationError {
    error: 'ValidationError';
    details: {
        errors?: (string | { message?: string; code?: string })[];
        message?: string;
    };
}

export interface AccountBlockedError {
    error: 'AccountBlocked';
    details: {
        blockedUntil?: string;
        retryAfterSeconds?: number;
    };
}

export interface EntryNotFoundError {
    error: 'EntryNotFound';
    details: {
        entry?: string;
    };
}

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

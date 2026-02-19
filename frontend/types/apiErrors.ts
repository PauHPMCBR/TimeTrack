import { ErrorCode } from "shared/src/types/response-errors";

export interface IncorrectParameterError {
  error: 'IncorrectParameter';
  details: {
    incorrectParameter: string;
    reasons?: string[];
  }
}

export interface MissingParameterError {
  error: 'MissingParameter';
  details: {
    missingParameter: string;
  }
}

export interface ValidationError {
  error: 'ValidationError';
  details: {
    errors?: string[];
    message?: string;
  }
}

export interface AccountBlockedError {
  error: 'AccountBlocked';
  details: {
    blockedUntil?: string;
    retryAfterSeconds?: number;
  }
}

export interface EntryNotFoundError {
  error: 'EntryNotFound';
  details: {
    entry?: string;
  }
}

export type ErrorResponseType = 
  | IncorrectParameterError
  | MissingParameterError
  | ValidationError
  | AccountBlockedError
  | EntryNotFoundError
  | { error: string; [key: string]: any };

export type ApiResponse<T> = {
  data?: T;
  error?: ErrorCode;
  details?: any;
};
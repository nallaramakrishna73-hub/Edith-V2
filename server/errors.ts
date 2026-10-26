export const ErrorCodes = {
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_AUTH_FAILED: 'AI_AUTH_FAILED',
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_BAD_RESPONSE: 'AI_BAD_RESPONSE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiErrorResponse {
  status: 'error';
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function formatError(code: ErrorCode, message: string): ApiErrorResponse {
  return {
    status: 'error',
    error: {
      code,
      message,
    },
  };
}

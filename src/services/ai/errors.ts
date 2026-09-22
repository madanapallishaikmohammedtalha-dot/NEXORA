/**
 * NEXORA AI Provider - Error Taxonomy & Normalization
 * Standardizes errors across disparate providers into predictable, user-friendly types.
 */

export type AIErrorCategory = 
  | 'authentication'
  | 'rate_limit'
  | 'model_unavailable'
  | 'network'
  | 'invalid_request'
  | 'service_unavailable'
  | 'unknown';

export interface AIErrorDetails {
  providerId: string;
  category: AIErrorCategory;
  userFacingMessage: string;
  recoveryAction: string;
  isRetryable: boolean;
  httpStatus?: number;
  originalError?: unknown;
}

/**
 * Base AI Provider Exception
 */
export class AIProviderError extends Error {
  public readonly providerId: string;
  public readonly category: AIErrorCategory;
  public readonly userFacingMessage: string;
  public readonly recoveryAction: string;
  public readonly isRetryable: boolean;
  public readonly httpStatus?: number;
  public readonly originalError?: unknown;

  constructor(details: AIErrorDetails) {
    super(details.userFacingMessage);
    this.name = 'AIProviderError';
    this.providerId = details.providerId;
    this.category = details.category;
    this.userFacingMessage = details.userFacingMessage;
    this.recoveryAction = details.recoveryAction;
    this.isRetryable = details.isRetryable;
    this.httpStatus = details.httpStatus;
    this.originalError = details.originalError;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when credentials are missing, invalid, expired, or forbidden
 */
export class AIAuthenticationError extends AIProviderError {
  constructor(providerId: string, message?: string, originalError?: unknown) {
    super({
      providerId,
      category: 'authentication',
      userFacingMessage: message || 'AI authentication failed. Your API key may be invalid, missing, or expired.',
      recoveryAction: 'Please verify your API key in Settings > AI Configuration or leave blank to use the offline engine.',
      isRetryable: false,
      httpStatus: 401,
      originalError,
    });
    this.name = 'AIAuthenticationError';
  }
}

/**
 * Thrown when rate limit or quota is exceeded
 */
export class AIRateLimitError extends AIProviderError {
  public readonly retryAfterSeconds?: number;

  constructor(providerId: string, retryAfterSeconds?: number, originalError?: unknown) {
    const timeHint = retryAfterSeconds ? ` Please wait ${retryAfterSeconds} seconds before retrying.` : ' Please wait a moment before retrying.';
    super({
      providerId,
      category: 'rate_limit',
      userFacingMessage: `AI request rate limit reached.${timeHint}`,
      recoveryAction: 'Wait briefly before issuing another request, or switch to the Offline Heuristic model in Settings.',
      isRetryable: true,
      httpStatus: 429,
      originalError,
    });
    this.name = 'AIRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Thrown when the requested model is deprecated, not found, or unsupported
 */
export class AIModelUnavailableError extends AIProviderError {
  public readonly requestedModel: string;

  constructor(providerId: string, model: string, originalError?: unknown) {
    super({
      providerId,
      category: 'model_unavailable',
      userFacingMessage: `The selected AI model "${model}" is currently unavailable or unsupported by ${providerId}.`,
      recoveryAction: 'Switch to the recommended default model (e.g., gemini-3.8-flash) or Offline Heuristic mode in Settings.',
      isRetryable: false,
      httpStatus: 404,
      originalError,
    });
    this.name = 'AIModelUnavailableError';
    this.requestedModel = model;
  }
}

/**
 * Thrown when network connection fails, times out, or host is unreachable
 */
export class AINetworkError extends AIProviderError {
  constructor(providerId: string, originalError?: unknown) {
    super({
      providerId,
      category: 'network',
      userFacingMessage: 'Unable to reach the AI service due to a network connectivity error.',
      recoveryAction: 'Check your internet connection or switch to the Offline Heuristic model to continue working offline.',
      isRetryable: true,
      httpStatus: 503,
      originalError,
    });
    this.name = 'AINetworkError';
  }
}

/**
 * Thrown when prompt exceeds context window or format is invalid
 */
export class AIInvalidRequestError extends AIProviderError {
  constructor(providerId: string, reason: string, originalError?: unknown) {
    super({
      providerId,
      category: 'invalid_request',
      userFacingMessage: `Invalid AI request: ${reason}`,
      recoveryAction: 'Shorten your prompt or reduce the size of attached context data.',
      isRetryable: false,
      httpStatus: 400,
      originalError,
    });
    this.name = 'AIInvalidRequestError';
  }
}

/**
 * Normalizes any caught exception into a typed AIProviderError
 */
export function normalizeProviderError(error: unknown, providerId: string, requestedModel?: string): AIProviderError {
  if (error instanceof AIProviderError) {
    return error;
  }

  const err = error as any;
  const message = (err?.message || String(error)).toLowerCase();
  const status = err?.status || err?.statusCode || err?.httpStatus;

  // 1. Authentication Errors
  if (
    status === 401 ||
    status === 403 ||
    message.includes('api key') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('permission_denied') ||
    message.includes('invalid credential')
  ) {
    return new AIAuthenticationError(providerId, 'Authentication error: Invalid or missing API key.', error);
  }

  // 2. Rate Limits & Quotas
  if (
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('resource_exhausted') ||
    message.includes('too many requests')
  ) {
    const retrySecMatch = message.match(/retry after (\d+)/i);
    const retrySec = retrySecMatch ? parseInt(retrySecMatch[1], 10) : undefined;
    return new AIRateLimitError(providerId, retrySec, error);
  }

  // 3. Model Unavailable / Deprecated
  if (
    status === 404 ||
    message.includes('not found') ||
    message.includes('model not found') ||
    message.includes('unsupported model') ||
    message.includes('is not available') ||
    message.includes('deprecated')
  ) {
    return new AIModelUnavailableError(providerId, requestedModel || 'unknown-model', error);
  }

  // 4. Network / Connectivity / Timeout
  if (
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('fetch failed') ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    status === 502 ||
    status === 504
  ) {
    return new AINetworkError(providerId, error);
  }

  // 5. Invalid Request / Context Window
  if (
    status === 400 ||
    message.includes('invalid argument') ||
    message.includes('context length') ||
    message.includes('maximum token')
  ) {
    return new AIInvalidRequestError(providerId, err?.message || 'Request was rejected by provider.', error);
  }

  // 6. Generic Fallback
  return new AIProviderError({
    providerId,
    category: 'unknown',
    userFacingMessage: err?.message || 'An unexpected AI service error occurred.',
    recoveryAction: 'Check the error details or try switching to the Offline Heuristic provider in Settings.',
    isRetryable: true,
    httpStatus: status || 500,
    originalError: error,
  });
}

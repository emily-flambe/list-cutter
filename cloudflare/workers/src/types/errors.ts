/**
 * Custom error types for authentication and security
 */

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class TokenValidationError extends AuthenticationError {
  constructor(message: string, public readonly tokenType?: string) {
    super(message, 'TOKEN_VALIDATION_ERROR');
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(message: string = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message: string = 'Invalid token format or signature') {
    super(message, 'INVALID_TOKEN');
  }
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly configKey?: string
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class EnvironmentError extends ConfigurationError {
  constructor(variableName: string, requirement?: string) {
    const message = requirement 
      ? `Environment variable ${variableName} ${requirement}`
      : `Environment variable ${variableName} is missing or invalid`;
    super(message, variableName);
    this.name = 'EnvironmentError';
  }
}

export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly securityCode: string,
    public readonly severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class RateLimitError extends SecurityError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 'medium');
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Utility function to check if an error is of a specific type
export function isAuthenticationError(error: any): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isConfigurationError(error: any): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isSecurityError(error: any): error is SecurityError {
  return error instanceof SecurityError;
}

export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError;
}

// Error handling utilities
export function createErrorResponse(error: Error, includeStack: boolean = false) {
  const response: any = {
    error: error.name,
    message: error.message,
    timestamp: new Date().toISOString()
  };

  if (isAuthenticationError(error)) {
    response.code = error.code;
    response.details = error.details;
  } else if (isConfigurationError(error)) {
    response.configKey = error.configKey;
  } else if (isSecurityError(error)) {
    response.securityCode = error.securityCode;
    response.severity = error.severity;
  } else if (isApiError(error)) {
    response.status = error.status;
    response.code = error.code;
  }

  if (includeStack && process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  return response;
}

export function getHttpStatusForError(error: Error): number {
  if (isApiError(error)) {
    return error.status;
  }

  if (isAuthenticationError(error)) {
    switch (error.code) {
      case 'TOKEN_EXPIRED':
      case 'INVALID_TOKEN':
        return 401;
      case 'TOKEN_VALIDATION_ERROR':
        return 400;
      default:
        return 401;
    }
  }

  if (isConfigurationError(error)) {
    return 500;
  }

  if (isSecurityError(error)) {
    if (error.securityCode === 'RATE_LIMIT_EXCEEDED') {
      return 429;
    }
    return 403;
  }

  if (error instanceof ValidationError) {
    return 400;
  }

  return 500;
}
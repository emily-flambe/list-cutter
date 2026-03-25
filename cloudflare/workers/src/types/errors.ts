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

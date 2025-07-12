/**
 * Response Test Fixtures
 * 
 * Predefined response data for testing API responses and error handling.
 */

export const successResponses = {
  login: {
    message: 'Login successful',
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
    },
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  },
  
  registration: {
    message: 'User registered successfully',
    user: {
      id: 5,
      username: 'newuser',
      email: 'new@example.com',
    },
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  },
  
  refresh: {
    message: 'Token refreshed successfully',
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
  },
  
  logout: {
    message: 'Logout successful',
  },
  
  fileUpload: {
    message: 'File uploaded successfully',
    file: {
      id: 'file123',
      filename: 'test.txt',
      size: 1024,
      content_type: 'text/plain',
      upload_url: 'https://storage.example.com/file123',
    },
  },
  
  fileList: {
    files: [
      {
        id: 'file1',
        filename: 'document.pdf',
        size: 2048,
        content_type: 'application/pdf',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'file2',
        filename: 'image.jpg',
        size: 4096,
        content_type: 'image/jpeg',
        created_at: '2024-01-02T00:00:00Z',
      },
    ],
    total: 2,
    page: 1,
    limit: 10,
  },
};

export const errorResponses = {
  // Authentication errors
  unauthorized: {
    error: 'Unauthorized',
    code: 'AUTH_REQUIRED',
    message: 'Authentication required',
  },
  
  invalidToken: {
    error: 'Invalid token',
    code: 'TOKEN_INVALID',
    message: 'The provided token is invalid or expired',
  },
  
  tokenExpired: {
    error: 'Token expired',
    code: 'TOKEN_EXPIRED',
    message: 'Access token has expired',
  },
  
  invalidCredentials: {
    error: 'Invalid credentials',
    code: 'AUTH_FAILED',
    message: 'Username or password is incorrect',
  },
  
  // Validation errors
  validationError: {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: {
      username: ['Username is required', 'Username must be at least 3 characters'],
      email: ['Invalid email format'],
      password: ['Password must contain at least 8 characters'],
    },
  },
  
  missingFields: {
    error: 'Missing required fields',
    code: 'MISSING_FIELDS',
    missing: ['username', 'password'],
  },
  
  // Resource errors
  userNotFound: {
    error: 'User not found',
    code: 'USER_NOT_FOUND',
    message: 'No user found with the provided identifier',
  },
  
  userExists: {
    error: 'User already exists',
    code: 'USER_EXISTS',
    message: 'A user with this username or email already exists',
  },
  
  fileNotFound: {
    error: 'File not found',
    code: 'FILE_NOT_FOUND',
    message: 'The requested file could not be found',
  },
  
  // Rate limiting
  rateLimited: {
    error: 'Rate limit exceeded',
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
    retry_after: 60,
  },
  
  // Server errors
  internalError: {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  },
  
  serviceUnavailable: {
    error: 'Service unavailable',
    code: 'SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable',
  },
  
  databaseError: {
    error: 'Database error',
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
  },
  
  // Security errors
  forbidden: {
    error: 'Forbidden',
    code: 'FORBIDDEN',
    message: 'You do not have permission to access this resource',
  },
  
  suspiciousActivity: {
    error: 'Suspicious activity detected',
    code: 'SECURITY_VIOLATION',
    message: 'Your request has been flagged for security review',
  },
  
  // Method and format errors
  methodNotAllowed: {
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED',
    allowed: ['GET', 'POST'],
  },
  
  unsupportedMediaType: {
    error: 'Unsupported media type',
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Content-Type not supported',
  },
  
  payloadTooLarge: {
    error: 'Payload too large',
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Request payload exceeds size limit',
    max_size: '10MB',
  },
};

export const responseHeaders = {
  json: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  },
  
  cors: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  },
  
  security: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
  },
  
  rateLimit: {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': '1640995200',
  },
  
  caching: {
    'Cache-Control': 'public, max-age=3600',
    'ETag': '"abc123"',
    'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
  },
};

export const statusCodes = {
  // Success
  ok: 200,
  created: 201,
  accepted: 202,
  noContent: 204,
  
  // Redirection
  movedPermanently: 301,
  found: 302,
  notModified: 304,
  
  // Client errors
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  conflict: 409,
  payloadTooLarge: 413,
  unsupportedMediaType: 415,
  unprocessableEntity: 422,
  tooManyRequests: 429,
  
  // Server errors
  internalServerError: 500,
  notImplemented: 501,
  badGateway: 502,
  serviceUnavailable: 503,
  gatewayTimeout: 504,
};
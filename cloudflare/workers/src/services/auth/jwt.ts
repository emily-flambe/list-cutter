import { SignJWT, jwtVerify } from 'jose';
import type { UserJWTPayload, User, TokenPair, Env, RefreshTokenData, BlacklistedToken } from '../../types';
import { 
  TokenValidationError, 
  InvalidTokenError, 
  TokenExpiredError,
  EnvironmentError 
} from '../../types/errors';

/**
 * JWT Service for authentication token management
 * 
 * This service provides secure JWT token generation, validation, and management
 * with support for access tokens, refresh tokens, and token rotation. It implements
 * industry-standard security practices including token blacklisting and short-lived
 * access tokens.
 * 
 * @module JWTService
 * @author Cutty Authentication System
 * @version 1.0.0
 * @since 1.0.0
 */

/**
 * JWT signing algorithm used for all tokens
 * @constant {string}
 */
const JWT_ALGORITHM = 'HS256';

/**
 * Default access token expiration time
 * @constant {string}
 */
const DEFAULT_ACCESS_TOKEN_EXPIRY = '10m';

/**
 * Default refresh token expiration time
 * @constant {string}
 */
const DEFAULT_REFRESH_TOKEN_EXPIRY = '1d';

/**
 * Generate JWT token with specified payload and expiration
 * 
 * Creates a signed JWT token using the HS256 algorithm. The token includes
 * standard claims (exp, iat, jti) plus custom payload data. Each token
 * receives a unique JWT ID (jti) for tracking and blacklisting purposes.
 * 
 * @param payload - Token payload data (excluding computed fields like exp, iat, jti)
 * @param payload.user_id - Database user ID
 * @param payload.username - Username
 * @param payload.email - User email (optional)
 * @param payload.token_type - Type of token ('access' or 'refresh')
 * @param secret - JWT signing secret key (must be at least 256 bits)
 * @param expiresIn - Expiration time string (e.g., "10m", "1h", "1d")
 * @returns Promise resolving to signed JWT token string
 * 
 * @throws {Error} When token generation fails or invalid parameters provided
 * @throws {Error} When expiresIn format is invalid
 * 
 * @example
 * ```typescript
 * const token = await generateJWT(
 *   { 
 *     user_id: 1, 
 *     username: 'john', 
 *     email: 'john@example.com',
 *     token_type: 'access' 
 *   },
 *   'your-secret-key',
 *   '10m'
 * );
 * console.log('Generated token:', token);
 * ```
 * 
 * @example
 * ```typescript
 * // Generate refresh token
 * const refreshToken = await generateJWT(
 *   { 
 *     user_id: 1, 
 *     username: 'john',
 *     token_type: 'refresh' 
 *   },
 *   env.JWT_SECRET,
 *   '24h'
 * );
 * ```
 */
export async function generateJWT(
  payload: Omit<UserJWTPayload, 'exp' | 'iat' | 'jti'>,
  secret: string,
  expiresIn: string
): Promise<string> {
  // Validate JWT secret security requirements
  if (!secret) {
    throw new Error('JWT_SECRET is required for token generation');
  }
  
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
  
  // Validate payload requirements
  if (!payload.user_id || !payload.username) {
    throw new Error('JWT payload must include user_id and username');
  }
  
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiresIn(expiresIn);
  
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);
  
  const jwt = await new SignJWT({
    ...payload,
    jti,
    exp,
    iat: now
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(secretKey);
  
  return jwt;
}

/**
 * Verify JWT token and return payload
 * 
 * Verifies the signature and expiration of a JWT token using the provided secret.
 * Returns the parsed payload if valid, or null if verification fails. This function
 * validates both the token structure and required fields.
 * 
 * @param token - JWT token string to verify
 * @param secret - JWT verification secret (must match signing secret)
 * @returns Promise resolving to parsed payload or null if invalid
 * 
 * @throws Never throws - returns null on all verification failures
 * 
 * @example
 * ```typescript
 * const payload = await verifyJWT(token, env.JWT_SECRET);
 * if (payload) {
 *   console.log('User ID:', payload.user_id);
 *   console.log('Username:', payload.username);
 *   console.log('Token type:', payload.token_type);
 *   console.log('Expires at:', new Date(payload.exp * 1000));
 * } else {
 *   console.log('Token verification failed');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Check if token is expired
 * const payload = await verifyJWT(token, secret);
 * if (payload && payload.exp > Date.now() / 1000) {
 *   // Token is valid and not expired
 *   const user = await getUser(payload.user_id);
 * }
 * ```
 * 
 * @see {@link generateJWT} for token generation
 * @see {@link isTokenBlacklisted} for blacklist checking
 */
export async function verifyJWT(token: string, secret: string): Promise<UserJWTPayload | null> {
  try {
    // Validate inputs
    if (!token || !secret) {
      return null;
    }
    
    if (secret.length < 32) {
      console.error('JWT secret is too short for secure verification');
      return null;
    }
    
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM]
    });
    
    // Validate required fields exist
    if (typeof payload.user_id !== 'string' || typeof payload.username !== 'string') {
      throw new Error('Invalid token payload');
    }
    
    return payload as unknown as UserJWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Enhanced JWT verification with specific error types
 * 
 * This function provides the same functionality as verifyJWT but throws
 * specific error types instead of returning null, enabling better error
 * handling and debugging in calling code.
 * 
 * @param token - JWT token string to verify
 * @param secret - JWT verification secret
 * @returns Promise resolving to parsed payload
 * @throws {InvalidTokenError} When token format is invalid
 * @throws {TokenExpiredError} When token has expired
 * @throws {TokenValidationError} When token validation fails
 * @throws {EnvironmentError} When secret is invalid
 */
export async function verifyJWTWithErrors(token: string, secret: string): Promise<UserJWTPayload> {
  // Validate inputs
  if (!token) {
    throw new InvalidTokenError('Token is required for verification');
  }
  
  if (!secret) {
    throw new EnvironmentError('JWT_SECRET', 'is required for token verification');
  }
  
  if (secret.length < 32) {
    throw new EnvironmentError('JWT_SECRET', 'must be at least 32 characters long');
  }
  
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM]
    });
    
    // Validate required fields exist
    if (typeof payload.user_id !== 'string' || typeof payload.username !== 'string') {
      throw new TokenValidationError('Token payload missing required fields (user_id, username)');
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new TokenExpiredError('Token has expired');
    }
    
    return payload as unknown as UserJWTPayload;
  } catch (error) {
    if (error instanceof TokenValidationError || 
        error instanceof TokenExpiredError || 
        error instanceof InvalidTokenError ||
        error instanceof EnvironmentError) {
      throw error;
    }
    
    // Handle jose library specific errors
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        throw new TokenExpiredError('Token has expired');
      }
      if (error.message.includes('signature')) {
        throw new InvalidTokenError('Invalid token signature');
      }
      if (error.message.includes('malformed')) {
        throw new InvalidTokenError('Malformed token format');
      }
    }
    
    throw new TokenValidationError('Token verification failed', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Generate access and refresh token pair for user
 * 
 * Creates a complete token pair consisting of a short-lived access token (10 minutes)
 * and a longer-lived refresh token (1 day). The refresh token is stored in Workers KV
 * for tracking and blacklisting purposes. This is the primary function used during
 * login and token refresh operations.
 * 
 * @param user - User object containing authentication details
 * @param user.id - Unique user database ID
 * @param user.username - Username
 * @param user.email - User email address (optional)
 * @param env - Environment object containing secrets and KV bindings
 * @param env.JWT_SECRET - Secret key for JWT signing
 * @param env.AUTH_KV - KV namespace for token storage
 * @returns Promise resolving to token pair with access and refresh tokens
 * 
 * @throws {Error} When token generation or KV storage fails
 * 
 * @example
 * ```typescript
 * // During user login
 * const user = await authenticateUser(env, username, password);
 * if (user) {
 *   const tokens = await generateTokenPair(user, env);
 *   return new Response(JSON.stringify({
 *     message: 'Login successful',
 *     user: { id: user.id, username: user.username },
 *     ...tokens
 *   }));
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // During registration
 * const newUser = await createUser(env, registrationData);
 * const tokens = await generateTokenPair(newUser, env);
 * // Return tokens for immediate authentication
 * ```
 * 
 * @see {@link generateJWT} for individual token creation
 * @see {@link refreshAccessToken} for token renewal
 * @since 1.0.0
 */
export async function generateTokenPair(
  user: User,
  env: Env
): Promise<TokenPair> {
  // Validate environment configuration
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (!env.AUTH_KV) {
    throw new Error('AUTH_KV binding is required for token storage');
  }
  
  const access_token = await generateJWT(
    {
      user_id: user.id,
      username: user.username,
      ...(user.email ? { email: user.email } : {}),
      token_type: 'access'
    },
    env.JWT_SECRET,
    DEFAULT_ACCESS_TOKEN_EXPIRY
  );
  
  const refresh_token = await generateJWT(
    {
      user_id: user.id,
      username: user.username,
      ...(user.email ? { email: user.email } : {}),
      token_type: 'refresh'
    },
    env.JWT_SECRET,
    DEFAULT_REFRESH_TOKEN_EXPIRY
  );
  
  // Store refresh token in KV
  const refreshPayload = await verifyJWT(refresh_token, env.JWT_SECRET);
  if (refreshPayload) {
    const refreshData: RefreshTokenData = {
      user_id: user.id,
      username: user.username,
      expires_at: refreshPayload.exp * 1000
    };
    
    await env.AUTH_KV.put(
      `refresh_token:${refreshPayload.jti}`,
      JSON.stringify(refreshData),
      { expirationTtl: 86400 } // 24 hours
    );
  }
  
  return { access_token, refresh_token };
}

/**
 * Refresh access token using refresh token
 * 
 * Implements secure token refresh with automatic token rotation. Validates the
 * provided refresh token, checks it against the KV store and blacklist, then
 * generates a new token pair. The old refresh token is immediately blacklisted
 * to prevent reuse (token rotation security pattern).
 * 
 * @param refresh_token - Current refresh token to exchange
 * @param env - Environment object with JWT secret and KV bindings
 * @param env.JWT_SECRET - Secret for token verification and generation
 * @param env.AUTH_KV - KV store for token tracking and blacklisting
 * @returns Promise resolving to new token pair or null if refresh fails
 * 
 * @throws Never throws - returns null on all validation failures
 * 
 * @example
 * ```typescript
 * // Handle token refresh endpoint
 * const { refresh_token } = await request.json();
 * const newTokens = await refreshAccessToken(refresh_token, env);
 * 
 * if (newTokens) {
 *   return new Response(JSON.stringify({
 *     message: 'Token refreshed successfully',
 *     ...newTokens
 *   }));
 * } else {
 *   return new Response(JSON.stringify({
 *     error: 'Invalid or expired refresh token'
 *   }), { status: 401 });
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Automatic token refresh in middleware
 * if (isAccessTokenExpired(accessToken)) {
 *   const refreshToken = getRefreshTokenFromStorage();
 *   const newTokens = await refreshAccessToken(refreshToken, env);
 *   if (newTokens) {
 *     // Update stored tokens
 *     updateTokensInStorage(newTokens);
 *   }
 * }
 * ```
 * 
 * @see {@link generateTokenPair} for initial token creation
 * @see {@link blacklistToken} for token invalidation
 * @see {@link isTokenBlacklisted} for blacklist checking
 * @since 1.0.0
 */
export async function refreshAccessToken(
  refresh_token: string,
  env: Env
): Promise<TokenPair | null> {
  // Verify refresh token
  const payload = await verifyJWT(refresh_token, env.JWT_SECRET);
  if (!payload || payload.token_type !== 'refresh') {
    return null;
  }
  
  // Check if token exists in KV and is not blacklisted
  const storedTokenData = await env.AUTH_KV.get(`refresh_token:${payload.jti}`);
  const blacklisted = await env.AUTH_KV.get(`blacklist:${payload.jti}`);
  
  if (!storedTokenData || blacklisted) {
    return null;
  }
  
  const tokenData: RefreshTokenData = JSON.parse(storedTokenData);
  
  // Blacklist old refresh token
  const blacklistData: BlacklistedToken = {
    reason: 'token_rotated',
    blacklisted_at: Date.now()
  };
  
  await env.AUTH_KV.put(
    `blacklist:${payload.jti}`,
    JSON.stringify(blacklistData),
    { expirationTtl: 86400 } // Keep for 24 hours
  );
  
  // Generate new token pair
  const user: User = {
    id: tokenData.user_id,
    username: tokenData.username,
    ...(payload.email ? { email: payload.email } : {}),
    created_at: new Date().toISOString()
  };
  
  return generateTokenPair(user, env);
}

/**
 * Blacklist a token to prevent further use
 * 
 * Adds a token to the blacklist in Workers KV storage. Blacklisted tokens
 * are immediately invalidated and cannot be used for authentication. This
 * function is used during logout, security incidents, or token rotation.
 * The blacklist entry includes the reason and timestamp for audit purposes.
 * 
 * @param token - JWT token to blacklist (access or refresh token)
 * @param reason - Human-readable reason for blacklisting
 * @param env - Environment object with KV bindings
 * @param env.AUTH_KV - KV namespace for blacklist storage
 * @param env.JWT_SECRET - Secret for token parsing
 * @returns Promise that resolves when token is blacklisted
 * 
 * @throws {Error} When KV storage operation fails
 * @throws Never throws for invalid tokens - silently ignores
 * 
 * @example
 * ```typescript
 * // During user logout
 * const { refresh_token } = await request.json();
 * await blacklistToken(refresh_token, 'user_logout', env);
 * 
 * return new Response(JSON.stringify({
 *   message: 'Logout successful'
 * }));
 * ```
 * 
 * @example
 * ```typescript
 * // During security incident
 * const suspiciousTokens = await findSuspiciousTokens(userId);
 * for (const token of suspiciousTokens) {
 *   await blacklistToken(token, 'security_incident', env);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // During token rotation
 * await blacklistToken(oldRefreshToken, 'token_rotated', env);
 * const newTokens = await generateTokenPair(user, env);
 * ```
 * 
 * @see {@link isTokenBlacklisted} for checking blacklist status
 * @see {@link refreshAccessToken} for automatic rotation blacklisting
 * @since 1.0.0
 */
export async function blacklistToken(token: string, reason: string, env: Env): Promise<void> {
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return;
  }
  
  const blacklistData: BlacklistedToken = {
    reason,
    blacklisted_at: Date.now()
  };
  
  await env.AUTH_KV.put(
    `blacklist:${payload.jti}`,
    JSON.stringify(blacklistData),
    { expirationTtl: payload.token_type === 'access' ? 600 : 86400 } // Match token lifetime
  );
}

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(token: string, env: Env): Promise<boolean> {
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return true; // Invalid tokens are considered blacklisted
  }
  
  const blacklisted = await env.AUTH_KV.get(`blacklist:${payload.jti}`);
  return !!blacklisted;
}

/**
 * Parse expiration string to seconds
 * 
 * Converts human-readable time strings into seconds for JWT expiration.
 * Supports common time units: seconds (s), minutes (m), hours (h), and days (d).
 * This utility ensures consistent time parsing across the JWT service.
 * 
 * @param expiresIn - Time string in format "number + unit" (e.g., "10m", "24h")
 * @returns Number of seconds for the specified duration
 * 
 * @throws {Error} When format is invalid or unsupported
 * @throws {Error} When time unit is not recognized
 * 
 * @example
 * ```typescript
 * parseExpiresIn('10m')  // Returns 600 (10 minutes)
 * parseExpiresIn('1h')   // Returns 3600 (1 hour)
 * parseExpiresIn('7d')   // Returns 604800 (7 days)
 * parseExpiresIn('30s')  // Returns 30 (30 seconds)
 * ```
 * 
 * @example
 * ```typescript
 * // Usage in token generation
 * const accessTokenExpiry = parseExpiresIn('10m');
 * const refreshTokenExpiry = parseExpiresIn('1d');
 * ```
 * 
 * @internal This is an internal utility function
 * @since 1.0.0
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid expiresIn format');
  
  const [, value, unit] = match;
  const num = parseInt(value || '0');
  
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: throw new Error('Invalid time unit');
  }
}

// Legacy compatibility functions
export async function signJWT(user: User, secret: string): Promise<string> {
  return generateJWT(
    {
      user_id: user.id,
      username: user.username,
      ...(user.email ? { email: user.email } : {}),
      token_type: 'access'
    },
    secret,
    '24h'
  );
}

export async function refreshJWT(token: string, secret: string): Promise<string | null> {
  // This is a simplified version for backwards compatibility
  // In practice, should use refreshAccessToken with KV storage
  const payload = await verifyJWT(token, secret);
  if (!payload) {
    return null;
  }

  const user: User = {
    id: payload.user_id,
    username: payload.username,
    ...(payload.email ? { email: payload.email } : {}),
    created_at: new Date().toISOString()
  };

  return signJWT(user, secret);
}
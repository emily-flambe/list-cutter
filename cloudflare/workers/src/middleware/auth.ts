import type { Env, UserJWTPayload } from '../types';
import { verifyJWT, isTokenBlacklisted } from '../services/auth/jwt';
import { ApiError } from './error';

/**
 * Verify authentication from request headers
 */
export async function verifyAuth(request: Request, env: Env): Promise<UserJWTPayload | null> {
  // Extract Authorization header - should be in format "Bearer <token>"
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null; // No valid authorization header found
  }

  // Remove "Bearer " prefix to get the actual token
  const token = authHeader.substring(7);
  
  // Verify JWT token signature, expiration, and structure
  // This cryptographically validates the token was issued by us and hasn't been tampered with
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return null; // Token is invalid, expired, or malformed
  }
  
  // Check if token has been manually blacklisted
  // Tokens can be blacklisted during logout, security incidents, or account suspension
  if (await isTokenBlacklisted(token, env)) {
    return null; // Token is valid but has been intentionally revoked
  }
  
  return payload; // Token is valid and active
}

/**
 * Require authentication and throw error if not authenticated
 */
export async function requireAuth(request: Request, env: Env): Promise<UserJWTPayload> {
  const user = await verifyAuth(request, env);
  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }
  return user;
}

/**
 * Extract user context from request headers (set by security middleware)
 */
export function getUserContext(request: Request): UserJWTPayload | null {
  // Extract user information from custom headers set by upstream security middleware
  // These headers are populated after successful JWT token validation
  const userId = request.headers.get('X-User-ID');
  const username = request.headers.get('X-Username');
  const email = request.headers.get('X-User-Email');
  
  // Both user ID and username are required for valid user context
  if (!userId || !username) {
    return null; // Missing essential user information
  }
  
  // Reconstruct a UserJWTPayload-compatible object from headers
  // Note: This is used when JWT parsing has already been done by middleware
  return {
    user_id: parseInt(userId), // Convert string header back to number
    username,
    email: email || undefined, // Email is optional
    iat: 0, // These JWT-specific fields are not relevant when extracted from headers
    exp: 0, // The original token validation already handled expiration
    jti: '', // JWT ID not needed for header-based context
    token_type: 'access' // Assume access token type for header-based auth
  } as UserJWTPayload;
}
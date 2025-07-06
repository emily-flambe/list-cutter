import type { Env, UserJWTPayload } from '../types';
import { verifyJWT, isTokenBlacklisted } from '../services/auth/jwt';
import { ApiError } from './error';

/**
 * Verify authentication from request headers
 */
export async function verifyAuth(request: Request, env: Env): Promise<UserJWTPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // Verify JWT token
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return null;
  }
  
  // Check if token is blacklisted
  if (await isTokenBlacklisted(token, env)) {
    return null;
  }
  
  return payload;
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
  const userId = request.headers.get('X-User-ID');
  const username = request.headers.get('X-Username');
  const email = request.headers.get('X-User-Email');
  
  if (!userId || !username) {
    return null;
  }
  
  return {
    user_id: parseInt(userId),
    username,
    email: email || undefined,
    iat: 0, // These are not relevant when extracted from headers
    exp: 0,
    jti: '',
    token_type: 'access'
  };
}
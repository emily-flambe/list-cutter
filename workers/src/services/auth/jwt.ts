import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { UserJWTPayload, User } from '../../types';
import { ApiError } from '../../middleware/error';

const JWT_ALGORITHM = 'HS256';

export async function signJWT(user: User, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);
  
  const payload: JWTPayload = {
    id: user.id,
    username: user.username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .sign(secretKey);
}

export async function verifyJWT(token: string, secret: string): Promise<UserJWTPayload | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM]
    });
    
    // Validate required fields exist
    if (typeof payload.id !== 'string' || typeof payload.username !== 'string') {
      throw new Error('Invalid token payload');
    }
    
    return payload as unknown as UserJWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

export async function refreshJWT(token: string, secret: string): Promise<string | null> {
  const payload = await verifyJWT(token, secret);
  if (!payload) {
    return null;
  }

  // Check if token is still valid for refresh (not expired more than 7 days ago)
  const maxRefreshAge = 7 * 24 * 60 * 60; // 7 days
  const now = Math.floor(Date.now() / 1000);
  
  if (payload.exp && (now - payload.exp) > maxRefreshAge) {
    throw new ApiError(401, 'Token too old to refresh');
  }

  const user: User = {
    id: payload.id,
    username: payload.username,
    email: '', // Will be populated from database in real implementation
    created_at: new Date().toISOString()
  };

  return signJWT(user, secret);
}
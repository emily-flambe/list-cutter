import type { Env, UserJWTPayload } from '../types';
import { verifyJWT } from '../services/auth/jwt';
import { ApiError } from './error';

export async function verifyAuth(request: Request, env: Env): Promise<UserJWTPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyJWT(token, env.JWT_SECRET);
}

export async function requireAuth(request: Request, env: Env): Promise<UserJWTPayload> {
  const user = await verifyAuth(request, env);
  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }
  return user;
}
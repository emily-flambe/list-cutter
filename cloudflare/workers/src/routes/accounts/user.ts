import type { Env } from '../../types';
import { verifyJWT } from '../../services/auth/jwt';
import { ApiError } from '../../types/errors';

/**
 * Get current user information from JWT token
 * @param request HTTP request with Authorization header
 * @param env Environment with JWT secret
 * @returns User profile data
 */
export async function handleUser(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Extract Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authorization header required');
    }

    // Extract and verify JWT token
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    
    if (!payload) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    // Check if token is an access token
    if (payload.token_type !== 'access') {
      throw new ApiError(401, 'Access token required');
    }

    // Return user data from token payload
    const userData = {
      id: payload.user_id,
      username: payload.username,
      email: payload.email || null,
    };

    return new Response(JSON.stringify(userData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.error('User endpoint error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
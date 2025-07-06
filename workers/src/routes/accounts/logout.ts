import type { Env } from '../../types';
import { blacklistToken } from '../../services/auth/jwt';
import { ApiError } from '../../middleware/error';

interface LogoutRequest {
  refresh_token?: string;
}

export async function handleLogout(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get('Authorization');
    let accessToken: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
    
    // Get refresh token from request body (optional)
    let refreshToken: string | null = null;
    try {
      const body = await request.json() as LogoutRequest;
      refreshToken = body.refresh_token || null;
    } catch {
      // Body is optional for logout
    }
    
    // Blacklist access token if provided
    if (accessToken) {
      await blacklistToken(accessToken, 'user_logout', env);
    }
    
    // Blacklist refresh token if provided
    if (refreshToken) {
      await blacklistToken(refreshToken, 'user_logout', env);
    }
    
    return new Response(JSON.stringify({
      message: 'Logout successful'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Logout error:', error);
    throw new ApiError(500, 'Logout failed');
  }
}
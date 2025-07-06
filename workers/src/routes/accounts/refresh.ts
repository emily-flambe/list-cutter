import type { Env } from '../../types';
import { refreshJWT } from '../../services/auth/jwt';
import { ApiError } from '../../middleware/error';

interface RefreshRequest {
  refresh: string;
}

export async function handleRefresh(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const { refresh: token } = await request.json() as RefreshRequest;
    
    if (!token) {
      throw new ApiError(400, 'Refresh token is required');
    }

    const newToken = await refreshJWT(token, env.JWT_SECRET);
    if (!newToken) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    return new Response(JSON.stringify({
      access: newToken
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Token refresh error:', error);
    throw new ApiError(400, 'Token refresh failed');
  }
}
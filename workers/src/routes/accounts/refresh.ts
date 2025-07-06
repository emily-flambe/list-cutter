import type { Env } from '../../types';
import { refreshAccessToken } from '../../services/auth/jwt';
import { ApiError } from '../../middleware/error';

interface RefreshRequest {
  refresh_token: string;
}

export async function handleRefresh(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const { refresh_token } = await request.json() as RefreshRequest;
    
    if (!refresh_token) {
      throw new ApiError(400, 'Refresh token is required');
    }

    const tokens = await refreshAccessToken(refresh_token, env);
    if (!tokens) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    return new Response(JSON.stringify({
      message: 'Token refreshed successfully',
      ...tokens
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
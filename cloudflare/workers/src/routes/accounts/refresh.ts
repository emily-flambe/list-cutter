import type { Env } from '../../types';
import { refreshAccessToken } from '../../services/auth/jwt';
import { ApiError } from '../../middleware/error';
import { SecurityLogger } from '../../services/security/logger';
import { MetricsCollector } from '../../services/security/metrics';

interface RefreshRequest {
  refresh_token: string;
}

export async function handleRefresh(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();
  const logger = new SecurityLogger(env);
  const metrics = new MetricsCollector(env);
  
  let userId: string | undefined;
  
  try {
    const { refresh_token } = await request.json() as RefreshRequest;
    
    if (!refresh_token) {
      await logger.logAuthEvent('token_refresh', request, false, undefined, 'MISSING_TOKEN', 'Refresh token is required');
      throw new ApiError(400, 'Refresh token is required');
    }

    const tokens = await refreshAccessToken(refresh_token, env);
    if (!tokens) {
      await logger.logAuthEvent('token_refresh', request, false, undefined, 'INVALID_TOKEN', 'Invalid or expired refresh token', {
        token_present: !!refresh_token
      });
      
      await metrics.recordAuthMetrics('refresh', Date.now() - startTime, false);
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    // Extract user ID from the new tokens for logging
    // Note: We'd need to modify refreshAccessToken to return user info
    // For now, we'll log without user ID
    await logger.logAuthEvent('token_refresh', request, true, userId, undefined, undefined, {
      new_access_token_generated: true,
      new_refresh_token_generated: !!tokens.refresh_token
    });
    
    await metrics.recordAuthMetrics('refresh', Date.now() - startTime, true, userId);

    return new Response(JSON.stringify({
      message: 'Token refreshed successfully',
      ...tokens
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Log error if not already logged
    if (error instanceof ApiError && error.status !== 401 && error.status !== 400) {
      await logger.logAuthEvent('token_refresh', request, false, userId, 'SYSTEM_ERROR', error.message);
    }
    
    await metrics.recordAuthMetrics('refresh', Date.now() - startTime, false, userId);
    
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Token refresh error:', error);
    throw new ApiError(400, 'Token refresh failed');
  }
}
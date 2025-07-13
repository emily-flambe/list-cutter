import type { Env } from '../../types';
import { blacklistToken, verifyJWT } from '../../services/auth/jwt';
import { ApiError } from '../../middleware/error';
import { SecurityLogger } from '../../services/security/logger';
import { MetricsCollector } from '../../services/security/metrics';

interface LogoutRequest {
  refresh_token?: string;
}

export async function handleLogout(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();
  const logger = new SecurityLogger(env);
  const metrics = new MetricsCollector(env);
  
  let userId: string | undefined;
  
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get('Authorization');
    let accessToken: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
      
      // Try to get user ID from access token
      try {
        const payload = await verifyJWT(accessToken, env.JWT_SECRET);
        if (payload) {
          userId = payload.user_id;
        }
      } catch {
        // Token might be invalid, but still attempt logout
      }
    }
    
    // Get refresh token from request body (optional)
    let refreshToken: string | null = null;
    try {
      const body = await request.json() as LogoutRequest;
      refreshToken = body.refresh_token || null;
    } catch {
      // Body is optional for logout
    }
    
    let tokensBlacklisted = 0;
    
    // Blacklist access token if provided
    if (accessToken) {
      await blacklistToken(accessToken, 'user_logout', env);
      tokensBlacklisted++;
    }
    
    // Blacklist refresh token if provided
    if (refreshToken) {
      await blacklistToken(refreshToken, 'user_logout', env);
      tokensBlacklisted++;
    }
    
    // Log successful logout
    await logger.logAuthEvent('logout', request, true, userId, undefined, undefined, {
      tokens_blacklisted: tokensBlacklisted,
      access_token_present: !!accessToken,
      refresh_token_present: !!refreshToken
    });
    
    await metrics.recordAuthMetrics('logout', Date.now() - startTime, true, userId);
    
    return new Response(JSON.stringify({
      message: 'Logout successful'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Log logout failure
    await logger.logAuthEvent('logout', request, false, userId, 'LOGOUT_ERROR', error instanceof Error ? error.message : 'Unknown error');
    
    await metrics.recordAuthMetrics('logout', Date.now() - startTime, false, userId);
    
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Logout error:', error);
    throw new ApiError(500, 'Logout failed');
  }
}
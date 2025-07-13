import type { Env } from '../../types';
import { authenticateUser } from '../../services/storage/d1';
import { generateTokenPair } from '../../services/auth/jwt';
import { ApiError } from '../../types/errors';
import { SecurityLogger } from '../../services/security/logger';
import { MetricsCollector } from '../../services/security/metrics';

interface LoginRequest {
  username: string;
  password: string;
}

export async function handleLogin(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();
  const logger = new SecurityLogger(env);
  const metrics = new MetricsCollector(env);
  
  let username: string | undefined;
  let userId: string | undefined;
  
  try {
    const body = await request.json() as LoginRequest;
    username = body.username;
    const password = body.password;
    
    // Validate required fields
    if (!username || !password) {
      await logger.logAuthEvent('login', request, false, undefined, 'MISSING_FIELDS', 'Username and password are required');
      throw new ApiError(400, 'Username and password are required');
    }

    // Authenticate user
    const user = await authenticateUser(env, username, password);
    if (!user) {
      await logger.logAuthEvent('login', request, false, undefined, 'INVALID_CREDENTIALS', 'Invalid username or password', {
        attempted_username: username
      });
      
      await metrics.recordAuthMetrics('login', Date.now() - startTime, false);
      throw new ApiError(401, 'Invalid username or password');
    }
    
    userId = user.id;
    
    // Generate JWT token pair
    const tokens = await generateTokenPair(user, env);

    // Log successful login
    await logger.logAuthEvent('login', request, true, user.id, undefined, undefined, {
      username: user.username,
      token_type: 'access_refresh_pair'
    });
    
    await metrics.recordAuthMetrics('login', Date.now() - startTime, true, user.id);

    return new Response(JSON.stringify({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      ...tokens
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Log error if not already logged
    if (error instanceof ApiError && error.status !== 401 && error.status !== 400) {
      await logger.logAuthEvent('login', request, false, userId, 'SYSTEM_ERROR', error.message, {
        attempted_username: username
      });
    }
    
    await metrics.recordAuthMetrics('login', Date.now() - startTime, false, userId);
    
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Login error:', error);
    throw new ApiError(400, 'Login failed');
  }
}
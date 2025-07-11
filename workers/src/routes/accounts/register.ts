import type { Env, UserRegistration } from '../../types';
import { createUser } from '../../services/storage/d1';
import { generateTokenPair } from '../../services/auth/jwt';
import { ApiError } from '../../middleware/error';
import { SecurityLogger } from '../../services/security/logger';
import { MetricsCollector } from '../../services/security/metrics';

export async function handleRegister(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();
  const logger = new SecurityLogger(env);
  const metrics = new MetricsCollector(env);
  
  let username: string | undefined;
  let userId: number | undefined;
  
  try {
    const userData = await request.json() as UserRegistration;
    username = userData.username;
    
    // Validate required fields
    if (!userData.username || !userData.password || !userData.password2) {
      await logger.logAuthEvent('registration', request, false, undefined, 'MISSING_FIELDS', 'Username, password, and password confirmation are required', {
        provided_fields: {
          username: !!userData.username,
          password: !!userData.password,
          password2: !!userData.password2,
          email: !!userData.email
        }
      });
      throw new ApiError(400, 'Username, password, and password confirmation are required');
    }

    // Create user
    const user = await createUser(env, userData);
    userId = user.id;
    
    // Generate JWT token pair
    const tokens = await generateTokenPair(user, env);

    // Log successful registration
    await logger.logAuthEvent('registration', request, true, user.id, undefined, undefined, {
      username: user.username,
      email: user.email,
      has_email: !!user.email
    });
    
    await metrics.recordAuthMetrics('register', Date.now() - startTime, true, user.id);

    return new Response(JSON.stringify({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      ...tokens
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Log registration failure
    if (error instanceof ApiError) {
      let errorCode = 'REGISTRATION_FAILED';
      if (error.message.includes('Username already exists')) {
        errorCode = 'USERNAME_EXISTS';
      } else if (error.message.includes('Email already exists')) {
        errorCode = 'EMAIL_EXISTS';
      } else if (error.message.includes('Password')) {
        errorCode = 'PASSWORD_VALIDATION';
      }
      
      await logger.logAuthEvent('registration', request, false, userId, errorCode, error.message, {
        attempted_username: username
      });
    } else {
      await logger.logAuthEvent('registration', request, false, userId, 'SYSTEM_ERROR', error instanceof Error ? error.message : 'Unknown error', {
        attempted_username: username
      });
    }
    
    await metrics.recordAuthMetrics('register', Date.now() - startTime, false, userId);
    
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Registration error:', error);
    throw new ApiError(400, 'Registration failed');
  }
}
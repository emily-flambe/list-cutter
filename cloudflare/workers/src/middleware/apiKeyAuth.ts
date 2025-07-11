import type { Env, APIKeyAuthContext } from '../types';
import { APIKeyService } from '../services/auth/apiKeys';
import { APIKeyUsageTracker } from '../services/auth/apiKeyUsage';
import { APIPermission } from '../types/permissions';

export interface APIKeyAuthResult {
  authorized: boolean;
  context?: APIKeyAuthContext;
  response?: Response;
  rateLimited?: boolean;
}

export async function apiKeyAuthMiddleware(
  request: Request,
  env: Env,
  requiredPermissions: APIPermission[] = []
): Promise<APIKeyAuthResult> {
  const apiKeyService = new APIKeyService(env);
  const usageTracker = new APIKeyUsageTracker(env);
  
  const startTime = Date.now();
  
  try {
    // Check for API key in Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authorized: false };
    }
    
    const apiKey = authHeader.substring(7);
    
    // Validate API key
    const validatedKey = await apiKeyService.validateAPIKey(apiKey);
    if (!validatedKey) {
      await trackFailedAttempt(usageTracker, 'invalid_key', request, startTime);
      return {
        authorized: false,
        response: createErrorResponse('Invalid API key', 401)
      };
    }
    
    // Check permissions
    const hasPermissions = requiredPermissions.every(permission => 
      validatedKey.permissions.includes(permission)
    );
    
    if (!hasPermissions) {
      await usageTracker.trackUsage(
        validatedKey.key_id,
        request,
        403,
        Date.now() - startTime
      );
      
      return {
        authorized: false,
        response: createErrorResponse('Insufficient permissions', 403, {
          required: requiredPermissions,
          granted: validatedKey.permissions
        })
      };
    }
    
    // Check rate limiting if custom limit is set
    if (validatedKey.rate_limit_override) {
      const rateLimitResult = await checkAPIKeyRateLimit(
        validatedKey.key_id,
        validatedKey.rate_limit_override,
        env
      );
      
      if (!rateLimitResult.allowed) {
        await usageTracker.trackUsage(
          validatedKey.key_id,
          request,
          429,
          Date.now() - startTime
        );
        
        return {
          authorized: false,
          rateLimited: true,
          response: createErrorResponse('Rate limit exceeded', 429, {
            limit: validatedKey.rate_limit_override,
            reset_time: rateLimitResult.resetTime
          })
        };
      }
    }
    
    return {
      authorized: true,
      context: {
        api_key: validatedKey,
        user_id: validatedKey.user_id,
        permissions: validatedKey.permissions
      }
    };
    
  } catch (error) {
    console.error('API key authentication error:', error);
    await trackFailedAttempt(usageTracker, 'auth_error', request, startTime);
    return {
      authorized: false,
      response: createErrorResponse('Authentication error', 500)
    };
  }
}

/**
 * Enhanced API key middleware that also tracks successful requests
 */
export async function apiKeyAuthWithTracking(
  request: Request,
  env: Env,
  requiredPermissions: APIPermission[] = []
): Promise<APIKeyAuthResult & { trackSuccess?: (response: Response) => Promise<void> }> {
  const result = await apiKeyAuthMiddleware(request, env, requiredPermissions);
  
  if (result.authorized && result.context) {
    const usageTracker = new APIKeyUsageTracker(env);
    const startTime = Date.now();
    
    return {
      ...result,
      trackSuccess: async (response: Response) => {
        await usageTracker.trackUsage(
          result.context!.api_key.key_id,
          request,
          response.status,
          Date.now() - startTime
        );
      }
    };
  }
  
  return result;
}

/**
 * Check if request uses API key authentication
 */
export function isAPIKeyRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  return !!(authHeader && authHeader.startsWith('Bearer ') && authHeader.substring(7).startsWith('cutty_'));
}

/**
 * Require API key authentication and throw error if not authenticated
 */
export async function requireAPIKeyAuth(
  request: Request,
  env: Env,
  requiredPermissions: APIPermission[] = []
): Promise<APIKeyAuthContext> {
  const result = await apiKeyAuthMiddleware(request, env, requiredPermissions);
  
  if (!result.authorized || !result.context) {
    throw new Error(result.response ? 'API key authentication failed' : 'No API key provided');
  }
  
  return result.context;
}

/**
 * Check API key rate limiting
 */
async function checkAPIKeyRateLimit(
  keyId: string,
  limit: number,
  env: Env
): Promise<{ allowed: boolean; resetTime?: number }> {
  const window = 60000; // 1 minute
  const currentWindow = Math.floor(Date.now() / window);
  const rateLimitKey = `api_rate_limit:${keyId}:${currentWindow}`;
  
  try {
    const currentCount = await env.AUTH_KV.get(rateLimitKey);
    const count = currentCount ? parseInt(currentCount) : 0;
    
    if (count >= limit) {
      return {
        allowed: false,
        resetTime: (currentWindow + 1) * window
      };
    }
    
    await env.AUTH_KV.put(
      rateLimitKey,
      (count + 1).toString(),
      { expirationTtl: Math.ceil(window / 1000) }
    );
    
    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Allow the request if rate limiting fails
    return { allowed: true };
  }
}

/**
 * Create standardized error response
 */
function createErrorResponse(message: string, status: number, details?: any): Response {
  const body: any = { error: message };
  if (details) {
    body.details = details;
  }
  
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Track failed authentication attempts
 */
async function trackFailedAttempt(
  usageTracker: APIKeyUsageTracker,
  reason: string,
  request: Request,
  startTime: number
): Promise<void> {
  try {
    // Create a fake key ID for tracking purposes
    const fakeKeyId = `failed_${reason}_${Date.now()}`;
    await usageTracker.trackUsage(
      fakeKeyId,
      request,
      401,
      Date.now() - startTime
    );
  } catch (error) {
    console.error('Failed to track failed attempt:', error);
  }
}

/**
 * Enhanced permission checker with detailed validation
 */
export function validatePermissions(
  userPermissions: string[],
  requiredPermissions: APIPermission[]
): { valid: boolean; missing: APIPermission[] } {
  const missing = requiredPermissions.filter(permission => 
    !userPermissions.includes(permission)
  );
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Get rate limit status for an API key
 */
export async function getAPIKeyRateLimit(
  keyId: string,
  env: Env
): Promise<{ remaining: number; resetTime: number; limit?: number }> {
  const window = 60000; // 1 minute
  const currentWindow = Math.floor(Date.now() / window);
  const rateLimitKey = `api_rate_limit:${keyId}:${currentWindow}`;
  
  try {
    // Get the API key to check if it has a custom limit
    const apiKeyService = new APIKeyService(env);
    // We'd need to modify this to not require userId, or store the limit separately
    
    const currentCount = await env.AUTH_KV.get(rateLimitKey);
    const count = currentCount ? parseInt(currentCount) : 0;
    
    // Default rate limit if no custom limit
    const defaultLimit = 1000; // requests per minute
    
    return {
      remaining: Math.max(0, defaultLimit - count),
      resetTime: (currentWindow + 1) * window,
      limit: defaultLimit
    };
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return {
      remaining: 1000,
      resetTime: (Math.floor(Date.now() / window) + 1) * window
    };
  }
}
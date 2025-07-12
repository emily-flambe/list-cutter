import type { Env, UserJWTPayload, APIKeyAuthContext } from '../types';
import { verifyAuth } from './auth';
import { apiKeyAuthMiddleware, isAPIKeyRequest } from './apiKeyAuth';
import { APIPermission } from '../types/permissions';

export interface HybridAuthContext {
  user_id: number;
  username?: string;
  email?: string;
  auth_type: 'jwt' | 'api_key';
  permissions?: string[];
  api_key_id?: string;
}

export interface HybridAuthResult {
  authorized: boolean;
  context?: HybridAuthContext;
  response?: Response;
  rateLimited?: boolean;
}

/**
 * Hybrid authentication middleware that supports both JWT and API key authentication
 */
export async function hybridAuthMiddleware(
  request: Request,
  env: Env,
  requiredPermissions: APIPermission[] = []
): Promise<HybridAuthResult> {
  
  // Check if this is an API key request
  if (isAPIKeyRequest(request)) {
    const apiKeyResult = await apiKeyAuthMiddleware(request, env, requiredPermissions);
    
    if (!apiKeyResult.authorized) {
      return {
        authorized: false,
        response: apiKeyResult.response,
        rateLimited: apiKeyResult.rateLimited
      };
    }
    
    if (apiKeyResult.context) {
      return {
        authorized: true,
        context: {
          user_id: apiKeyResult.context.user_id,
          auth_type: 'api_key',
          permissions: apiKeyResult.context.permissions,
          api_key_id: apiKeyResult.context.api_key.key_id
        }
      };
    }
  }
  
  // Fall back to JWT authentication
  const jwtUser = await verifyAuth(request, env);
  
  if (!jwtUser) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ 
        error: 'Authentication required',
        accepted_methods: ['JWT Bearer token', 'API key Bearer token']
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
  
  // For JWT auth, we don't check specific permissions (backwards compatibility)
  // All JWT tokens have full access
  return {
    authorized: true,
    context: {
      user_id: jwtUser.user_id,
      username: jwtUser.username,
      email: jwtUser.email,
      auth_type: 'jwt'
    }
  };
}

/**
 * Require hybrid authentication and return context
 */
export async function requireHybridAuth(
  request: Request,
  env: Env,
  requiredPermissions: APIPermission[] = []
): Promise<HybridAuthContext> {
  const result = await hybridAuthMiddleware(request, env, requiredPermissions);
  
  if (!result.authorized || !result.context) {
    if (result.response) {
      throw new Error(`Authentication failed: ${result.response.status}`);
    }
    throw new Error('Authentication required');
  }
  
  return result.context;
}

/**
 * Check if user has permission (for API key auth)
 */
export function hasPermission(
  context: HybridAuthContext,
  permission: APIPermission
): boolean {
  // JWT users have all permissions (backwards compatibility)
  if (context.auth_type === 'jwt') {
    return true;
  }
  
  // API key users need explicit permission
  return context.permissions?.includes(permission) || false;
}

/**
 * Check if user has all required permissions
 */
export function hasAllPermissions(
  context: HybridAuthContext,
  permissions: APIPermission[]
): boolean {
  // JWT users have all permissions (backwards compatibility)
  if (context.auth_type === 'jwt') {
    return true;
  }
  
  // API key users need all explicit permissions
  return permissions.every(permission => 
    context.permissions?.includes(permission) || false
  );
}

/**
 * Enhanced hybrid auth with success tracking for API keys
 */
export async function hybridAuthWithTracking(
  request: Request,
  env: Env,
  requiredPermissions: APIPermission[] = []
): Promise<HybridAuthResult & { trackSuccess?: (response: Response) => Promise<void> }> {
  
  // Check if this is an API key request
  if (isAPIKeyRequest(request)) {
    // Use the API key auth with tracking
    const { apiKeyAuthWithTracking } = await import('./apiKeyAuth');
    const apiKeyResult = await apiKeyAuthWithTracking(request, env, requiredPermissions);
    
    if (!apiKeyResult.authorized) {
      return {
        authorized: false,
        response: apiKeyResult.response,
        rateLimited: apiKeyResult.rateLimited
      };
    }
    
    if (apiKeyResult.context) {
      return {
        authorized: true,
        context: {
          user_id: apiKeyResult.context.user_id,
          auth_type: 'api_key',
          permissions: apiKeyResult.context.permissions,
          api_key_id: apiKeyResult.context.api_key.key_id
        },
        trackSuccess: apiKeyResult.trackSuccess
      };
    }
  }
  
  // Fall back to JWT authentication (no tracking needed)
  const jwtUser = await verifyAuth(request, env);
  
  if (!jwtUser) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ 
        error: 'Authentication required',
        accepted_methods: ['JWT Bearer token', 'API key Bearer token']
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
  
  return {
    authorized: true,
    context: {
      user_id: jwtUser.user_id,
      username: jwtUser.username,
      email: jwtUser.email,
      auth_type: 'jwt'
    }
  };
}

/**
 * Get authentication method from request
 */
export function getAuthMethod(request: Request): 'jwt' | 'api_key' | 'none' {
  if (isAPIKeyRequest(request)) {
    return 'api_key';
  }
  
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return 'jwt';
  }
  
  return 'none';
}
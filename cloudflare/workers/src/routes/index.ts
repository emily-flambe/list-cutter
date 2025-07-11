import type { Env } from '../../types';
import { 
  createAPIKey, 
  listAPIKeys, 
  getAPIKey, 
  revokeAPIKey, 
  getAPIKeyUsage, 
  getAPIKeyRequests,
  getAPIKeyInfo
} from './manage';
import { renderAPIKeyManagement } from './frontend';
import { renderAPIKeyExamples } from './examples';

/**
 * Main router for API key management
 */
export async function handleAPIKeyRoutes(
  request: Request,
  env: Env,
  pathname: string,
  method: string
): Promise<Response | null> {
  
  // Remove /api/api-keys prefix
  const routePath = pathname.replace(/^\/api\/api-keys/, '') || '/';
  const pathParts = routePath.split('/').filter(Boolean);
  
  try {
    // GET /api-keys/manage - Frontend management interface
    if (method === 'GET' && pathname === '/api-keys/manage') {
      return await renderAPIKeyManagement(request, env);
    }
    
    // GET /api-keys/docs - API documentation and examples
    if (method === 'GET' && pathname === '/api-keys/docs') {
      return await renderAPIKeyExamples(request, env);
    }
    
    // GET /api/api-keys/info - Get permission info (no auth required)
    if (method === 'GET' && routePath === '/info') {
      return await getAPIKeyInfo(request, env);
    }
    
    // GET /api/api-keys - List all API keys
    if (method === 'GET' && routePath === '/') {
      return await listAPIKeys(request, env);
    }
    
    // POST /api/api-keys - Create new API key
    if (method === 'POST' && routePath === '/') {
      return await createAPIKey(request, env);
    }
    
    // GET /api/api-keys/:keyId - Get specific API key
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] !== 'info') {
      const keyId = pathParts[0];
      return await getAPIKey(request, env, keyId);
    }
    
    // DELETE /api/api-keys/:keyId - Revoke API key
    if (method === 'DELETE' && pathParts.length === 1) {
      const keyId = pathParts[0];
      return await revokeAPIKey(request, env, keyId);
    }
    
    // GET /api/api-keys/:keyId/usage - Get usage statistics
    if (method === 'GET' && pathParts.length === 2 && pathParts[1] === 'usage') {
      const keyId = pathParts[0];
      return await getAPIKeyUsage(request, env, keyId);
    }
    
    // GET /api/api-keys/:keyId/requests - Get recent requests
    if (method === 'GET' && pathParts.length === 2 && pathParts[1] === 'requests') {
      const keyId = pathParts[0];
      return await getAPIKeyRequests(request, env, keyId);
    }
    
    // Route not found
    return null;
    
  } catch (error) {
    console.error('API key route error:', error);
    
    // Handle known error types
    if (error instanceof Error) {
      const statusCode = (error as any).statusCode || 500;
      return new Response(JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Fallback error response
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Check if a request path matches API key routes
 */
export function isAPIKeyRoute(pathname: string): boolean {
  return pathname.startsWith('/api/api-keys') || pathname.startsWith('/api-keys/');
}

/**
 * Get route documentation for API key endpoints
 */
export function getAPIKeyRouteDocumentation(): any {
  return {
    base_path: '/api/api-keys',
    endpoints: [
      {
        path: '/info',
        method: 'GET',
        description: 'Get available permissions and configuration',
        authentication: 'none',
        parameters: []
      },
      {
        path: '/',
        method: 'GET',
        description: 'List all API keys for authenticated user',
        authentication: 'jwt',
        parameters: []
      },
      {
        path: '/',
        method: 'POST',
        description: 'Create a new API key',
        authentication: 'jwt',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'API key name' },
          { name: 'permissions', type: 'array', required: true, description: 'List of permissions' },
          { name: 'expires_in_days', type: 'number', required: false, description: 'Expiration in days (1-365)' },
          { name: 'rate_limit_override', type: 'number', required: false, description: 'Custom rate limit (1-10000)' }
        ]
      },
      {
        path: '/:keyId',
        method: 'GET',
        description: 'Get details for a specific API key',
        authentication: 'jwt',
        parameters: [
          { name: 'keyId', type: 'string', required: true, description: 'API key ID', location: 'path' }
        ]
      },
      {
        path: '/:keyId',
        method: 'DELETE',
        description: 'Revoke an API key',
        authentication: 'jwt',
        parameters: [
          { name: 'keyId', type: 'string', required: true, description: 'API key ID', location: 'path' }
        ]
      },
      {
        path: '/:keyId/usage',
        method: 'GET',
        description: 'Get usage statistics for an API key',
        authentication: 'jwt',
        parameters: [
          { name: 'keyId', type: 'string', required: true, description: 'API key ID', location: 'path' },
          { name: 'days', type: 'number', required: false, description: 'Number of days (max 90)', location: 'query' },
          { name: 'details', type: 'boolean', required: false, description: 'Include hourly breakdown', location: 'query' }
        ]
      },
      {
        path: '/:keyId/requests',
        method: 'GET',
        description: 'Get recent requests for an API key',
        authentication: 'jwt',
        parameters: [
          { name: 'keyId', type: 'string', required: true, description: 'API key ID', location: 'path' },
          { name: 'limit', type: 'number', required: false, description: 'Number of requests (max 1000)', location: 'query' }
        ]
      }
    ]
  };
}
import type { Env, APIKeyCreateRequest } from '../../types';
import { APIKeyService } from '../../services/auth/apiKeys';
import { APIKeyUsageTracker } from '../../services/auth/apiKeyUsage';
import { APIPermission, PERMISSION_DESCRIPTIONS, PERMISSION_PRESETS } from '../../types/permissions';
import { requireAuth } from '../../middleware/auth';
import { ApiError } from '../../middleware/error';

/**
 * Create a new API key
 */
export async function createAPIKey(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await requireAuth(request, env);
  const apiKeyService = new APIKeyService(env);
  
  try {
    const body = await request.json() as APIKeyCreateRequest;
    const { name, permissions, expires_in_days, rate_limit_override } = body;
    
    // Validate input
    if (!name || !permissions || !Array.isArray(permissions)) {
      throw new ApiError(400, 'Name and permissions are required');
    }
    
    if (name.length < 1 || name.length > 100) {
      throw new ApiError(400, 'Name must be between 1 and 100 characters');
    }
    
    // Validate permissions
    const validPermissions = permissions.every(p => 
      Object.values(APIPermission).includes(p as APIPermission)
    );
    
    if (!validPermissions) {
      throw new ApiError(400, 'Invalid permissions specified');
    }
    
    if (permissions.length === 0) {
      throw new ApiError(400, 'At least one permission is required');
    }
    
    // Validate expiration
    if (expires_in_days !== undefined) {
      if (expires_in_days < 1 || expires_in_days > 365) {
        throw new ApiError(400, 'Expiration must be between 1 and 365 days');
      }
    }
    
    // Validate rate limit
    if (rate_limit_override !== undefined) {
      if (rate_limit_override < 1 || rate_limit_override > 10000) {
        throw new ApiError(400, 'Rate limit must be between 1 and 10000 requests per minute');
      }
    }
    
    // Check if user already has too many API keys
    const existingKeys = await apiKeyService.listAPIKeys(user.user_id);
    const activeKeys = existingKeys.filter(key => key.is_active);
    
    if (activeKeys.length >= 10) {
      throw new ApiError(400, 'Maximum of 10 active API keys allowed');
    }
    
    // Check for duplicate names
    const duplicateName = existingKeys.find(key => 
      key.name === name && key.is_active
    );
    
    if (duplicateName) {
      throw new ApiError(400, 'API key name already exists');
    }
    
    // Generate API key
    const result = await apiKeyService.generateAPIKey(user.user_id, {
      name,
      permissions,
      expires_in_days,
      rate_limit_override
    });
    
    return new Response(JSON.stringify({
      message: 'API key created successfully',
      key_id: result.key_id,
      api_key: result.api_key, // Only returned once
      name,
      permissions,
      expires_in_days,
      rate_limit_override,
      warning: 'Save this API key securely - it will not be shown again!'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('API key creation error:', error);
    throw new ApiError(500, 'Failed to create API key');
  }
}

/**
 * List all API keys for the authenticated user
 */
export async function listAPIKeys(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await requireAuth(request, env);
  const apiKeyService = new APIKeyService(env);
  
  try {
    const keys = await apiKeyService.listAPIKeys(user.user_id);
    
    return new Response(JSON.stringify({
      api_keys: keys.map(key => ({
        key_id: key.key_id,
        name: key.name,
        permissions: key.permissions,
        created_at: key.created_at,
        last_used: key.last_used,
        expires_at: key.expires_at,
        is_active: key.is_active,
        rate_limit_override: key.rate_limit_override,
        // Add human-readable status
        status: getKeyStatus(key),
        permission_descriptions: key.permissions.map(p => ({
          permission: p,
          description: PERMISSION_DESCRIPTIONS[p as APIPermission] || 'Unknown permission'
        }))
      })),
      total: keys.length,
      active: keys.filter(k => k.is_active).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('API key listing error:', error);
    throw new ApiError(500, 'Failed to list API keys');
  }
}

/**
 * Get details for a specific API key
 */
export async function getAPIKey(
  request: Request,
  env: Env,
  keyId: string
): Promise<Response> {
  const user = await requireAuth(request, env);
  const apiKeyService = new APIKeyService(env);
  
  try {
    const key = await apiKeyService.getAPIKey(keyId, user.user_id);
    
    if (!key) {
      throw new ApiError(404, 'API key not found');
    }
    
    return new Response(JSON.stringify({
      ...key,
      status: getKeyStatus(key),
      permission_descriptions: key.permissions!.map(p => ({
        permission: p,
        description: PERMISSION_DESCRIPTIONS[p as APIPermission] || 'Unknown permission'
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('API key retrieval error:', error);
    throw new ApiError(500, 'Failed to retrieve API key');
  }
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(
  request: Request,
  env: Env,
  keyId: string
): Promise<Response> {
  const user = await requireAuth(request, env);
  const apiKeyService = new APIKeyService(env);
  
  try {
    const success = await apiKeyService.revokeAPIKey(keyId, user.user_id);
    
    if (success) {
      return new Response(JSON.stringify({
        message: 'API key revoked successfully',
        key_id: keyId
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new ApiError(404, 'API key not found or already revoked');
    }
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('API key revocation error:', error);
    throw new ApiError(500, 'Failed to revoke API key');
  }
}

/**
 * Get usage statistics for an API key
 */
export async function getAPIKeyUsage(
  request: Request,
  env: Env,
  keyId: string
): Promise<Response> {
  const user = await requireAuth(request, env);
  const apiKeyService = new APIKeyService(env);
  const usageTracker = new APIKeyUsageTracker(env);
  
  try {
    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get('days') || '30'), 90);
    const includeDetails = url.searchParams.get('details') === 'true';
    
    // Verify key belongs to user
    const key = await apiKeyService.getAPIKey(keyId, user.user_id);
    if (!key) {
      throw new ApiError(404, 'API key not found');
    }
    
    const [stats, endpointStats, hourlyUsage] = await Promise.all([
      usageTracker.getUsageStats(keyId, days),
      usageTracker.getEndpointStats(keyId, days),
      includeDetails ? usageTracker.getHourlyUsage(keyId, Math.min(days, 7)) : null
    ]);
    
    const response: any = {
      key_id: keyId,
      key_name: key.name,
      usage_period_days: days,
      stats,
      endpoint_stats: endpointStats
    };
    
    if (includeDetails && hourlyUsage) {
      response.hourly_usage = hourlyUsage;
    }
    
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('API key usage error:', error);
    throw new ApiError(500, 'Failed to get API key usage');
  }
}

/**
 * Get recent requests for an API key
 */
export async function getAPIKeyRequests(
  request: Request,
  env: Env,
  keyId: string
): Promise<Response> {
  const user = await requireAuth(request, env);
  const apiKeyService = new APIKeyService(env);
  const usageTracker = new APIKeyUsageTracker(env);
  
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
    
    // Verify key belongs to user
    const key = await apiKeyService.getAPIKey(keyId, user.user_id);
    if (!key) {
      throw new ApiError(404, 'API key not found');
    }
    
    const recentUsage = await usageTracker.getRecentUsage(keyId, limit);
    
    return new Response(JSON.stringify({
      key_id: keyId,
      key_name: key.name,
      recent_requests: recentUsage.map(usage => ({
        timestamp: usage.timestamp,
        endpoint: usage.endpoint,
        method: usage.method,
        status: usage.response_status,
        response_time: usage.response_time,
        ip_address: usage.ip_address,
        user_agent: usage.user_agent,
        // Add human-readable timestamp
        datetime: new Date(usage.timestamp).toISOString()
      })),
      total_returned: recentUsage.length,
      limit_used: limit
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('API key requests error:', error);
    throw new ApiError(500, 'Failed to get API key requests');
  }
}

/**
 * Get available permissions and presets
 */
export async function getAPIKeyInfo(
  request: Request,
  env: Env
): Promise<Response> {
  // This endpoint doesn't require authentication as it just returns configuration info
  
  return new Response(JSON.stringify({
    available_permissions: Object.values(APIPermission).map(permission => ({
      permission,
      description: PERMISSION_DESCRIPTIONS[permission]
    })),
    permission_presets: Object.entries(PERMISSION_PRESETS).map(([name, permissions]) => ({
      name,
      permissions,
      description: getPresetDescription(name)
    })),
    limits: {
      max_keys_per_user: 10,
      max_name_length: 100,
      max_expiration_days: 365,
      max_rate_limit: 10000,
      min_rate_limit: 1
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Helper function to get key status
 */
function getKeyStatus(key: Partial<{ is_active?: boolean; expires_at?: number }>): string {
  if (!key.is_active) {
    return 'revoked';
  }
  
  if (key.expires_at && key.expires_at <= Date.now()) {
    return 'expired';
  }
  
  if (key.expires_at) {
    return 'active_expiring';
  }
  
  return 'active';
}

/**
 * Helper function to get preset descriptions
 */
function getPresetDescription(name: string): string {
  const descriptions: Record<string, string> = {
    'READ_ONLY': 'Read-only access to authentication and file data',
    'LIST_PROCESSING': 'Full access to list processing and file operations',
    'FULL_ACCESS': 'Complete access to all available features',
    'BASIC_USER': 'Standard user permissions for most operations'
  };
  
  return descriptions[name] || 'Custom permission set';
}
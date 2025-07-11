import type { Env, APIKey, APIKeyCreateRequest } from '../../types';
import { APIPermission } from '../../types/permissions';
import { SecurityLogger } from '../security/logger';

/**
 * API Key Service for programmatic authentication
 * 
 * Provides comprehensive API key management including generation, validation,
 * revocation, and usage tracking. API keys use secure hashing, custom permissions,
 * and configurable rate limiting for fine-grained access control.
 * 
 * Features:
 * - Secure key generation with 'cutty_' prefix
 * - SHA-256 hashing with salting for storage security  
 * - Granular permission system
 * - Usage tracking and analytics
 * - Custom rate limiting per key
 * - Automatic expiration support
 * 
 * @class APIKeyService
 * @author Cutty Authentication System
 * @version 1.0.0
 * @since 1.0.0
 */
export class APIKeyService {
  /** Environment object containing database and KV bindings */
  private env: Env;
  /** Security logger for audit events */
  private logger: SecurityLogger;
  
  /**
   * Create new API Key Service instance
   * 
   * @param env - Environment object with database and KV bindings
   */
  constructor(env: Env) {
    this.env = env;
    this.logger = new SecurityLogger(env);
  }
  
  /**
   * Generate a new API key for a user
   * 
   * Creates a secure API key with the specified permissions and configuration.
   * The key is hashed before storage and cannot be retrieved after creation.
   * Supports custom expiration dates and rate limiting overrides.
   * 
   * @param userId - Database ID of the user creating the key
   * @param request - API key creation parameters
   * @param request.name - Human-readable name for the key
   * @param request.permissions - Array of permission strings
   * @param request.expires_in_days - Optional expiration in days (1-365)
   * @param request.rate_limit_override - Optional custom rate limit (1-10000)
   * @returns Promise resolving to key ID and the actual API key string
   * 
   * @throws {Error} When permission validation fails
   * @throws {Error} When database operation fails
   * @throws {Error} When key generation fails
   * 
   * @example
   * ```typescript
   * const service = new APIKeyService(env);
   * const { key_id, api_key } = await service.generateAPIKey(userId, {
   *   name: 'Mobile App Key',
   *   permissions: ['files:read', 'files:write'],
   *   expires_in_days: 90,
   *   rate_limit_override: 120
   * });
   * 
   * // Store the api_key securely - it cannot be retrieved again
   * console.log('Key ID:', key_id);
   * console.log('API Key:', api_key); // Only shown once
   * ```
   * 
   * @example
   * ```typescript
   * // Create a key with minimal permissions
   * const readOnlyKey = await service.generateAPIKey(userId, {
   *   name: 'Read Only Access',
   *   permissions: ['files:read', 'analytics:read']
   * });
   * ```
   * 
   * @see {@link validateAPIKey} for key validation
   * @see {@link revokeAPIKey} for key revocation
   * @since 1.0.0
   */
  async generateAPIKey(
    userId: number,
    request: APIKeyCreateRequest
  ): Promise<{ key_id: string; api_key: string }> {
    const keyId = crypto.randomUUID();
    const keyPrefix = 'cutty_';
    const keySecret = this.generateSecureKey();
    const apiKey = keyPrefix + keySecret;
    
    // Hash the API key for storage
    const keyHash = await this.hashAPIKey(apiKey);
    
    // Calculate expiration
    const expiresAt = request.expires_in_days 
      ? Date.now() + (request.expires_in_days * 24 * 60 * 60 * 1000)
      : null;
    
    // Validate permissions
    const validPermissions = request.permissions.every(p => 
      Object.values(APIPermission).includes(p as APIPermission)
    );
    
    if (!validPermissions) {
      throw new Error('Invalid permissions specified');
    }
    
    // Store in database
    await this.env.DB.prepare(`
      INSERT INTO api_keys (
        key_id, user_id, name, key_hash, key_prefix, permissions,
        created_at, expires_at, is_active, rate_limit_override
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      keyId,
      userId,
      request.name,
      keyHash,
      keyPrefix,
      JSON.stringify(request.permissions),
      Date.now(),
      expiresAt,
      1,
      request.rate_limit_override
    ).run();
    
    // Log API key creation
    await this.logger.logEvent({
      timestamp: Date.now(),
      event_type: 'api_key_created',
      user_id: userId,
      success: true,
      metadata: {
        key_id: keyId,
        key_name: request.name,
        permissions: request.permissions,
        expires_at: expiresAt
      }
    });
    
    return { key_id: keyId, api_key: apiKey };
  }
  
  /**
   * Validate an API key and return its metadata
   * 
   * Verifies the API key format, checks the hash against stored values,
   * validates expiration and active status. Updates the last_used timestamp
   * on successful validation for usage tracking.
   * 
   * @param apiKey - Full API key string including 'cutty_' prefix
   * @returns Promise resolving to API key object or null if invalid
   * 
   * @throws Never throws - returns null for all validation failures
   * 
   * @example
   * ```typescript
   * const service = new APIKeyService(env);
   * const keyData = await service.validateAPIKey('cutty_abc123...');
   * 
   * if (keyData) {
   *   console.log('Key belongs to user:', keyData.user_id);
   *   console.log('Permissions:', keyData.permissions);
   *   console.log('Rate limit:', keyData.rate_limit_override || 'default');
   * } else {
   *   console.log('Invalid or expired API key');
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Use in authentication middleware
   * const authHeader = request.headers.get('Authorization');
   * if (authHeader?.startsWith('Bearer cutty_')) {
   *   const apiKey = authHeader.substring(7);
   *   const keyData = await service.validateAPIKey(apiKey);
   *   
   *   if (keyData) {
   *     // API key is valid, proceed with request
   *     request.apiKeyContext = { 
   *       api_key: keyData, 
   *       user_id: keyData.user_id,
   *       permissions: keyData.permissions 
   *     };
   *   }
   * }
   * ```
   * 
   * @see {@link generateAPIKey} for key creation
   * @see {@link hasPermission} for permission checking
   * @since 1.0.0
   */
  async validateAPIKey(apiKey: string): Promise<APIKey | null> {
    try {
      // Extract prefix to validate format
      if (!apiKey.startsWith('cutty_')) {
        return null;
      }
      
      // Hash the provided key
      const keyHash = await this.hashAPIKey(apiKey);
      
      // Look up in database
      const result = await this.env.DB.prepare(`
        SELECT * FROM api_keys 
        WHERE key_hash = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > ?)
      `).bind(keyHash, Date.now()).first();
      
      if (!result) {
        return null;
      }
      
      // Update last_used timestamp
      await this.env.DB.prepare(`
        UPDATE api_keys SET last_used = ? WHERE key_id = ?
      `).bind(Date.now(), result.key_id).run();
      
      // Return API key object
      return {
        key_id: result.key_id as string,
        user_id: result.user_id as number,
        name: result.name as string,
        key_hash: result.key_hash as string,
        key_prefix: result.key_prefix as string,
        permissions: JSON.parse(result.permissions as string),
        created_at: result.created_at as number,
        last_used: result.last_used as number,
        expires_at: result.expires_at as number,
        is_active: Boolean(result.is_active),
        rate_limit_override: result.rate_limit_override as number
      };
      
    } catch (error) {
      console.error('API key validation error:', error);
      return null;
    }
  }
  
  async revokeAPIKey(keyId: string, userId: number): Promise<boolean> {
    try {
      const result = await this.env.DB.prepare(`
        UPDATE api_keys SET is_active = 0 
        WHERE key_id = ? AND user_id = ?
      `).bind(keyId, userId).run();
      
      if (result.changes > 0) {
        await this.logger.logEvent({
          timestamp: Date.now(),
          event_type: 'api_key_revoked',
          user_id: userId,
          success: true,
          metadata: { key_id: keyId }
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('API key revocation error:', error);
      return false;
    }
  }
  
  async listAPIKeys(userId: number): Promise<Partial<APIKey>[]> {
    const results = await this.env.DB.prepare(`
      SELECT key_id, name, permissions, created_at, last_used, 
             expires_at, is_active, rate_limit_override
      FROM api_keys 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).bind(userId).all();
    
    return results.results.map(row => ({
      key_id: row.key_id as string,
      name: row.name as string,
      permissions: JSON.parse(row.permissions as string),
      created_at: row.created_at as number,
      last_used: row.last_used as number,
      expires_at: row.expires_at as number,
      is_active: Boolean(row.is_active),
      rate_limit_override: row.rate_limit_override as number
    }));
  }
  
  async getAPIKeyUsage(keyId: string, userId: number, days: number = 30): Promise<any[]> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Verify the key belongs to the user
    const keyCheck = await this.env.DB.prepare(`
      SELECT user_id FROM api_keys WHERE key_id = ?
    `).bind(keyId).first();
    
    if (!keyCheck || keyCheck.user_id !== userId) {
      throw new Error('API key not found or access denied');
    }
    
    const results = await this.env.DB.prepare(`
      SELECT timestamp, endpoint, method, response_status, response_time
      FROM api_key_usage 
      WHERE key_id = ? AND timestamp > ?
      ORDER BY timestamp DESC
      LIMIT 1000
    `).bind(keyId, since).all();
    
    return results.results;
  }
  
  async getAPIKeyStats(keyId: string, userId: number, days: number = 30): Promise<any> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Verify the key belongs to the user
    const keyCheck = await this.env.DB.prepare(`
      SELECT user_id FROM api_keys WHERE key_id = ?
    `).bind(keyId).first();
    
    if (!keyCheck || keyCheck.user_id !== userId) {
      throw new Error('API key not found or access denied');
    }
    
    const stats = await this.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_requests,
        AVG(response_time) as avg_response_time,
        MAX(response_time) as max_response_time,
        MIN(timestamp) as first_request,
        MAX(timestamp) as last_request
      FROM api_key_usage
      WHERE key_id = ? AND timestamp > ?
    `).bind(keyId, since).first();
    
    return stats;
  }
  
  private generateSecureKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32);
  }
  
  private async hashAPIKey(apiKey: string): Promise<string> {
    const salt = this.env.API_KEY_SALT || 'default-salt-change-in-production';
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  }
  
  /**
   * Check if API key has specific permission
   */
  hasPermission(apiKey: APIKey, permission: APIPermission): boolean {
    return apiKey.permissions.includes(permission);
  }
  
  /**
   * Check if API key has all required permissions
   */
  hasAllPermissions(apiKey: APIKey, permissions: APIPermission[]): boolean {
    return permissions.every(permission => this.hasPermission(apiKey, permission));
  }
  
  /**
   * Get API key by ID for a specific user
   */
  async getAPIKey(keyId: string, userId: number): Promise<Partial<APIKey> | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT key_id, name, permissions, created_at, last_used, 
               expires_at, is_active, rate_limit_override
        FROM api_keys 
        WHERE key_id = ? AND user_id = ?
      `).bind(keyId, userId).first();
      
      if (!result) {
        return null;
      }
      
      return {
        key_id: result.key_id as string,
        name: result.name as string,
        permissions: JSON.parse(result.permissions as string),
        created_at: result.created_at as number,
        last_used: result.last_used as number,
        expires_at: result.expires_at as number,
        is_active: Boolean(result.is_active),
        rate_limit_override: result.rate_limit_override as number
      };
      
    } catch (error) {
      console.error('Failed to get API key:', error);
      return null;
    }
  }
}
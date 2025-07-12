# Phase 6 API Key Management Implementation Plan

## Target Audience
This document is designed for a Claude subagent responsible for implementing the optional API key management system for programmatic access to the authentication system.

## Current State Analysis

### ✅ What's Already Done
- Complete JWT-based authentication system
- User management and database schema
- Security middleware and rate limiting
- Comprehensive authentication routes

### ❌ API Key Management Gaps
- **No API Key System**: No API key generation or validation
- **No API Key Database Schema**: Missing database tables for API keys
- **No API Key Routes**: No endpoints for API key management
- **No API Key Authentication**: No alternative authentication method
- **No API Key Permissions**: No granular permission system

## Implementation Strategy

### Phase 1: Database Schema Extension (Priority: HIGH)

#### 1.1 API Key Database Schema

**Add to `/workers/schema.sql`:**
```sql
-- API Keys table
CREATE TABLE api_keys (
  key_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions TEXT NOT NULL, -- JSON array of permissions
  created_at INTEGER NOT NULL,
  last_used INTEGER,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  rate_limit_override INTEGER, -- Custom rate limit for this key
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- API Key usage tracking
CREATE TABLE api_key_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  response_status INTEGER,
  response_time INTEGER,
  FOREIGN KEY (key_id) REFERENCES api_keys (key_id) ON DELETE CASCADE
);

-- Indexes for API key operations
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at);

-- Indexes for usage tracking
CREATE INDEX idx_api_key_usage_key_id ON api_key_usage(key_id);
CREATE INDEX idx_api_key_usage_timestamp ON api_key_usage(timestamp);
CREATE INDEX idx_api_key_usage_endpoint ON api_key_usage(endpoint);
```

#### 1.2 Permission System

**File: `/workers/src/types/permissions.ts`**
```typescript
export enum APIPermission {
  // Authentication permissions
  AUTH_READ = 'auth:read',
  AUTH_WRITE = 'auth:write',
  
  // File operations
  FILES_READ = 'files:read',
  FILES_WRITE = 'files:write',
  FILES_DELETE = 'files:delete',
  
  // List cutting operations
  LIST_PROCESS = 'list:process',
  LIST_EXPORT = 'list:export',
  
  // Analytics (for future)
  ANALYTICS_READ = 'analytics:read',
  
  // Admin operations
  ADMIN_READ = 'admin:read',
  ADMIN_WRITE = 'admin:write'
}

export interface APIKeyPermissions {
  permissions: APIPermission[];
  rate_limit?: number;
  expires_at?: number;
  allowed_ips?: string[];
}

export const PERMISSION_DESCRIPTIONS = {
  [APIPermission.AUTH_READ]: 'Read authentication status and user info',
  [APIPermission.AUTH_WRITE]: 'Modify authentication settings',
  [APIPermission.FILES_READ]: 'Read file information and download files',
  [APIPermission.FILES_WRITE]: 'Upload and modify files',
  [APIPermission.FILES_DELETE]: 'Delete files',
  [APIPermission.LIST_PROCESS]: 'Process CSV files and perform list operations',
  [APIPermission.LIST_EXPORT]: 'Export processed lists',
  [APIPermission.ANALYTICS_READ]: 'Read analytics and usage statistics',
  [APIPermission.ADMIN_READ]: 'Read admin-level information',
  [APIPermission.ADMIN_WRITE]: 'Perform admin operations'
};
```

### Phase 2: API Key Service Implementation (Priority: HIGH)

#### 2.1 API Key Generation and Management

**File: `/workers/src/services/auth/apiKeys.ts`**
```typescript
import { APIPermission, APIKeyPermissions } from '../../types/permissions';
import { SecurityLogger } from '../security/logger';

export interface APIKey {
  key_id: string;
  user_id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: APIPermission[];
  created_at: number;
  last_used?: number;
  expires_at?: number;
  is_active: boolean;
  rate_limit_override?: number;
}

export interface APIKeyCreateRequest {
  name: string;
  permissions: APIPermission[];
  expires_in_days?: number;
  rate_limit_override?: number;
}

export class APIKeyService {
  private env: Env;
  private logger: SecurityLogger;
  
  constructor(env: Env) {
    this.env = env;
    this.logger = new SecurityLogger(env);
  }
  
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
    
    const results = await this.env.DB.prepare(`
      SELECT timestamp, endpoint, method, response_status, response_time
      FROM api_key_usage 
      WHERE key_id = ? AND timestamp > ?
      ORDER BY timestamp DESC
      LIMIT 1000
    `).bind(keyId, since).all();
    
    return results.results;
  }
  
  private generateSecureKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32);
  }
  
  private async hashAPIKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey + this.env.API_KEY_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  }
}
```

#### 2.2 Usage Tracking

**File: `/workers/src/services/auth/apiKeyUsage.ts`**
```typescript
export class APIKeyUsageTracker {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  async trackUsage(
    keyId: string,
    request: Request,
    responseStatus: number,
    responseTime: number
  ): Promise<void> {
    const url = new URL(request.url);
    const ipAddress = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';
    
    try {
      await this.env.DB.prepare(`
        INSERT INTO api_key_usage (
          key_id, timestamp, endpoint, method, ip_address, 
          user_agent, response_status, response_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        keyId,
        Date.now(),
        url.pathname,
        request.method,
        ipAddress,
        request.headers.get('User-Agent') || 'unknown',
        responseStatus,
        responseTime
      ).run();
      
    } catch (error) {
      console.error('Failed to track API key usage:', error);
    }
  }
  
  async getUsageStats(keyId: string, days: number = 30): Promise<any> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
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
}
```

### Phase 3: API Key Authentication Middleware (Priority: HIGH)

#### 3.1 API Key Authentication

**File: `/workers/src/middleware/apiKeyAuth.ts`**
```typescript
import { APIKeyService } from '../services/auth/apiKeys';
import { APIKeyUsageTracker } from '../services/auth/apiKeyUsage';
import { APIPermission } from '../types/permissions';

export interface APIKeyAuthContext {
  api_key: APIKey;
  user_id: number;
  permissions: APIPermission[];
}

export async function apiKeyAuthMiddleware(
  request: Request,
  env: Env,
  requiredPermissions: APIPermission[] = []
): Promise<{ authorized: boolean; context?: APIKeyAuthContext; response?: Response }> {
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
      return {
        authorized: false,
        response: new Response(JSON.stringify({ 
          error: 'Invalid API key' 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
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
        response: new Response(JSON.stringify({ 
          error: 'Insufficient permissions',
          required: requiredPermissions,
          granted: validatedKey.permissions
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
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
          response: new Response(JSON.stringify({ 
            error: 'Rate limit exceeded',
            limit: validatedKey.rate_limit_override,
            reset_time: rateLimitResult.resetTime
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
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
    return {
      authorized: false,
      response: new Response(JSON.stringify({ 
        error: 'Authentication error' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
}

async function checkAPIKeyRateLimit(
  keyId: string,
  limit: number,
  env: Env
): Promise<{ allowed: boolean; resetTime?: number }> {
  const window = 60000; // 1 minute
  const currentWindow = Math.floor(Date.now() / window);
  const rateLimitKey = `api_rate_limit:${keyId}:${currentWindow}`;
  
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
}
```

### Phase 4: API Key Management Routes (Priority: MEDIUM)

#### 4.1 API Key CRUD Operations

**File: `/workers/src/routes/api-keys/manage.ts`**
```typescript
import { APIKeyService } from '../../services/auth/apiKeys';
import { APIPermission } from '../../types/permissions';

export async function createAPIKey(
  request: Request,
  env: Env,
  userId: number
): Promise<Response> {
  const apiKeyService = new APIKeyService(env);
  
  try {
    const body = await request.json();
    const { name, permissions, expires_in_days, rate_limit_override } = body;
    
    // Validate input
    if (!name || !permissions || !Array.isArray(permissions)) {
      return new Response(JSON.stringify({ 
        error: 'Name and permissions are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate permissions
    const validPermissions = permissions.every(p => 
      Object.values(APIPermission).includes(p)
    );
    
    if (!validPermissions) {
      return new Response(JSON.stringify({ 
        error: 'Invalid permissions specified' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate API key
    const result = await apiKeyService.generateAPIKey(userId, {
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
      expires_in_days
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('API key creation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create API key' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function listAPIKeys(
  request: Request,
  env: Env,
  userId: number
): Promise<Response> {
  const apiKeyService = new APIKeyService(env);
  
  try {
    const keys = await apiKeyService.listAPIKeys(userId);
    
    return new Response(JSON.stringify({
      api_keys: keys.map(key => ({
        key_id: key.key_id,
        name: key.name,
        permissions: key.permissions,
        created_at: key.created_at,
        last_used: key.last_used,
        expires_at: key.expires_at,
        is_active: key.is_active,
        rate_limit_override: key.rate_limit_override
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('API key listing error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to list API keys' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function revokeAPIKey(
  request: Request,
  env: Env,
  userId: number,
  keyId: string
): Promise<Response> {
  const apiKeyService = new APIKeyService(env);
  
  try {
    const success = await apiKeyService.revokeAPIKey(keyId, userId);
    
    if (success) {
      return new Response(JSON.stringify({
        message: 'API key revoked successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        error: 'API key not found or already revoked' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('API key revocation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to revoke API key' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function getAPIKeyUsage(
  request: Request,
  env: Env,
  userId: number,
  keyId: string
): Promise<Response> {
  const apiKeyService = new APIKeyService(env);
  
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    
    const usage = await apiKeyService.getAPIKeyUsage(keyId, userId, days);
    
    return new Response(JSON.stringify({
      key_id: keyId,
      usage_period_days: days,
      usage_data: usage
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('API key usage error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get API key usage' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Phase 5: Frontend Integration (Priority: LOW)

#### 5.1 API Key Management UI Components

**File: `/workers/src/routes/api-keys/frontend.ts`**
```typescript
export async function renderAPIKeyManagement(
  request: Request,
  env: Env,
  userId: number
): Promise<Response> {
  const apiKeyService = new APIKeyService(env);
  const keys = await apiKeyService.listAPIKeys(userId);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>API Key Management</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .key-card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .permissions { font-size: 0.9em; color: #666; }
        .create-form { background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .form-group { margin: 10px 0; }
        label { display: block; margin-bottom: 5px; }
        input, select { width: 100%; padding: 8px; margin-bottom: 10px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 3px; cursor: pointer; }
        .revoke-btn { background: #d32f2f; }
        .usage-stats { font-size: 0.9em; color: #666; margin-top: 10px; }
      </style>
    </head>
    <body>
      <h1>API Key Management</h1>
      
      <div class="create-form">
        <h2>Create New API Key</h2>
        <form id="createKeyForm">
          <div class="form-group">
            <label>Name:</label>
            <input type="text" id="keyName" required />
          </div>
          <div class="form-group">
            <label>Permissions:</label>
            <select id="permissions" multiple>
              <option value="auth:read">Read Authentication</option>
              <option value="auth:write">Write Authentication</option>
              <option value="files:read">Read Files</option>
              <option value="files:write">Write Files</option>
              <option value="list:process">Process Lists</option>
              <option value="list:export">Export Lists</option>
            </select>
          </div>
          <div class="form-group">
            <label>Expires In (days):</label>
            <input type="number" id="expiresIn" min="1" max="365" />
          </div>
          <button type="submit">Create API Key</button>
        </form>
      </div>
      
      <h2>Existing API Keys</h2>
      <div id="apiKeys">
        ${keys.map(key => `
          <div class="key-card">
            <h3>${key.name}</h3>
            <p><strong>Key ID:</strong> ${key.key_id}</p>
            <p class="permissions"><strong>Permissions:</strong> ${key.permissions.join(', ')}</p>
            <p><strong>Created:</strong> ${new Date(key.created_at).toLocaleDateString()}</p>
            <p><strong>Last Used:</strong> ${key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}</p>
            <p><strong>Status:</strong> ${key.is_active ? 'Active' : 'Revoked'}</p>
            ${key.expires_at ? `<p><strong>Expires:</strong> ${new Date(key.expires_at).toLocaleDateString()}</p>` : ''}
            ${key.is_active ? `<button class="revoke-btn" onclick="revokeKey('${key.key_id}')">Revoke</button>` : ''}
          </div>
        `).join('')}
      </div>
      
      <script>
        document.getElementById('createKeyForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = {
            name: document.getElementById('keyName').value,
            permissions: Array.from(document.getElementById('permissions').selectedOptions).map(o => o.value),
            expires_in_days: document.getElementById('expiresIn').value ? parseInt(document.getElementById('expiresIn').value) : null
          };
          
          try {
            const response = await fetch('/api/api-keys', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('access_token')
              },
              body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (response.ok) {
              alert('API Key created successfully!\\n\\nKey: ' + result.api_key + '\\n\\nSave this key - it will not be shown again!');
              location.reload();
            } else {
              alert('Error: ' + result.error);
            }
          } catch (error) {
            alert('Error creating API key: ' + error.message);
          }
        });
        
        async function revokeKey(keyId) {
          if (!confirm('Are you sure you want to revoke this API key?')) return;
          
          try {
            const response = await fetch(\`/api/api-keys/\${keyId}\`, {
              method: 'DELETE',
              headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('access_token')
              }
            });
            
            const result = await response.json();
            if (response.ok) {
              alert('API key revoked successfully');
              location.reload();
            } else {
              alert('Error: ' + result.error);
            }
          } catch (error) {
            alert('Error revoking API key: ' + error.message);
          }
        }
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

## Implementation Checklist

### Phase 1: Database Schema (Day 1)
- [ ] Add API key tables to schema
- [ ] Add usage tracking tables
- [ ] Create proper indexes
- [ ] Deploy schema updates

### Phase 2: Core Services (Day 2-3)
- [ ] Implement APIKeyService class
- [ ] Add secure key generation
- [ ] Add key validation and hashing
- [ ] Implement usage tracking

### Phase 3: Authentication Middleware (Day 4)
- [ ] Create API key authentication middleware
- [ ] Add permission checking
- [ ] Implement rate limiting for API keys
- [ ] Add usage tracking integration

### Phase 4: API Routes (Day 5-6)
- [ ] Create API key management endpoints
- [ ] Add CRUD operations
- [ ] Implement usage statistics
- [ ] Add proper error handling

### Phase 5: Frontend Integration (Day 7)
- [ ] Create API key management UI
- [ ] Add key creation form
- [ ] Display existing keys
- [ ] Add revocation functionality

## Success Criteria

### Core Functionality
- [ ] API key generation and validation working
- [ ] Permission system operational
- [ ] Usage tracking functional
- [ ] Rate limiting for API keys

### Security Requirements
- [ ] Secure key generation
- [ ] Proper key hashing and storage
- [ ] Permission validation
- [ ] Usage monitoring

### User Experience
- [ ] Easy key creation and management
- [ ] Clear permission descriptions
- [ ] Usage statistics available
- [ ] Secure key display (one-time only)

## Critical Notes for Subagent

- **Security Priority**: API keys must be securely generated and stored
- **One-Time Display**: API keys should only be shown once during creation
- **Permission Model**: Use granular permissions for different operations
- **Usage Tracking**: Track all API key usage for security monitoring
- **Rate Limiting**: Implement custom rate limits per API key

This API key management system will provide secure programmatic access to the authentication system while maintaining comprehensive security controls.
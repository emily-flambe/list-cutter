import {
  FileShareToken,
  ShareTokenRequest,
  ShareTokenResponse,
  FileOperation,
  FileAccessAudit,
  InvalidShareTokenError,
  ShareTokenExpiredError,
  MaxSharesExceededError
} from '../../types/permissions';
import { AccessControlService } from './access-control';

export interface ShareTokenValidation {
  valid: boolean;
  permissions: FileOperation[];
  auditId?: string;
  reason?: string;
  expiresAt?: Date;
  usesRemaining?: number;
}

export interface ShareTokenContext {
  fileId: string;
  operation: FileOperation;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Secure File Sharing Service
 * Handles time-limited token generation and validation for file sharing
 */
export class FileSharingService {
  private db: D1Database;
  private kvStore: KVNamespace;
  private accessControl: AccessControlService;
  private readonly TOKEN_PREFIX = 'fst_';
  private readonly _MAX_TOKEN_LENGTH = 64;

  constructor(db: D1Database, kvStore: KVNamespace) {
    this.db = db;
    this.kvStore = kvStore;
    this.accessControl = new AccessControlService(db);
  }

  /**
   * Create a secure share token for a file
   */
  async createShareToken(
    userId: string,
    request: ShareTokenRequest
  ): Promise<ShareTokenResponse> {
    const startTime = Date.now();

    try {
      // Verify user has permission to share the file
      const sharePermission = await this.accessControl.checkPermission({
        userId,
        fileId: request.fileId,
        operation: FileOperation.SHARE
      });

      if (!sharePermission.allowed) {
        throw new Error('Insufficient permissions to share file');
      }

      // Check if file has reached max shares limit
      const currentShares = await this.getActiveSharesCount(request.fileId);
      const maxShares = await this.getMaxSharesLimit();
      
      if (currentShares >= maxShares) {
        throw new MaxSharesExceededError(request.fileId, maxShares);
      }

      // Generate secure token
      const token = this.generateSecureToken();
      const tokenHash = await this.hashToken(token);
      
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (request.expiresIn * 1000));
      
      // Validate expiration time doesn't exceed policy limit
      const maxTokenLifetime = await this.getMaxTokenLifetime();
      const maxExpiresAt = new Date(Date.now() + (maxTokenLifetime * 1000));
      
      if (expiresAt > maxExpiresAt) {
        throw new Error(`Token expiration exceeds maximum allowed lifetime of ${maxTokenLifetime} seconds`);
      }

      // Create share token record
      const shareTokenId = crypto.randomUUID();
      await this.db
        .prepare(`
          INSERT INTO file_share_tokens 
          (id, file_id, shared_by, token, token_hash, permissions, expires_at, max_uses, ip_whitelist, description, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `)
        .bind(
          shareTokenId,
          request.fileId,
          userId,
          token,
          tokenHash,
          JSON.stringify(request.permissions),
          expiresAt.toISOString(),
          request.maxUses || null,
          request.ipWhitelist ? JSON.stringify(request.ipWhitelist) : null,
          request.description || null
        )
        .run();

      // Store token in KV for fast lookup
      await this.kvStore.put(
        `share_token:${tokenHash}`,
        JSON.stringify({
          id: shareTokenId,
          fileId: request.fileId,
          sharedBy: userId,
          permissions: request.permissions,
          expiresAt: expiresAt.toISOString(),
          maxUses: request.maxUses,
          ipWhitelist: request.ipWhitelist
        }),
        {
          expirationTtl: request.expiresIn
        }
      );

      // Generate share URL
      const shareUrl = this.generateShareUrl(token);

      // Audit the share token creation
      await this.auditTokenAction({
        fileId: request.fileId,
        userId,
        operation: FileOperation.SHARE,
        result: 'allowed',
        reason: 'share_token_created',
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'create_share_token',
          tokenId: shareTokenId,
          permissions: request.permissions,
          expiresIn: request.expiresIn,
          maxUses: request.maxUses
        }
      });

      return {
        token,
        shareUrl,
        expiresAt,
        permissions: request.permissions,
        maxUses: request.maxUses
      };

    } catch (error) {
      // Audit the failed share token creation
      await this.auditTokenAction({
        fileId: request.fileId,
        userId,
        operation: FileOperation.SHARE,
        result: 'denied',
        reason: error instanceof Error ? error.message : 'unknown_error',
        durationMs: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Validate a share token for file access
   */
  async validateShareToken(
    token: string,
    context: ShareTokenContext
  ): Promise<ShareTokenValidation> {
    const startTime = Date.now();

    try {
      // Hash the token for lookup
      const tokenHash = await this.hashToken(token);

      // Try KV lookup first for performance
      const kvData = await this.kvStore.get(`share_token:${tokenHash}`, 'json');
      
      let shareToken: Partial<FileShareToken>;
      
      if (kvData) {
        shareToken = kvData as Partial<FileShareToken>;
      } else {
        // Fallback to database lookup
        const dbRecord = await this.db
          .prepare(`
            SELECT id, file_id, shared_by, permissions, expires_at, max_uses, used_count, ip_whitelist, is_active
            FROM file_share_tokens 
            WHERE token_hash = ? AND is_active = 1
          `)
          .bind(tokenHash)
          .first();

        if (!dbRecord) {
          throw new InvalidShareTokenError(token);
        }

        shareToken = {
          id: dbRecord.id as string,
          fileId: dbRecord.file_id as string,
          sharedBy: dbRecord.shared_by as string,
          permissions: JSON.parse(dbRecord.permissions as string),
          expiresAt: new Date(dbRecord.expires_at as string),
          maxUses: dbRecord.max_uses as number | undefined,
          usedCount: dbRecord.used_count as number,
          ipWhitelist: dbRecord.ip_whitelist ? JSON.parse(dbRecord.ip_whitelist as string) : null
        };
      }

      // Validate token belongs to the requested file
      if (shareToken.fileId !== context.fileId) {
        throw new InvalidShareTokenError(token);
      }

      // Check if token has expired
      if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
        throw new ShareTokenExpiredError(token);
      }

      // Check if token has exceeded max uses
      if (shareToken.maxUses && (shareToken.usedCount || 0) >= shareToken.maxUses) {
        throw new Error('Share token has reached maximum usage limit');
      }

      // Check IP whitelist if configured
      if (shareToken.ipWhitelist && context.ipAddress) {
        const isAllowedIp = shareToken.ipWhitelist.includes(context.ipAddress);
        if (!isAllowedIp) {
          throw new Error('IP address not allowed for this share token');
        }
      }

      // Check if token has permission for the requested operation
      const permissions = shareToken.permissions as FileOperation[];
      if (!permissions.includes(context.operation)) {
        throw new Error(`Operation '${context.operation}' not permitted by share token`);
      }

      // Increment usage count
      if (shareToken.id) {
        await this.incrementTokenUsage(shareToken.id, context);
      }

      // Audit successful token validation
      const auditId = await this.auditTokenAction({
        fileId: context.fileId,
        shareToken: token,
        operation: context.operation,
        result: 'allowed',
        reason: 'share_token_validated',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'validate_share_token',
          tokenId: shareToken.id,
          permissions: permissions,
          usedCount: (shareToken.usedCount || 0) + 1
        }
      });

      return {
        valid: true,
        permissions,
        auditId,
        reason: 'share_token_valid',
        expiresAt: shareToken.expiresAt,
        usesRemaining: shareToken.maxUses ? shareToken.maxUses - (shareToken.usedCount || 0) - 1 : undefined
      };

    } catch (error) {
      // Audit failed token validation
      await this.auditTokenAction({
        fileId: context.fileId,
        shareToken: token,
        operation: context.operation,
        result: 'denied',
        reason: error instanceof Error ? error.message : 'unknown_error',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        durationMs: Date.now() - startTime
      });

      return {
        valid: false,
        permissions: [],
        reason: error instanceof Error ? error.message : 'unknown_error'
      };
    }
  }

  /**
   * Revoke a share token
   */
  async revokeShareToken(userId: string, tokenId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Get token information
      const tokenRecord = await this.db
        .prepare(`
          SELECT id, file_id, shared_by, token_hash 
          FROM file_share_tokens 
          WHERE id = ? AND is_active = 1
        `)
        .bind(tokenId)
        .first();

      if (!tokenRecord) {
        throw new Error('Share token not found');
      }

      // Verify user has permission to revoke the token
      const isOwner = tokenRecord.shared_by === userId;
      const hasAdminPermission = await this.accessControl.checkPermission({
        userId,
        fileId: tokenRecord.file_id as string,
        operation: FileOperation.ADMIN
      });

      if (!isOwner && !hasAdminPermission.allowed) {
        throw new Error('Insufficient permissions to revoke share token');
      }

      // Deactivate token in database
      await this.db
        .prepare(`
          UPDATE file_share_tokens 
          SET is_active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(tokenId)
        .run();

      // Remove from KV store
      await this.kvStore.delete(`share_token:${tokenRecord.token_hash}`);

      // Audit the token revocation
      await this.auditTokenAction({
        fileId: tokenRecord.file_id as string,
        userId,
        operation: FileOperation.ADMIN,
        result: 'allowed',
        reason: 'share_token_revoked',
        durationMs: Date.now() - startTime,
        metadata: {
          action: 'revoke_share_token',
          tokenId,
          revokedBy: userId
        }
      });

    } catch (error) {
      // Audit the failed token revocation
      await this.auditTokenAction({
        fileId: 'unknown',
        userId,
        operation: FileOperation.ADMIN,
        result: 'denied',
        reason: error instanceof Error ? error.message : 'unknown_error',
        durationMs: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * List active share tokens for a file
   */
  async listFileShareTokens(userId: string, fileId: string): Promise<FileShareToken[]> {
    // Verify user has permission to view shares
    const adminPermission = await this.accessControl.checkPermission({
      userId,
      fileId,
      operation: FileOperation.ADMIN
    });

    if (!adminPermission.allowed) {
      throw new Error('Insufficient permissions to view share tokens');
    }

    const tokens = await this.db
      .prepare(`
        SELECT id, file_id, shared_by, permissions, expires_at, max_uses, used_count, description, created_at, last_used_at
        FROM file_share_tokens 
        WHERE file_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `)
      .bind(fileId)
      .all();

    return tokens.results.map(token => ({
      id: token.id as string,
      fileId: token.file_id as string,
      sharedBy: token.shared_by as string,
      token: '', // Don't expose actual token
      tokenHash: '', // Don't expose hash
      permissions: JSON.parse(token.permissions as string),
      expiresAt: new Date(token.expires_at as string),
      maxUses: token.max_uses as number | undefined,
      usedCount: token.used_count as number,
      ipWhitelist: undefined, // Don't expose IP whitelist
      isActive: true,
      createdAt: new Date(token.created_at as string),
      lastUsedAt: token.last_used_at ? new Date(token.last_used_at as string) : undefined
    }));
  }

  /**
   * Clean up expired share tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.db
      .prepare(`
        UPDATE file_share_tokens 
        SET is_active = 0 
        WHERE expires_at < datetime('now') AND is_active = 1
      `)
      .run();

    return result.meta.changes;
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return this.TOKEN_PREFIX + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash a token for secure storage
   */
  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate share URL for a token
   */
  private generateShareUrl(token: string): string {
    // This would be configured based on your domain
    return `https://your-domain.com/share/${token}`;
  }

  /**
   * Get active shares count for a file
   */
  private async getActiveSharesCount(fileId: string): Promise<number> {
    const result = await this.db
      .prepare(`
        SELECT COUNT(*) as count 
        FROM file_share_tokens 
        WHERE file_id = ? AND is_active = 1 AND expires_at > datetime('now')
      `)
      .bind(fileId)
      .first();

    return result?.count as number || 0;
  }

  /**
   * Get maximum shares limit from security policy
   */
  private async getMaxSharesLimit(): Promise<number> {
    const policy = await this.db
      .prepare(`
        SELECT max_shares_per_file 
        FROM security_policies 
        WHERE is_active = 1 
        ORDER BY created_at DESC 
        LIMIT 1
      `)
      .first();

    return policy?.max_shares_per_file as number || 100;
  }

  /**
   * Get maximum token lifetime from security policy
   */
  private async getMaxTokenLifetime(): Promise<number> {
    const policy = await this.db
      .prepare(`
        SELECT max_token_lifetime 
        FROM security_policies 
        WHERE is_active = 1 
        ORDER BY created_at DESC 
        LIMIT 1
      `)
      .first();

    return policy?.max_token_lifetime as number || 604800; // 7 days
  }

  /**
   * Increment token usage count
   */
  private async incrementTokenUsage(tokenId: string, _context: ShareTokenContext): Promise<void> {
    await this.db
      .prepare(`
        UPDATE file_share_tokens 
        SET used_count = used_count + 1, last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(tokenId)
      .run();
  }

  /**
   * Audit token-related actions
   */
  private async auditTokenAction(audit: Omit<FileAccessAudit, 'id' | 'createdAt'>): Promise<string> {
    const auditId = crypto.randomUUID();
    
    try {
      await this.db
        .prepare(`
          INSERT INTO file_access_audit 
          (id, file_id, user_id, share_token, operation, result, reason, ip_address, user_agent, request_id, bytes_transferred, duration_ms, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(
          auditId,
          audit.fileId,
          audit.userId || null,
          audit.shareToken || null,
          audit.operation,
          audit.result,
          audit.reason || null,
          audit.ipAddress || null,
          audit.userAgent || null,
          audit.requestId || null,
          audit.bytesTransferred || null,
          audit.durationMs || null,
          JSON.stringify(audit.metadata || {})
        )
        .run();
    } catch (error) {
      console.error('Failed to audit token action:', error);
    }
    
    return auditId;
  }
}
import {
  AccessControlContext,
  AccessControlResult,
  FileOperation,
  FileRole,
  FileOwnershipValidation,
  BulkPermissionCheck,
  FileAccessAudit,
  AccessControlConfig,
  PermissionGrant,
  PermissionRevoke,
  FileVisibility,
  InsufficientPermissionsError,
  FileNotFoundError
} from '../../types/permissions';

/**
 * Core Access Control Service
 * Handles file ownership validation and permission checks
 */
export class AccessControlService {
  private db: D1Database;
  private config: AccessControlConfig;

  constructor(db: D1Database, config?: Partial<AccessControlConfig>) {
    this.db = db;
    this.config = {
      defaultFileRole: FileRole.NONE,
      ownerPermissions: [FileOperation.READ, FileOperation.WRITE, FileOperation.DELETE, FileOperation.SHARE, FileOperation.ADMIN],
      editorPermissions: [FileOperation.READ, FileOperation.WRITE, FileOperation.SHARE],
      viewerPermissions: [FileOperation.READ],
      publicPermissions: [FileOperation.READ],
      securityPolicy: {
        maxTokenLifetime: 7 * 24 * 60 * 60, // 7 days
        maxSharesPerFile: 100,
        allowPublicSharing: true,
        requireOwnershipForDelete: true,
        requireOwnershipForShare: false,
        auditAllOperations: true,
        ipWhitelistEnabled: false,
        rateLimitEnabled: true
      },
      ...config
    };
  }

  /**
   * Validate file ownership for a user
   */
  async validateOwnership(fileId: string, userId: string): Promise<FileOwnershipValidation> {
    const startTime = Date.now();
    
    try {
      // Get file record with ownership information
      const fileRecord = await this.db
        .prepare(`
          SELECT f.id, f.user_id, f.filename, f.created_at,
                 fp.role, fp.permissions, fp.granted_by, fp.granted_at, fp.expires_at
          FROM files f
          LEFT JOIN file_permissions fp ON f.id = fp.file_id AND fp.user_id = ? AND fp.is_active = 1
          WHERE f.id = ?
        `)
        .bind(userId, fileId)
        .first();

      if (!fileRecord) {
        throw new FileNotFoundError(fileId, userId);
      }

      const isOwner = fileRecord.user_id === userId;
      let effectiveRole: FileRole;
      let permissions: FileOperation[];
      let sharedAccess: FileOwnershipValidation['sharedAccess'];

      if (isOwner) {
        effectiveRole = FileRole.OWNER;
        permissions = this.config.ownerPermissions;
      } else if (fileRecord.role) {
        effectiveRole = fileRecord.role as FileRole;
        permissions = this.parsePermissions(fileRecord.permissions as string);
        sharedAccess = {
          grantedBy: fileRecord.granted_by as string,
          grantedAt: new Date(fileRecord.granted_at as string),
          expiresAt: fileRecord.expires_at ? new Date(fileRecord.expires_at as string) : undefined
        };
      } else {
        effectiveRole = this.config.defaultFileRole;
        permissions = this.getPermissionsForRole(effectiveRole);
      }

      // Check if shared access has expired
      if (sharedAccess?.expiresAt && sharedAccess.expiresAt < new Date()) {
        effectiveRole = this.config.defaultFileRole;
        permissions = this.getPermissionsForRole(effectiveRole);
        sharedAccess = undefined;
      }

      const result: FileOwnershipValidation = {
        fileId,
        userId,
        isOwner,
        effectiveRole,
        permissions,
        sharedAccess
      };

      // Audit the ownership check
      await this.auditFileAccess({
        fileId,
        userId,
        operation: FileOperation.ADMIN,
        result: 'allowed',
        reason: 'ownership_validation',
        durationMs: Date.now() - startTime,
        metadata: { effectiveRole, isOwner }
      });

      return result;

    } catch (error) {
      // Audit the failed ownership check
      await this.auditFileAccess({
        fileId,
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
   * Check if user has permission for a specific operation
   */
  async checkPermission(context: AccessControlContext): Promise<AccessControlResult> {
    const startTime = Date.now();
    
    try {
      const ownership = await this.validateOwnership(context.fileId, context.userId);
      
      const hasPermission = ownership.permissions.includes(context.operation);
      
      const result: AccessControlResult = {
        allowed: hasPermission,
        reason: hasPermission ? 'permission_granted' : 'insufficient_permissions',
        requiredRole: this.getMinimumRoleForOperation(context.operation),
        currentRole: ownership.effectiveRole,
        auditId: await this.auditFileAccess({
          fileId: context.fileId,
          userId: context.userId,
          operation: context.operation,
          result: hasPermission ? 'allowed' : 'denied',
          reason: hasPermission ? 'permission_granted' : 'insufficient_permissions',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          durationMs: Date.now() - startTime,
          metadata: { effectiveRole: ownership.effectiveRole, isOwner: ownership.isOwner }
        })
      };

      return result;

    } catch (error) {
      const result: AccessControlResult = {
        allowed: false,
        reason: error instanceof Error ? error.message : 'unknown_error',
        auditId: await this.auditFileAccess({
          fileId: context.fileId,
          userId: context.userId,
          operation: context.operation,
          result: 'denied',
          reason: error instanceof Error ? error.message : 'unknown_error',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          durationMs: Date.now() - startTime
        })
      };

      return result;
    }
  }

  /**
   * Check permissions for multiple files in batch
   */
  async checkBulkPermissions(
    userId: string,
    fileOperations: Array<{ fileId: string; operation: FileOperation }>,
    context?: Partial<AccessControlContext>
  ): Promise<BulkPermissionCheck[]> {
    const results: BulkPermissionCheck[] = [];
    
    // Process in batches to avoid database timeout
    const batchSize = 10;
    for (let i = 0; i < fileOperations.length; i += batchSize) {
      const batch = fileOperations.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (fileOp) => {
          const result = await this.checkPermission({
            userId,
            fileId: fileOp.fileId,
            operation: fileOp.operation,
            ...context
          });
          
          return {
            fileId: fileOp.fileId,
            operation: fileOp.operation,
            result
          };
        })
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Grant permissions to a user for a file
   */
  async grantPermission(
    granterId: string,
    grant: PermissionGrant
  ): Promise<void> {
    // Verify granter has permission to grant access
    const granterCheck = await this.checkPermission({
      userId: granterId,
      fileId: grant.fileId,
      operation: FileOperation.SHARE
    });

    if (!granterCheck.allowed) {
      throw new InsufficientPermissionsError(
        grant.fileId,
        granterId,
        FileOperation.SHARE,
        FileRole.EDITOR,
        granterCheck.currentRole || FileRole.NONE
      );
    }

    // Check if user already has permissions
    const existingPermission = await this.db
      .prepare(`
        SELECT id FROM file_permissions 
        WHERE file_id = ? AND user_id = ? AND is_active = 1
      `)
      .bind(grant.fileId, grant.userId)
      .first();

    if (existingPermission) {
      // Update existing permission
      await this.db
        .prepare(`
          UPDATE file_permissions 
          SET role = ?, permissions = ?, expires_at = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
          WHERE file_id = ? AND user_id = ? AND is_active = 1
        `)
        .bind(
          grant.role,
          JSON.stringify(grant.permissions),
          grant.expiresAt?.toISOString() || null,
          JSON.stringify(grant.metadata || {}),
          grant.fileId,
          grant.userId
        )
        .run();
    } else {
      // Create new permission
      await this.db
        .prepare(`
          INSERT INTO file_permissions 
          (file_id, user_id, role, permissions, granted_by, granted_at, expires_at, metadata, is_active)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 1)
        `)
        .bind(
          grant.fileId,
          grant.userId,
          grant.role,
          JSON.stringify(grant.permissions),
          granterId,
          grant.expiresAt?.toISOString() || null,
          JSON.stringify(grant.metadata || {})
        )
        .run();
    }

    // Audit the permission grant
    await this.auditFileAccess({
      fileId: grant.fileId,
      userId: granterId,
      operation: FileOperation.ADMIN,
      result: 'allowed',
      reason: 'permission_granted',
      metadata: {
        action: 'grant_permission',
        targetUserId: grant.userId,
        role: grant.role,
        permissions: grant.permissions
      }
    });
  }

  /**
   * Revoke permissions from a user for a file
   */
  async revokePermission(
    revokerId: string,
    revoke: PermissionRevoke
  ): Promise<void> {
    // Verify revoker has permission to revoke access
    const revokerCheck = await this.checkPermission({
      userId: revokerId,
      fileId: revoke.fileId,
      operation: FileOperation.ADMIN
    });

    if (!revokerCheck.allowed) {
      throw new InsufficientPermissionsError(
        revoke.fileId,
        revokerId,
        FileOperation.ADMIN,
        FileRole.OWNER,
        revokerCheck.currentRole || FileRole.NONE
      );
    }

    if (revoke.revokeAll) {
      // Revoke all permissions
      await this.db
        .prepare(`
          UPDATE file_permissions 
          SET is_active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE file_id = ? AND user_id = ?
        `)
        .bind(revoke.fileId, revoke.userId)
        .run();
    } else if (revoke.operations) {
      // Revoke specific operations
      const currentPermissions = await this.db
        .prepare(`
          SELECT permissions FROM file_permissions 
          WHERE file_id = ? AND user_id = ? AND is_active = 1
        `)
        .bind(revoke.fileId, revoke.userId)
        .first();

      if (currentPermissions) {
        const permissions = this.parsePermissions(currentPermissions.permissions as string);
        const updatedPermissions = permissions.filter(p => !(revoke.operations && revoke.operations.includes(p)));
        
        await this.db
          .prepare(`
            UPDATE file_permissions 
            SET permissions = ?, updated_at = CURRENT_TIMESTAMP
            WHERE file_id = ? AND user_id = ? AND is_active = 1
          `)
          .bind(
            JSON.stringify(updatedPermissions),
            revoke.fileId,
            revoke.userId
          )
          .run();
      }
    }

    // Audit the permission revocation
    await this.auditFileAccess({
      fileId: revoke.fileId,
      userId: revokerId,
      operation: FileOperation.ADMIN,
      result: 'allowed',
      reason: 'permission_revoked',
      metadata: {
        action: 'revoke_permission',
        targetUserId: revoke.userId,
        revokeAll: revoke.revokeAll,
        operations: revoke.operations
      }
    });
  }

  /**
   * Set file visibility (private, internal, public)
   */
  async setFileVisibility(
    userId: string,
    fileId: string,
    visibility: FileVisibility
  ): Promise<void> {
    // Verify user has admin permissions
    const adminCheck = await this.checkPermission({
      userId,
      fileId,
      operation: FileOperation.ADMIN
    });

    if (!adminCheck.allowed) {
      throw new InsufficientPermissionsError(
        fileId,
        userId,
        FileOperation.ADMIN,
        FileRole.OWNER,
        adminCheck.currentRole || FileRole.NONE
      );
    }

    // Update file visibility
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO file_visibility 
        (file_id, visibility, allowed_users, allowed_roles, public_access_token, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        fileId,
        visibility.visibility,
        JSON.stringify(visibility.allowedUsers || []),
        JSON.stringify(visibility.allowedRoles || []),
        visibility.publicAccessToken || null
      )
      .run();

    // Audit the visibility change
    await this.auditFileAccess({
      fileId,
      userId,
      operation: FileOperation.ADMIN,
      result: 'allowed',
      reason: 'visibility_changed',
      metadata: {
        action: 'set_visibility',
        visibility: visibility.visibility,
        allowedUsers: visibility.allowedUsers,
        allowedRoles: visibility.allowedRoles
      }
    });
  }

  /**
   * Get minimum role required for an operation
   */
  private getMinimumRoleForOperation(operation: FileOperation): FileRole {
    switch (operation) {
      case FileOperation.READ:
        return FileRole.VIEWER;
      case FileOperation.WRITE:
      case FileOperation.SHARE:
        return FileRole.EDITOR;
      case FileOperation.DELETE:
      case FileOperation.ADMIN:
        return FileRole.OWNER;
      default:
        return FileRole.OWNER;
    }
  }

  /**
   * Get permissions for a role
   */
  private getPermissionsForRole(role: FileRole): FileOperation[] {
    switch (role) {
      case FileRole.OWNER:
        return this.config.ownerPermissions;
      case FileRole.EDITOR:
        return this.config.editorPermissions;
      case FileRole.VIEWER:
        return this.config.viewerPermissions;
      case FileRole.NONE:
      default:
        return [];
    }
  }

  /**
   * Parse permissions from JSON string
   */
  private parsePermissions(permissionsJson: string): FileOperation[] {
    try {
      return JSON.parse(permissionsJson) as FileOperation[];
    } catch {
      return [];
    }
  }

  /**
   * Audit file access attempt
   */
  private async auditFileAccess(audit: Omit<FileAccessAudit, 'id' | 'createdAt'>): Promise<string> {
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
      console.error('Failed to audit file access:', error);
    }
    
    return auditId;
  }
}
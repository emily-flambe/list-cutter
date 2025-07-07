import { AccessControlService } from '../security/access-control';
import { R2StorageService, FileUploadOptions, UploadResult } from './r2-service';
import {
  FileOperation,
  FileRole,
  AccessControlContext,
  InsufficientPermissionsError
} from '../../types/permissions';

export interface SecureFileUploadOptions extends FileUploadOptions {
  requestContext?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  };
}

export interface SecureFileDownloadOptions {
  userId: string;
  fileId: string;
  range?: string;
  requestContext?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  };
}

export interface SecureFileDeleteOptions {
  userId: string;
  fileId: string;
  requestContext?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  };
}

export interface FileAccessMetrics {
  fileId: string;
  totalAccesses: number;
  successfulAccesses: number;
  deniedAccesses: number;
  lastAccessed: Date;
  bytesTransferred: number;
  averageResponseTime: number;
}

/**
 * Secure R2 Storage Service with Access Control
 * Wraps R2StorageService with comprehensive permission checking
 */
export class SecureR2StorageService {
  private r2Service: R2StorageService;
  private accessControl: AccessControlService;
  private db: D1Database;

  constructor(bucket: R2Bucket, db: D1Database) {
    this.r2Service = new R2StorageService(bucket, db);
    this.accessControl = new AccessControlService(db);
    this.db = db;
  }

  /**
   * Upload a file with access control validation
   */
  async uploadFile(
    fileData: ArrayBuffer | ReadableStream | Uint8Array,
    options: SecureFileUploadOptions
  ): Promise<UploadResult> {
    const startTime = Date.now();
    
    try {
      // Validate user has write permission for the file
      const context: AccessControlContext = {
        userId: options.userId,
        fileId: options.fileId,
        operation: FileOperation.WRITE,
        ipAddress: options.requestContext?.ipAddress,
        userAgent: options.requestContext?.userAgent,
        requestId: options.requestContext?.requestId
      };

      const permissionCheck = await this.accessControl.checkPermission(context);
      
      if (!permissionCheck.allowed) {
        throw new InsufficientPermissionsError(
          options.fileId,
          options.userId,
          FileOperation.WRITE,
          permissionCheck.requiredRole || 'owner',
          permissionCheck.currentRole || 'none'
        );
      }

      // Validate file ownership or permissions
      const ownership = await this.accessControl.validateOwnership(options.fileId, options.userId);
      if (!ownership.permissions.includes(FileOperation.WRITE)) {
        throw new InsufficientPermissionsError(
          options.fileId,
          options.userId,
          FileOperation.WRITE,
          'editor',
          ownership.effectiveRole
        );
      }

      // Proceed with upload using the base R2 service
      const result = await this.r2Service.uploadFile(fileData, options);

      // Update access metrics
      await this.updateAccessMetrics(options.fileId, {
        operation: FileOperation.WRITE,
        success: true,
        bytesTransferred: result.size,
        durationMs: Date.now() - startTime
      });

      return result;

    } catch (error) {
      // Update access metrics for failed upload
      await this.updateAccessMetrics(options.fileId, {
        operation: FileOperation.WRITE,
        success: false,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Download a file with access control validation
   */
  async downloadFile(
    options: SecureFileDownloadOptions
  ): Promise<R2ObjectBody | null> {
    const startTime = Date.now();
    
    try {
      // Validate user has read permission for the file
      const context: AccessControlContext = {
        userId: options.userId,
        fileId: options.fileId,
        operation: FileOperation.READ,
        ipAddress: options.requestContext?.ipAddress,
        userAgent: options.requestContext?.userAgent,
        requestId: options.requestContext?.requestId
      };

      const permissionCheck = await this.accessControl.checkPermission(context);
      
      if (!permissionCheck.allowed) {
        throw new InsufficientPermissionsError(
          options.fileId,
          options.userId,
          FileOperation.READ,
          (permissionCheck.requiredRole as FileRole) || FileRole.VIEWER,
          (permissionCheck.currentRole as FileRole) || FileRole.NONE
        );
      }

      // Validate file ownership or permissions
      const ownership = await this.accessControl.validateOwnership(options.fileId, options.userId);
      if (!ownership.permissions.includes(FileOperation.READ)) {
        throw new InsufficientPermissionsError(
          options.fileId,
          options.userId,
          FileOperation.READ,
          FileRole.VIEWER,
          ownership.effectiveRole
        );
      }

      // Proceed with download using the base R2 service
      const result = await this.r2Service.downloadFile(
        options.fileId,
        options.userId,
        { range: options.range }
      );

      if (result) {
        // Update access metrics
        await this.updateAccessMetrics(options.fileId, {
          operation: FileOperation.READ,
          success: true,
          bytesTransferred: result.size,
          durationMs: Date.now() - startTime
        });
      }

      return result;

    } catch (error) {
      // Update access metrics for failed download
      await this.updateAccessMetrics(options.fileId, {
        operation: FileOperation.READ,
        success: false,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Delete a file with access control validation
   */
  async deleteFile(options: SecureFileDeleteOptions): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Validate user has delete permission for the file
      const context: AccessControlContext = {
        userId: options.userId,
        fileId: options.fileId,
        operation: FileOperation.DELETE,
        ipAddress: options.requestContext?.ipAddress,
        userAgent: options.requestContext?.userAgent,
        requestId: options.requestContext?.requestId
      };

      const permissionCheck = await this.accessControl.checkPermission(context);
      
      if (!permissionCheck.allowed) {
        throw new InsufficientPermissionsError(
          options.fileId,
          options.userId,
          FileOperation.DELETE,
          (permissionCheck.requiredRole as FileRole) || FileRole.OWNER,
          (permissionCheck.currentRole as FileRole) || FileRole.NONE
        );
      }

      // Validate file ownership for delete operation
      const ownership = await this.accessControl.validateOwnership(options.fileId, options.userId);
      if (!ownership.isOwner) {
        throw new InsufficientPermissionsError(
          options.fileId,
          options.userId,
          FileOperation.DELETE,
          FileRole.OWNER,
          ownership.effectiveRole
        );
      }

      // Get file size for metrics before deletion
      const fileRecord = await this.db
        .prepare('SELECT file_size FROM files WHERE id = ? AND user_id = ?')
        .bind(options.fileId, options.userId)
        .first();

      // Proceed with deletion using the base R2 service
      const result = await this.r2Service.deleteFile(options.fileId, options.userId);

      if (result) {
        // Update access metrics
        await this.updateAccessMetrics(options.fileId, {
          operation: FileOperation.DELETE,
          success: true,
          bytesTransferred: fileRecord?.file_size as number || 0,
          durationMs: Date.now() - startTime
        });

        // Clean up associated permissions and shares
        await this.cleanupFilePermissions(options.fileId);
      }

      return result;

    } catch (error) {
      // Update access metrics for failed deletion
      await this.updateAccessMetrics(options.fileId, {
        operation: FileOperation.DELETE,
        success: false,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * List files with access control filtering
   */
  async listUserFiles(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      includeShared?: boolean;
      includePublic?: boolean;
    } = {}
  ): Promise<Array<{
    fileId: string;
    filename: string;
    fileSize: number;
    uploadedAt: Date;
    isOwner: boolean;
    effectiveRole: string;
    permissions: FileOperation[];
  }>> {
    const { limit = 50, offset = 0, includeShared = true, includePublic = false } = options;
    
    // Base query for owned files
    let query = `
      SELECT f.id, f.filename, f.file_size, f.created_at, f.user_id,
             NULL as granted_role, NULL as granted_permissions
      FROM files f
      WHERE f.user_id = ?
    `;
    
    const params = [userId];

    // Add shared files if requested
    if (includeShared) {
      query += `
        UNION ALL
        SELECT f.id, f.filename, f.file_size, f.created_at, f.user_id,
               fp.role as granted_role, fp.permissions as granted_permissions
        FROM files f
        JOIN file_permissions fp ON f.id = fp.file_id
        WHERE fp.user_id = ? AND fp.is_active = 1
          AND (fp.expires_at IS NULL OR fp.expires_at > datetime('now'))
      `;
      params.push(userId);
    }

    // Add public files if requested
    if (includePublic) {
      query += `
        UNION ALL
        SELECT f.id, f.filename, f.file_size, f.created_at, f.user_id,
               'viewer' as granted_role, '["read"]' as granted_permissions
        FROM files f
        JOIN file_visibility fv ON f.id = fv.file_id
        WHERE fv.visibility = 'public'
          AND f.user_id != ?
      `;
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = await this.db.prepare(query).bind(...params).all();

    return results.results.map((row: Record<string, unknown>) => {
      const isOwner = row.user_id === userId;
      let effectiveRole = isOwner ? 'owner' : (row.granted_role as string || 'none');
      let permissions: FileOperation[] = [];

      if (isOwner) {
        permissions = [FileOperation.READ, FileOperation.WRITE, FileOperation.DELETE, FileOperation.SHARE, FileOperation.ADMIN];
      } else if (row.granted_permissions) {
        try {
          permissions = JSON.parse(row.granted_permissions as string);
        } catch {
          permissions = [];
        }
      }

      return {
        fileId: row.id as string,
        filename: row.filename as string,
        fileSize: row.file_size as number,
        uploadedAt: new Date(row.created_at as string),
        isOwner,
        effectiveRole,
        permissions
      };
    });
  }

  /**
   * Get file access metrics
   */
  async getFileAccessMetrics(fileId: string, userId: string): Promise<FileAccessMetrics | null> {
    // Verify user has admin permission for the file
    const context: AccessControlContext = {
      userId,
      fileId,
      operation: FileOperation.ADMIN
    };

    const permissionCheck = await this.accessControl.checkPermission(context);
    
    if (!permissionCheck.allowed) {
      throw new InsufficientPermissionsError(
        fileId,
        userId,
        FileOperation.ADMIN,
        (permissionCheck.requiredRole as FileRole) || FileRole.OWNER,
        (permissionCheck.currentRole as FileRole) || FileRole.NONE
      );
    }

    const metrics = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as total_accesses,
          SUM(CASE WHEN result = 'allowed' THEN 1 ELSE 0 END) as successful_accesses,
          SUM(CASE WHEN result = 'denied' THEN 1 ELSE 0 END) as denied_accesses,
          MAX(created_at) as last_accessed,
          SUM(COALESCE(bytes_transferred, 0)) as bytes_transferred,
          AVG(COALESCE(duration_ms, 0)) as avg_response_time
        FROM file_access_audit
        WHERE file_id = ?
      `)
      .bind(fileId)
      .first();

    if (!metrics || metrics.total_accesses === 0) {
      return null;
    }

    return {
      fileId,
      totalAccesses: metrics.total_accesses as number,
      successfulAccesses: metrics.successful_accesses as number,
      deniedAccesses: metrics.denied_accesses as number,
      lastAccessed: new Date(metrics.last_accessed as string),
      bytesTransferred: metrics.bytes_transferred as number,
      averageResponseTime: metrics.avg_response_time as number
    };
  }

  /**
   * Validate file access without performing the operation
   */
  async validateAccess(
    userId: string,
    fileId: string,
    operation: FileOperation,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      requestId?: string;
    }
  ): Promise<{
    allowed: boolean;
    reason: string;
    effectiveRole: string;
    requiredRole?: string;
  }> {
    try {
      const accessContext: AccessControlContext = {
        userId,
        fileId,
        operation,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        requestId: context?.requestId
      };

      const permissionCheck = await this.accessControl.checkPermission(accessContext);
      
      return {
        allowed: permissionCheck.allowed,
        reason: permissionCheck.reason || 'unknown',
        effectiveRole: permissionCheck.currentRole || 'none',
        requiredRole: permissionCheck.requiredRole || 'none'
      };

    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'unknown_error',
        effectiveRole: 'none'
      };
    }
  }

  /**
   * Update file access metrics
   */
  private async updateAccessMetrics(
    fileId: string,
    metrics: {
      operation: FileOperation;
      success: boolean;
      bytesTransferred?: number;
      durationMs: number;
      error?: string;
    }
  ): Promise<void> {
    try {
      // This is already handled by the access control audit log
      // We could add additional metrics here if needed
      console.warn(`File access metrics updated for ${fileId}: ${metrics.operation} ${metrics.success ? 'succeeded' : 'failed'}`);
    } catch (error) {
      console.error('Failed to update access metrics:', error);
    }
  }

  /**
   * Clean up file permissions when a file is deleted
   */
  private async cleanupFilePermissions(fileId: string): Promise<void> {
    try {
      // Deactivate all permissions for the file
      await this.db
        .prepare('UPDATE file_permissions SET is_active = 0 WHERE file_id = ?')
        .bind(fileId)
        .run();

      // Deactivate all share tokens for the file
      await this.db
        .prepare('UPDATE file_share_tokens SET is_active = 0 WHERE file_id = ?')
        .bind(fileId)
        .run();

      // Remove file visibility settings
      await this.db
        .prepare('DELETE FROM file_visibility WHERE file_id = ?')
        .bind(fileId)
        .run();

    } catch (error) {
      console.error('Failed to cleanup file permissions:', error);
    }
  }

  /**
   * Get the underlying R2 service for advanced operations
   */
  getR2Service(): R2StorageService {
    return this.r2Service;
  }

  /**
   * Get the access control service for advanced operations
   */
  getAccessControl(): AccessControlService {
    return this.accessControl;
  }
}
import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AccessControlService } from '../services/security/access-control';
import { FileSharingService } from '../services/security/file-sharing';
import {
  FileOperation,
  AccessControlError,
  InsufficientPermissionsError,
  FileNotFoundError,
  InvalidShareTokenError,
  ShareTokenExpiredError
} from '../types/permissions';
import type { CloudflareEnv } from '../types/env';

export interface FileAuthOptions {
  operation: FileOperation;
  fileIdParam?: string;
  allowShareTokens?: boolean;
  requireOwnership?: boolean;
  skipAudit?: boolean;
}

export interface FileAuthContext {
  fileId: string;
  userId?: string;
  shareToken?: string;
  accessGranted: boolean;
  accessReason: string;
  auditId?: string;
  effectivePermissions: FileOperation[];
}

/**
 * File Access Control Middleware
 * Validates permissions for all file operations
 */
export function fileAuth(options: FileAuthOptions): (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => Promise<void> {
  return async (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => {
    const startTime = Date.now();
    
    try {
      // Extract file ID from request parameters
      const fileId = c.req.param(options.fileIdParam || 'fileId');
      if (!fileId) {
        throw new HTTPException(400, { message: 'File ID is required' });
      }

      // Initialize access control service
      const accessControl = new AccessControlService(c.env.DB);
      const fileSharingService = new FileSharingService(c.env.DB, c.env.AUTH_TOKENS);

      // Get user ID from JWT token (if present)
      const userId = c.get('userId') as string | undefined;
      
      // Get share token from query parameters or headers
      const shareToken = c.req.query('token') || c.req.header('X-Share-Token');
      
      // Get client information for audit trail
      const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
      const userAgent = c.req.header('User-Agent') || 'unknown';
      const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();

      let accessGranted = false;
      let accessReason = 'unknown';
      let auditId: string | undefined;
      let effectivePermissions: FileOperation[] = [];

      // Check share token access first (if provided and allowed)
      if (shareToken && options.allowShareTokens) {
        try {
          const tokenValidation = await fileSharingService.validateShareToken(shareToken, {
            fileId,
            operation: options.operation,
            ipAddress,
            userAgent,
            requestId
          });

          if (tokenValidation.valid) {
            accessGranted = true;
            accessReason = 'share_token_valid';
            effectivePermissions = tokenValidation.permissions;
            auditId = tokenValidation.auditId;
          } else {
            throw new InvalidShareTokenError(shareToken);
          }
        } catch (error) {
          if (error instanceof InvalidShareTokenError || error instanceof ShareTokenExpiredError) {
            throw new HTTPException(401, { message: error.message });
          }
          throw error;
        }
      }

      // Check user permissions (if no share token or share token failed)
      if (!accessGranted && userId) {
        try {
          const permissionCheck = await accessControl.checkPermission({
            userId,
            fileId,
            operation: options.operation,
            ipAddress,
            userAgent,
            requestId
          });

          if (permissionCheck.allowed) {
            accessGranted = true;
            accessReason = 'user_permission_granted';
            auditId = permissionCheck.auditId;
            
            // Get effective permissions for the user
            const ownership = await accessControl.validateOwnership(fileId, userId);
            effectivePermissions = ownership.permissions;
          } else {
            throw new InsufficientPermissionsError(
              fileId,
              userId,
              options.operation,
              permissionCheck.requiredRole || 'owner',
              permissionCheck.currentRole || 'none'
            );
          }
        } catch (error) {
          if (error instanceof FileNotFoundError) {
            throw new HTTPException(404, { message: 'File not found or access denied' });
          }
          if (error instanceof InsufficientPermissionsError) {
            throw new HTTPException(403, { message: error.message });
          }
          throw error;
        }
      }

      // Special handling for ownership requirement
      if (options.requireOwnership && userId) {
        try {
          const ownership = await accessControl.validateOwnership(fileId, userId);
          if (!ownership.isOwner) {
            throw new HTTPException(403, { message: 'File ownership required for this operation' });
          }
        } catch (error) {
          if (error instanceof FileNotFoundError) {
            throw new HTTPException(404, { message: 'File not found or access denied' });
          }
          throw new HTTPException(403, { message: 'File ownership required for this operation' });
        }
      }

      // Final access check
      if (!accessGranted) {
        throw new HTTPException(401, { message: 'Authentication required or insufficient permissions' });
      }

      // Check if the requested operation is allowed
      if (!effectivePermissions.includes(options.operation)) {
        throw new HTTPException(403, { message: `Operation '${options.operation}' not permitted` });
      }

      // Store file auth context for use in route handlers
      const fileAuthContext: FileAuthContext = {
        fileId,
        userId,
        shareToken,
        accessGranted,
        accessReason,
        auditId,
        effectivePermissions
      };

      c.set('fileAuth', fileAuthContext);

      // Add response headers for security
      c.res.headers.set('X-File-Access-Granted', 'true');
      c.res.headers.set('X-File-Access-Reason', accessReason);
      c.res.headers.set('X-File-Access-Duration', `${Date.now() - startTime}ms`);
      
      if (auditId) {
        c.res.headers.set('X-Audit-ID', auditId);
      }

      // Continue to the next middleware/handler
      await next();

    } catch (error) {
      // Log the error for debugging
      console.error('File auth middleware error:', error);

      // Handle specific error types
      if (error instanceof HTTPException) {
        throw error;
      }

      if (error instanceof AccessControlError) {
        const statusCode = error.code === 'FILE_NOT_FOUND' ? 404 : 403;
        throw new HTTPException(statusCode, { message: error.message });
      }

      // Generic error response
      throw new HTTPException(500, { message: 'Internal server error during access control' });
    }
  };
}

/**
 * Middleware factory for different file operations
 */
export const fileAuthMiddleware = {
  /**
   * Middleware for file read operations
   */
  read: (options: Omit<FileAuthOptions, 'operation'> = {}): (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => Promise<void> => 
    fileAuth({ operation: FileOperation.READ, allowShareTokens: true, ...options }),

  /**
   * Middleware for file write operations
   */
  write: (options: Omit<FileAuthOptions, 'operation'> = {}): (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => Promise<void> => 
    fileAuth({ operation: FileOperation.WRITE, allowShareTokens: false, ...options }),

  /**
   * Middleware for file delete operations
   */
  delete: (options: Omit<FileAuthOptions, 'operation'> = {}): (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => Promise<void> => 
    fileAuth({ operation: FileOperation.DELETE, requireOwnership: true, allowShareTokens: false, ...options }),

  /**
   * Middleware for file share operations
   */
  share: (options: Omit<FileAuthOptions, 'operation'> = {}): (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => Promise<void> => 
    fileAuth({ operation: FileOperation.SHARE, allowShareTokens: false, ...options }),

  /**
   * Middleware for file admin operations
   */
  admin: (options: Omit<FileAuthOptions, 'operation'> = {}): (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => Promise<void> => 
    fileAuth({ operation: FileOperation.ADMIN, requireOwnership: true, allowShareTokens: false, ...options }),
};

/**
 * Utility function to get file auth context from request
 */
export function getFileAuthContext(c: Context): FileAuthContext | undefined {
  return c.get('fileAuth') as FileAuthContext | undefined;
}

/**
 * Utility function to check if user has specific permission
 */
export function hasFilePermission(c: Context, operation: FileOperation): boolean {
  const fileAuth = getFileAuthContext(c);
  return fileAuth?.effectivePermissions.includes(operation) || false;
}

/**
 * Utility function to require specific permission
 */
export function requireFilePermission(c: Context, operation: FileOperation): void {
  if (!hasFilePermission(c, operation)) {
    throw new HTTPException(403, { message: `Operation '${operation}' not permitted` });
  }
}

/**
 * Middleware to validate file exists and is accessible
 */
export function validateFileAccess(): (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => Promise<void> {
  return async (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => {
    const fileAuth = getFileAuthContext(c);
    
    if (!fileAuth) {
      throw new HTTPException(500, { message: 'File authentication context not found' });
    }

    // Verify file exists in database
    const fileRecord = await c.env.DB
      .prepare('SELECT id, filename, user_id, upload_status FROM files WHERE id = ?')
      .bind(fileAuth.fileId)
      .first();

    if (!fileRecord) {
      throw new HTTPException(404, { message: 'File not found' });
    }

    // Check if file is in a usable state
    if (fileRecord.upload_status === 'failed') {
      throw new HTTPException(409, { message: 'File upload failed and is not accessible' });
    }

    if (fileRecord.upload_status === 'pending' || fileRecord.upload_status === 'processing') {
      throw new HTTPException(202, { message: 'File is still being processed' });
    }

    // Add file information to context
    c.set('fileRecord', fileRecord);

    await next();
  };
}

/**
 * Rate limiting middleware for file operations
 */
export function rateLimitFileOperations(options: {
  maxRequests: number;
  windowMs: number;
  operation?: FileOperation;
}): (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => Promise<void> {
  return async (c: Context<{ Bindings: CloudflareEnv }>, next: Next) => {
    const fileAuth = getFileAuthContext(c);
    const userId = fileAuth?.userId;
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    if (!userId && !fileAuth?.shareToken) {
      // Skip rate limiting for unauthenticated requests (they'll be blocked by auth anyway)
      await next();
      return;
    }

    const operation = options.operation || FileOperation.READ;
    const windowStart = new Date(Date.now() - options.windowMs);
    const windowEnd = new Date();

    // Check current rate limit
    const rateLimitRecord = await c.env.DB
      .prepare(`
        SELECT request_count, blocked_count 
        FROM access_rate_limits 
        WHERE (user_id = ? OR ip_address = ?) 
          AND operation = ? 
          AND window_start >= ? 
          AND window_end <= ?
      `)
      .bind(userId || null, ipAddress, operation, windowStart.toISOString(), windowEnd.toISOString())
      .first();

    const currentCount = rateLimitRecord?.request_count || 0;
    
    if (currentCount >= options.maxRequests) {
      // Update blocked count
      await c.env.DB
        .prepare(`
          UPDATE access_rate_limits 
          SET blocked_count = blocked_count + 1 
          WHERE (user_id = ? OR ip_address = ?) 
            AND operation = ? 
            AND window_start >= ?
        `)
        .bind(userId || null, ipAddress, operation, windowStart.toISOString())
        .run();

      throw new HTTPException(429, { message: 'Rate limit exceeded for file operations' });
    }

    // Update or create rate limit record
    await c.env.DB
      .prepare(`
        INSERT OR REPLACE INTO access_rate_limits 
        (user_id, ip_address, operation, window_start, window_end, request_count, blocked_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        userId || null,
        ipAddress,
        operation,
        windowStart.toISOString(),
        windowEnd.toISOString(),
        currentCount + 1,
        rateLimitRecord?.blocked_count || 0
      )
      .run();

    await next();
  };
}
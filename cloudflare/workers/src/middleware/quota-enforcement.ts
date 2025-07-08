/**
 * Quota Enforcement Middleware
 * Provides real-time quota checking and enforcement for file operations
 */

import { QuotaManager } from '../services/security/quota-manager';
import {
  QuotaCheckOptions,
  QuotaOperationType,
  QuotaNotFoundError
} from '../types/quota';
import { CloudflareEnv } from '../types/env';

export interface QuotaEnforcementOptions {
  quotaManager: QuotaManager;
  skipQuotaCheck?: boolean;
  gracePeriodMinutes?: number;
}

export interface QuotaContext {
  userId: string;
  operationType: QuotaOperationType;
  resourceSize?: number;
  fileId?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface QuotaEnforcementResult {
  allowed: boolean;
  quotaCheck?: {
    isAllowed: boolean;
    currentUsage: number;
    limit: number;
    percentageUsed: number;
    remainingQuota: number;
    resetTime: Date;
    quotaType: string;
  };
  errorMessage?: string;
  recommendedAction?: string;
  retryAfter?: number;
}

/**
 * Middleware for quota enforcement on file operations
 */
export class QuotaEnforcementMiddleware {
  private quotaManager: QuotaManager;
  private skipQuotaCheck: boolean;
  private _gracePeriodMinutes: number;

  constructor(options: QuotaEnforcementOptions) {
    this.quotaManager = options.quotaManager;
    this.skipQuotaCheck = options.skipQuotaCheck || false;
    this._gracePeriodMinutes = options.gracePeriodMinutes || 5;
  }

  /**
   * Enforce quota limits before file operations
   */
  async enforceQuota(context: QuotaContext): Promise<QuotaEnforcementResult> {
    if (this.skipQuotaCheck) {
      return { allowed: true };
    }

    try {
      const checkOptions: QuotaCheckOptions = {
        userId: context.userId,
        operationType: context.operationType,
        resourceSize: context.resourceSize || 0,
        ignoreOverage: false
      };

      const quotaCheck = await this.quotaManager.checkQuota(checkOptions);

      if (!quotaCheck.isAllowed) {
        return {
          allowed: false,
          quotaCheck: {
            isAllowed: quotaCheck.isAllowed,
            currentUsage: quotaCheck.currentUsage,
            limit: quotaCheck.limit,
            percentageUsed: quotaCheck.percentageUsed,
            remainingQuota: quotaCheck.remainingQuota,
            resetTime: quotaCheck.resetTime || new Date(),
            quotaType: quotaCheck.quotaType.toString()
          },
          errorMessage: this.generateErrorMessage(quotaCheck),
          recommendedAction: this.generateRecommendedAction(quotaCheck),
          retryAfter: this.calculateRetryAfter(quotaCheck)
        };
      }

      return {
        allowed: true,
        quotaCheck: {
          isAllowed: quotaCheck.isAllowed,
          currentUsage: quotaCheck.currentUsage,
          limit: quotaCheck.limit,
          percentageUsed: quotaCheck.percentageUsed,
          remainingQuota: quotaCheck.remainingQuota,
          resetTime: quotaCheck.resetTime || new Date(),
          quotaType: quotaCheck.quotaType.toString()
        }
      };
    } catch (error) {
      if (error instanceof QuotaNotFoundError) {
        // Auto-create quota for user with default tier
        await this.createDefaultQuotaForUser(context.userId);
        return await this.enforceQuota(context);
      }

      throw error;
    }
  }

  /**
   * Update quota usage after successful operation
   */
  async updateQuotaUsage(context: QuotaContext): Promise<void> {
    if (this.skipQuotaCheck) {
      return;
    }

    try {
      await this.quotaManager.updateQuotaUsage({
        userId: context.userId,
        operationType: context.operationType,
        resourceSize: context.resourceSize || 0,
        metadata: {
          fileId: context.fileId,
          contentType: context.contentType,
          timestamp: new Date().toISOString(),
          ...context.metadata
        }
      });
    } catch (error) {
      console.error('Failed to update quota usage:', error);
      // Don't throw here as the operation has already succeeded
    }
  }

  /**
   * Create Express/Hono middleware for quota enforcement
   */
  createMiddleware() {
    return async (request: Request, env: CloudflareEnv, _ctx: ExecutionContext, next: () => Promise<Response>): Promise<Response> => {
      const url = new URL(request.url);
      const method = request.method;
      
      // Skip quota check for certain endpoints
      if (this.shouldSkipQuotaCheck(url.pathname, method)) {
        return next();
      }

      // Extract quota context from request
      const quotaContext = await this.extractQuotaContext(request, env);
      
      if (!quotaContext) {
        return next();
      }

      // Enforce quota
      const result = await this.enforceQuota(quotaContext);
      
      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: 'Quota exceeded',
          message: result.errorMessage,
          quotaCheck: result.quotaCheck,
          recommendedAction: result.recommendedAction,
          retryAfter: result.retryAfter
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': result.quotaCheck?.remainingQuota?.toString() || '0',
            'X-RateLimit-Limit': result.quotaCheck?.limit?.toString() || '0',
            'X-RateLimit-Reset': result.quotaCheck?.resetTime?.toISOString() || '',
            'Retry-After': result.retryAfter?.toString() || '60'
          }
        });
      }

      // Store quota context for post-operation update
      request.quotaContext = quotaContext;
      
      return next();
    };
  }

  /**
   * Post-operation middleware to update quota usage
   */
  createPostOperationMiddleware() {
    return async (request: Request, response: Response, _env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> => {
      const quotaContext = request.quotaContext;
      
      if (!quotaContext) {
        return response;
      }

      // Only update quota if operation was successful
      if (response.status >= 200 && response.status < 300) {
        // Update resource size if available in response
        if (response.headers.get('content-length')) {
          quotaContext.resourceSize = parseInt(response.headers.get('content-length') || '0', 10);
        }

        await this.updateQuotaUsage(quotaContext);
      }

      return response;
    };
  }

  /**
   * Create handler for file upload operations
   */
  createFileUploadHandler() {
    return async (request: Request, _env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> => {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const userId = formData.get('userId') as string;
      
      if (!file || !userId) {
        return new Response(JSON.stringify({ error: 'Missing file or user ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const quotaContext: QuotaContext = {
        userId,
        operationType: QuotaOperationType.UPLOAD,
        resourceSize: file.size,
        contentType: file.type,
        metadata: {
          fileName: file.name,
          lastModified: file.lastModified
        }
      };

      // Pre-upload quota check
      const result = await this.enforceQuota(quotaContext);
      
      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: 'Upload quota exceeded',
          message: result.errorMessage,
          quotaCheck: result.quotaCheck,
          recommendedAction: result.recommendedAction
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Perform the actual upload here
      // This would typically call your R2StorageService
      // await r2StorageService.uploadFile(file, uploadOptions);

      // Post-upload quota update
      await this.updateQuotaUsage(quotaContext);

      return new Response(JSON.stringify({
        success: true,
        message: 'File uploaded successfully',
        quotaUsage: result.quotaCheck
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
  }

  /**
   * Create handler for file download operations
   */
  createFileDownloadHandler() {
    return async (request: Request, env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> => {
      const url = new URL(request.url);
      const fileId = url.searchParams.get('fileId');
      const userId = url.searchParams.get('userId');
      
      if (!fileId || !userId) {
        return new Response(JSON.stringify({ error: 'Missing file ID or user ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get file size for quota calculation
      const fileSize = await this.getFileSize(fileId, env.DB);
      
      const quotaContext: QuotaContext = {
        userId,
        operationType: QuotaOperationType.DOWNLOAD,
        resourceSize: fileSize,
        fileId,
        metadata: {
          rangeRequest: request.headers.get('range') !== null
        }
      };

      // Pre-download quota check
      const result = await this.enforceQuota(quotaContext);
      
      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: 'Download quota exceeded',
          message: result.errorMessage,
          quotaCheck: result.quotaCheck,
          recommendedAction: result.recommendedAction
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Perform the actual download here
      // This would typically call your R2StorageService
      // const fileData = await r2StorageService.downloadFile(fileId, userId);

      // Post-download quota update
      await this.updateQuotaUsage(quotaContext);

      // Return file data
      return new Response('File content would be here', {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileId}"`
        }
      });
    };
  }

  /**
   * Create bulk operation handler with quota batching
   */
  createBulkOperationHandler() {
    return async (request: Request, _env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> => {
      const { operations, userId } = await request.json();
      
      if (!operations || !Array.isArray(operations) || !userId) {
        return new Response(JSON.stringify({ error: 'Invalid bulk operation request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const results = [];
      let totalQuotaUsed = 0;

      // Pre-check total quota requirement
      for (const operation of operations) {
        const quotaContext: QuotaContext = {
          userId,
          operationType: operation.type,
          resourceSize: operation.size || 0,
          fileId: operation.fileId,
          metadata: operation.metadata || {}
        };

        const result = await this.enforceQuota(quotaContext);
        
        if (!result.allowed) {
          return new Response(JSON.stringify({
            error: 'Bulk operation quota exceeded',
            message: `Operation ${operation.id} would exceed quota`,
            quotaCheck: result.quotaCheck,
            failedOperation: operation
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        totalQuotaUsed += operation.size || 0;
        results.push({ operation, quotaCheck: result.quotaCheck });
      }

      // Execute operations and update quota
      for (const result of results) {
        // Perform the actual operation here
        // await performOperation(result.operation);
        
        // Update quota usage
        await this.updateQuotaUsage({
          userId,
          operationType: result.operation.type,
          resourceSize: result.operation.size || 0,
          fileId: result.operation.fileId,
          metadata: result.operation.metadata || {}
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Bulk operation completed (${operations.length} operations)`,
        totalQuotaUsed,
        results: results.map(r => r.quotaCheck)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
  }

  // Private helper methods

  private generateErrorMessage(quotaCheck: {
    quotaType: string;
    currentUsage: number;
    limit: number;
    percentageUsed: number;
    resetTime?: Date;
  }): string {
    const percentage = quotaCheck.percentageUsed.toFixed(1);
    const resetTime = quotaCheck.resetTime && quotaCheck.resetTime instanceof Date 
      ? ` Resets at ${quotaCheck.resetTime.toISOString()}` 
      : '';
    
    return `Quota exceeded for ${quotaCheck.quotaType}: ${quotaCheck.currentUsage}/${quotaCheck.limit} (${percentage}% used).${resetTime}`;
  }

  private generateRecommendedAction(quotaCheck: {
    quotaType: string;
  }): string {
    if (quotaCheck.quotaType === 'storage') {
      return 'Delete unused files or upgrade to a higher tier';
    }
    if (quotaCheck.quotaType === 'file_count') {
      return 'Delete old files or upgrade to a higher tier';
    }
    if (quotaCheck.quotaType.includes('requests')) {
      return 'Reduce request frequency or wait for quota reset';
    }
    if (quotaCheck.quotaType === 'bandwidth') {
      return 'Reduce downloads or upgrade to a higher tier';
    }
    return 'Upgrade to a higher tier or contact support';
  }

  private calculateRetryAfter(quotaCheck: {
    resetTime?: Date;
  }): number {
    if (quotaCheck.resetTime && quotaCheck.resetTime instanceof Date && !isNaN(quotaCheck.resetTime.getTime())) {
      const now = new Date();
      const diffMinutes = Math.ceil((quotaCheck.resetTime.getTime() - now.getTime()) / (1000 * 60));
      return Math.max(1, diffMinutes);
    }
    return 60; // Default 1 hour
  }

  private shouldSkipQuotaCheck(pathname: string, method: string): boolean {
    // Skip quota check for health checks, auth endpoints, etc.
    const skipPaths = [
      '/health',
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/quota/status',
      '/quota/analytics'
    ];

    return skipPaths.some(path => pathname.startsWith(path)) || 
           (method === 'GET' && pathname.startsWith('/api/quota'));
  }

  private async extractQuotaContext(request: Request, env: CloudflareEnv): Promise<QuotaContext | null> {
    const url = new URL(request.url);
    const method = request.method;
    
    // Extract user ID from JWT token or request headers
    const authHeader = request.headers.get('Authorization');
    const userId = this.extractUserIdFromAuth(authHeader);
    
    if (!userId) {
      return null;
    }

    let operationType: QuotaOperationType;
    let resourceSize = 0;
    let fileId: string | undefined;
    let contentType: string | undefined;

    // Determine operation type based on endpoint and method
    if (url.pathname.includes('/upload') && method === 'POST') {
      operationType = QuotaOperationType.UPLOAD;
      contentType = request.headers.get('content-type') || undefined;
      
      // Try to get content length
      const contentLength = request.headers.get('content-length');
      if (contentLength) {
        resourceSize = parseInt(contentLength, 10);
      }
    } else if (url.pathname.includes('/download') && method === 'GET') {
      operationType = QuotaOperationType.DOWNLOAD;
      fileId = url.searchParams.get('fileId') || undefined;
      
      // Resource size will be determined from file metadata
      if (fileId) {
        resourceSize = await this.getFileSize(fileId, env.DB);
      }
    } else if (url.pathname.includes('/delete') && method === 'DELETE') {
      operationType = QuotaOperationType.DELETE;
      fileId = url.searchParams.get('fileId') || undefined;
      
      // Resource size will be determined from file metadata
      if (fileId) {
        resourceSize = await this.getFileSize(fileId, env.DB);
      }
    } else if (url.pathname.includes('/process') && method === 'POST') {
      operationType = QuotaOperationType.PROCESS;
      fileId = url.searchParams.get('fileId') || undefined;
    } else if (method === 'GET') {
      operationType = QuotaOperationType.LIST;
    } else {
      operationType = QuotaOperationType.METADATA;
    }

    return {
      userId,
      operationType,
      resourceSize,
      fileId,
      contentType,
      metadata: {
        endpoint: url.pathname,
        method,
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('cf-connecting-ip')
      }
    };
  }

  private extractUserIdFromAuth(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    try {
      const token = authHeader.slice(7);
      // This is a simplified token extraction - in reality you'd validate the JWT
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.userId || null;
    } catch {
      return null;
    }
  }

  private async getFileSize(fileId: string, db: D1Database): Promise<number> {
    try {
      const result = await db.prepare('SELECT file_size FROM files WHERE id = ?')
        .bind(fileId)
        .first();
      
      return result?.file_size as number || 0;
    } catch {
      return 0;
    }
  }

  private async createDefaultQuotaForUser(userId: string): Promise<void> {
    // This would typically be handled by a trigger in the database
    // But we can provide a fallback implementation
    console.warn(`Creating default quota for user ${userId}`);
  }
}

// Type extension for Request object
declare global {
  interface Request {
    quotaContext?: QuotaContext;
  }
}

// Export utility functions for quota enforcement
export async function enforceQuotaForOperation(
  quotaManager: QuotaManager,
  context: QuotaContext
): Promise<QuotaEnforcementResult> {
  const middleware = new QuotaEnforcementMiddleware({ quotaManager });
  return middleware.enforceQuota(context);
}

export async function updateQuotaAfterOperation(
  quotaManager: QuotaManager,
  context: QuotaContext
): Promise<void> {
  const middleware = new QuotaEnforcementMiddleware({ quotaManager });
  await middleware.updateQuotaUsage(context);
}

export function createQuotaHeaders(quotaCheck: {
  limit?: number;
  remainingQuota?: number;
  resetTime?: Date;
  currentUsage?: number;
  percentageUsed?: number;
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': quotaCheck.limit?.toString() || '0',
    'X-RateLimit-Remaining': quotaCheck.remainingQuota?.toString() || '0',
    'X-RateLimit-Reset': quotaCheck.resetTime?.toISOString() || '',
    'X-RateLimit-Used': quotaCheck.currentUsage?.toString() || '0',
    'X-RateLimit-Percentage': quotaCheck.percentageUsed?.toFixed(1) || '0'
  };
}
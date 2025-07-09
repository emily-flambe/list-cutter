import type { Env } from '../types';
import { ApiError } from '../middleware/error';
import { createExportService } from '../services/data-export/export-service';
import { verifyToken } from '../services/auth/jwt';
import type { ExportFormat, ExportType, ExportOptions } from '../services/data-export/export-service';

/**
 * Handle user data export request
 */
export async function handleCreateUserExport(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { format = 'json', options = {} } = await request.json();
    
    // Validate format
    const allowedFormats: ExportFormat[] = ['json', 'csv', 'xml'];
    if (!allowedFormats.includes(format)) {
      return new Response(JSON.stringify({ error: 'Invalid format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check user permissions
    const hasPermission = await checkExportPermission(env, user.user_id, 'user_data', 'user');
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rate limits
    const rateLimitCheck = await checkExportRateLimit(env, user.user_id);
    if (!rateLimitCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded', 
        retryAfter: rateLimitCheck.retryAfter 
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const exportService = createExportService(env);
    const result = await exportService.exportUserData(user.user_id, format, options);
    
    return new Response(JSON.stringify({
      success: true,
      export: {
        id: result.id,
        status: result.status,
        format: result.format,
        fileName: result.fileName,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt
      },
      message: 'User data export created successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('User export creation error:', error);
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to create user export' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle bulk data export request (admin only)
 */
export async function handleCreateBulkExport(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check admin permissions
    const hasPermission = await checkExportPermission(env, user.user_id, 'bulk_data', 'admin');
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Admin permission required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { format = 'json', options = {} } = await request.json();
    
    // Validate format
    const allowedFormats: ExportFormat[] = ['json', 'csv', 'xml'];
    if (!allowedFormats.includes(format)) {
      return new Response(JSON.stringify({ error: 'Invalid format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const exportService = createExportService(env);
    const result = await exportService.exportBulkData(user.user_id, format, options);
    
    return new Response(JSON.stringify({
      success: true,
      export: {
        id: result.id,
        status: result.status,
        format: result.format,
        fileName: result.fileName,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        recordCount: result.recordCount
      },
      message: 'Bulk data export created successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Bulk export creation error:', error);
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to create bulk export' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle export status request
 */
export async function handleGetExportStatus(request: Request, env: Env, exportId: string): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare(`
      SELECT * FROM data_exports WHERE id = ?
    `).bind(exportId).first();

    if (!result) {
      return new Response(JSON.stringify({ error: 'Export not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check permissions
    if (result.user_id && result.user_id !== user.user_id) {
      const hasAdminPermission = await checkExportPermission(env, user.user_id, 'bulk_data', 'admin');
      if (!hasAdminPermission) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Get export logs for additional context
    const logs = await env.DB.prepare(`
      SELECT * FROM export_logs 
      WHERE export_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 10
    `).bind(exportId).all();

    return new Response(JSON.stringify({
      success: true,
      export: {
        id: result.id,
        exportType: result.export_type,
        format: result.format,
        scope: result.scope,
        status: result.status,
        fileName: result.file_name,
        fileSize: result.file_size,
        recordCount: result.record_count,
        checksum: result.checksum,
        createdAt: result.created_at,
        completedAt: result.completed_at,
        expiresAt: result.expires_at,
        downloadCount: result.download_count,
        lastDownloadedAt: result.last_downloaded_at,
        errorMessage: result.error_message
      },
      logs: logs.results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get export status error:', error);
    return new Response(JSON.stringify({ error: 'Failed to retrieve export status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle export download request
 */
export async function handleDownloadExport(request: Request, env: Env, exportId: string): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const exportService = createExportService(env);
    const downloadUrl = await exportService.getExportDownloadUrl(exportId, user.user_id);
    
    // Get the actual file from R2
    const exportData = await env.DB.prepare(`
      SELECT * FROM data_exports WHERE id = ?
    `).bind(exportId).first();

    if (!exportData) {
      return new Response(JSON.stringify({ error: 'Export not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileObject = await env.R2_BUCKET.get(exportData.file_path);
    if (!fileObject) {
      return new Response(JSON.stringify({ error: 'Export file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const contentType = getContentTypeForFormat(exportData.format);
    const contentDisposition = `attachment; filename="${exportData.file_name}"`;

    return new Response(fileObject.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': exportData.file_size.toString(),
        'Cache-Control': 'private, no-cache'
      }
    });
  } catch (error) {
    console.error('Export download error:', error);
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to download export' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle list exports request
 */
export async function handleListExports(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const format = url.searchParams.get('format');
    const exportType = url.searchParams.get('export_type');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const includeAll = url.searchParams.get('include_all') === 'true';
    
    // Check if user has admin permissions to see all exports
    const hasAdminPermission = await checkExportPermission(env, user.user_id, 'bulk_data', 'admin');
    
    let query = 'SELECT * FROM data_exports WHERE 1=1';
    const params: any[] = [];
    
    // If not admin or not requesting all exports, filter by user
    if (!hasAdminPermission || !includeAll) {
      query += ' AND user_id = ?';
      params.push(user.user_id);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (format) {
      query += ' AND format = ?';
      params.push(format);
    }
    
    if (exportType) {
      query += ' AND export_type = ?';
      params.push(exportType);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM data_exports WHERE 1=1';
    const countParams: any[] = [];
    
    if (!hasAdminPermission || !includeAll) {
      countQuery += ' AND user_id = ?';
      countParams.push(user.user_id);
    }
    
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    if (format) {
      countQuery += ' AND format = ?';
      countParams.push(format);
    }
    
    if (exportType) {
      countQuery += ' AND export_type = ?';
      countParams.push(exportType);
    }
    
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
    
    return new Response(JSON.stringify({
      success: true,
      exports: result.results.map((exp: any) => ({
        id: exp.id,
        exportType: exp.export_type,
        format: exp.format,
        scope: exp.scope,
        status: exp.status,
        fileName: exp.file_name,
        fileSize: exp.file_size,
        recordCount: exp.record_count,
        createdAt: exp.created_at,
        completedAt: exp.completed_at,
        expiresAt: exp.expires_at,
        downloadCount: exp.download_count,
        lastDownloadedAt: exp.last_downloaded_at
      })),
      meta: {
        total: countResult?.total || 0,
        limit,
        offset,
        hasMore: (countResult?.total || 0) > offset + limit
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List exports error:', error);
    return new Response(JSON.stringify({ error: 'Failed to list exports' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle schedule export request
 */
export async function handleScheduleExport(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { exportType, format, scheduledAt, options = {} } = await request.json();
    
    // Validate export type and format
    const allowedExportTypes: ExportType[] = ['user_data', 'bulk_data'];
    const allowedFormats: ExportFormat[] = ['json', 'csv', 'xml'];
    
    if (!allowedExportTypes.includes(exportType)) {
      return new Response(JSON.stringify({ error: 'Invalid export type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!allowedFormats.includes(format)) {
      return new Response(JSON.stringify({ error: 'Invalid format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check permissions
    const scope = exportType === 'bulk_data' ? 'admin' : 'user';
    const hasPermission = await checkExportPermission(env, user.user_id, exportType, scope);
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const exportService = createExportService(env);
    const result = await exportService.scheduleExport(
      user.user_id, 
      exportType, 
      format, 
      { ...options, scheduledAt }
    );
    
    return new Response(JSON.stringify({
      success: true,
      request: {
        id: result.id,
        exportType: result.requestType,
        format: result.format,
        status: result.status,
        scheduledAt: result.scheduledAt,
        createdAt: result.createdAt
      },
      message: 'Export scheduled successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Schedule export error:', error);
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to schedule export' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle export verification request
 */
export async function handleVerifyExport(request: Request, env: Env, exportId: string): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if export exists and user has access
    const exportData = await env.DB.prepare(`
      SELECT * FROM data_exports WHERE id = ?
    `).bind(exportId).first();

    if (!exportData) {
      return new Response(JSON.stringify({ error: 'Export not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check permissions
    if (exportData.user_id && exportData.user_id !== user.user_id) {
      const hasAdminPermission = await checkExportPermission(env, user.user_id, 'bulk_data', 'admin');
      if (!hasAdminPermission) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const exportService = createExportService(env);
    const result = await exportService.verifyExport(exportId);
    
    return new Response(JSON.stringify({
      success: true,
      verification: result,
      message: result.success ? 'Export verification passed' : 'Export verification failed'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Export verification error:', error);
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to verify export' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle export statistics request
 */
export async function handleGetExportStats(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const includeSystemStats = url.searchParams.get('include_system') === 'true';
    
    const exportService = createExportService(env);
    
    // Get user-specific stats
    const userStats = await exportService.getExportStats(user.user_id);
    
    let systemStats = null;
    if (includeSystemStats) {
      // Check admin permissions for system stats
      const hasAdminPermission = await checkExportPermission(env, user.user_id, 'bulk_data', 'admin');
      if (hasAdminPermission) {
        systemStats = await exportService.getExportStats();
        
        // Get additional system metrics
        const healthMetrics = await env.DB.prepare(`
          SELECT * FROM export_health_metrics ORDER BY total_exports DESC
        `).all();
        
        systemStats.healthMetrics = healthMetrics.results;
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      userStats,
      systemStats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get export stats error:', error);
    return new Response(JSON.stringify({ error: 'Failed to retrieve export statistics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle export cleanup request (admin only)
 */
export async function handleCleanupExports(request: Request, env: Env): Promise<Response> {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = await verifyToken(token, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check admin permissions
    const hasAdminPermission = await checkExportPermission(env, user.user_id, 'bulk_data', 'admin');
    if (!hasAdminPermission) {
      return new Response(JSON.stringify({ error: 'Admin permission required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const exportService = createExportService(env);
    await exportService.cleanupExpiredExports();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Export cleanup completed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Export cleanup error:', error);
    return new Response(JSON.stringify({ error: 'Failed to cleanup exports' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle process scheduled exports (internal cron job)
 */
export async function handleProcessScheduledExports(request: Request, env: Env): Promise<Response> {
  try {
    // This should be called by a cron trigger, but we'll add basic auth check for security
    const authHeader = request.headers.get('Authorization');
    const expectedAuth = `Bearer ${env.JWT_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const exportService = createExportService(env);
    await exportService.processScheduledExports();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduled exports processed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Process scheduled exports error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process scheduled exports' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper functions

async function checkExportPermission(
  env: Env, 
  userId: number, 
  exportType: ExportType, 
  scope: string
): Promise<boolean> {
  try {
    const permission = await env.DB.prepare(`
      SELECT can_create FROM export_permissions 
      WHERE user_id = ? AND export_type = ? AND scope = ?
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).bind(userId, exportType, scope).first();

    if (permission?.can_create) {
      return true;
    }

    // Check if user is admin (fallback check)
    const user = await env.DB.prepare(`
      SELECT is_superuser FROM auth_user WHERE id = ?
    `).bind(userId).first();

    return user?.is_superuser === 1;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

async function checkExportRateLimit(env: Env, userId: number): Promise<{
  allowed: boolean;
  retryAfter?: number;
}> {
  try {
    // Get rate limit configuration
    const rateLimitConfig = await env.DB.prepare(`
      SELECT config_value FROM export_config WHERE config_key = 'export_rate_limit'
    `).first();
    
    const rateLimit = parseInt(rateLimitConfig?.config_value || '10');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Count exports in the last hour
    const recentExports = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM data_exports 
      WHERE user_id = ? AND created_at > ?
    `).bind(userId, oneHourAgo).first();
    
    const currentCount = recentExports?.count || 0;
    
    if (currentCount >= rateLimit) {
      return {
        allowed: false,
        retryAfter: 3600 // 1 hour in seconds
      };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true }; // Allow on error to avoid blocking
  }
}

function getContentTypeForFormat(format: string): string {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'xml':
      return 'application/xml';
    default:
      return 'application/octet-stream';
  }
}
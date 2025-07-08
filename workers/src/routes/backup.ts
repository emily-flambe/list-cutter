import type { Env } from '../types';
import { ApiError } from '../middleware/error';
import { createBackupService } from '../services/backup/r2-backup';
import { verifyToken } from '../services/auth/jwt';

/**
 * Handle backup creation request
 */
export async function handleCreateBackup(request: Request, env: Env): Promise<Response> {
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

    const { type = 'auto' } = await request.json();
    const backupService = createBackupService(env);
    
    let result;
    if (type === 'full') {
      result = await backupService.createFullBackup();
    } else if (type === 'incremental') {
      result = await backupService.createIncrementalBackup();
    } else {
      // Auto mode - let the service decide
      await backupService.scheduleDailyBackup();
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Backup scheduled successfully' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      backup: result,
      message: `${result.backupType} backup created successfully`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Backup creation error:', error);
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to create backup' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle backup status request
 */
export async function handleGetBackupStatus(request: Request, env: Env, backupId: string): Promise<Response> {
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
      SELECT * FROM r2_backups WHERE id = ?
    `).bind(backupId).first();

    if (!result) {
      return new Response(JSON.stringify({ error: 'Backup not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      backup: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get backup status error:', error);
    return new Response(JSON.stringify({ error: 'Failed to retrieve backup status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle list backups request
 */
export async function handleListBackups(request: Request, env: Env): Promise<Response> {
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
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    let query = 'SELECT * FROM r2_backups WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (type) {
      query += ' AND backup_type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY backup_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({
      success: true,
      backups: result.results,
      meta: {
        total: result.results.length,
        limit,
        offset
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List backups error:', error);
    return new Response(JSON.stringify({ error: 'Failed to list backups' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle backup verification request
 */
export async function handleVerifyBackup(request: Request, env: Env, backupId: string): Promise<Response> {
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

    const backupService = createBackupService(env);
    const result = await backupService.verifyBackup(backupId);
    
    // Store verification result in database
    await env.DB.prepare(`
      INSERT INTO backup_verifications (
        backup_id, verification_date, status, verified_files, total_files,
        corrupted_files, missing_files, checksum_mismatches, verification_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      backupId,
      new Date().toISOString(),
      result.success ? 'passed' : 'failed',
      result.verifiedFiles,
      result.totalFiles,
      result.corruptedFiles.length,
      result.missingFiles.length,
      result.checksumMismatches.length,
      0 // verification_time_ms would be calculated in a real implementation
    ).run();
    
    return new Response(JSON.stringify({
      success: true,
      verification: result,
      message: result.success ? 'Backup verification passed' : 'Backup verification failed'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Backup verification error:', error);
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to verify backup' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle backup restore request
 */
export async function handleRestoreBackup(request: Request, env: Env, backupId: string): Promise<Response> {
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

    const options = await request.json();
    const backupService = createBackupService(env);
    
    const result = await backupService.restoreBackup(backupId, options);
    
    // Store restore operation in database
    await env.DB.prepare(`
      INSERT INTO backup_restores (
        backup_id, restore_date, status, target_bucket, restored_files, total_files,
        errors_count, overwrite_existing, verify_after_restore, filters, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      backupId,
      new Date().toISOString(),
      result.success ? 'completed' : 'failed',
      options.targetBucket || 'default',
      result.restoredFiles,
      result.totalFiles,
      result.errors.length,
      options.overwriteExisting || false,
      options.verifyAfterRestore || false,
      JSON.stringify(options.filters || {}),
      new Date().toISOString(),
      new Date().toISOString()
    ).run();
    
    return new Response(JSON.stringify({
      success: result.success,
      restore: result,
      message: result.success ? 'Backup restored successfully' : 'Backup restore completed with errors'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Backup restore error:', error);
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to restore backup' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle backup statistics request
 */
export async function handleGetBackupStats(request: Request, env: Env): Promise<Response> {
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

    const backupService = createBackupService(env);
    const stats = await backupService.getBackupStats();
    
    // Get additional metrics from database
    const healthMetrics = await env.DB.prepare(`
      SELECT * FROM backup_health_metrics WHERE bucket_name = ?
    `).bind('cutty-files').first();
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        ...stats,
        ...healthMetrics
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get backup stats error:', error);
    return new Response(JSON.stringify({ error: 'Failed to retrieve backup statistics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle backup cleanup request
 */
export async function handleCleanupBackups(request: Request, env: Env): Promise<Response> {
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

    const backupService = createBackupService(env);
    await backupService.cleanupOldBackups();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Backup cleanup completed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Backup cleanup error:', error);
    return new Response(JSON.stringify({ error: 'Failed to cleanup old backups' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
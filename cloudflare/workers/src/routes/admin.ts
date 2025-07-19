/**
 * Consolidated Admin Routes
 * 
 * Simple admin endpoints for system management:
 * - System stats
 * - User management
 * - File cleanup
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { validateToken } from '../services/auth/jwt';

const admin = new Hono<{ Bindings: Env }>();

// Admin middleware - could check for admin role
admin.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
    
    // Simple admin check - in production, check user role
    const user = await c.env.DB.prepare(
      'SELECT email FROM users WHERE id = ?'
    ).bind(payload.user_id).first();
    
    // For now, just check if email contains 'admin' or is specific email
    if (!user?.email?.includes('admin') && user?.email !== 'emily@example.com') {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    c.set('userId', payload.user_id);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// System stats endpoint
admin.get('/stats', async (c) => {
  try {
    // Get user count
    const userCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first();

    // Get file count and total size
    const fileStats = await c.env.DB.prepare(
      'SELECT COUNT(*) as count, SUM(size_bytes) as total_size FROM files'
    ).first();

    // Get recent activity
    const recentFiles = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM files WHERE created_at > datetime("now", "-24 hours")'
    ).first();

    return c.json({
      success: true,
      stats: {
        users: {
          total: userCount.count
        },
        files: {
          total: fileStats.count,
          totalSizeBytes: fileStats.total_size || 0,
          last24Hours: recentFiles.count
        },
        system: {
          environment: c.env.ENVIRONMENT || 'development',
          version: c.env.API_VERSION || 'v1'
        }
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

// List users endpoint
admin.get('/users', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const users = await c.env.DB.prepare(
      `SELECT id, email, username, created_at, 
       (SELECT COUNT(*) FROM files WHERE user_id = users.id) as file_count
       FROM users 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    const totalCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM users'
    ).first();

    return c.json({
      success: true,
      users: users.results,
      pagination: {
        total: totalCount.total,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('List users error:', error);
    return c.json({ error: 'Failed to list users' }, 500);
  }
});

// Cleanup old files endpoint
admin.post('/cleanup', async (c) => {
  try {
    const { daysOld = 30 } = await c.req.json();

    // Get old files
    const oldFiles = await c.env.DB.prepare(
      'SELECT id, file_key FROM files WHERE created_at < datetime("now", ?)'
    ).bind(`-${daysOld} days`).all();

    let deletedCount = 0;
    for (const file of oldFiles.results) {
      try {
        // Delete from R2
        await c.env.FILE_STORAGE.delete(file.file_key);
        
        // Delete from database
        await c.env.DB.prepare(
          'DELETE FROM files WHERE id = ?'
        ).bind(file.id).run();
        
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete file ${file.id}:`, error);
      }
    }

    return c.json({
      success: true,
      message: `Cleaned up ${deletedCount} files older than ${daysOld} days`
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return c.json({ error: 'Cleanup failed' }, 500);
  }
});

// Simple health check for admin
admin.get('/health', async (c) => {
  try {
    // Test database connection
    const dbTest = await c.env.DB.prepare('SELECT 1').first();
    
    // Test R2 connection
    let r2Status = 'unknown';
    try {
      await c.env.FILE_STORAGE.list({ limit: 1 });
      r2Status = 'connected';
    } catch {
      r2Status = 'error';
    }

    return c.json({
      success: true,
      health: {
        database: dbTest ? 'connected' : 'error',
        storage: r2Status,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({ 
      success: false,
      error: 'Health check failed' 
    }, 500);
  }
});

export default admin;
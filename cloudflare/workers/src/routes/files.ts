/**
 * Consolidated File Routes
 * 
 * Combines all file-related endpoints into a single file:
 * - File upload
 * - File download
 * - File deletion
 * - File listing
 * - CSV processing
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { validateFile } from '../services/security/file-validator';
import { validateToken } from '../services/auth/jwt';

const files = new Hono<{ Bindings: Env }>();

// Middleware to verify authentication (skip for download endpoint)
files.use('*', async (c, next) => {
  // Allow anonymous access to download endpoint for synthetic data
  if (c.req.method === 'GET' && c.req.path.match(/\/[a-f0-9-]{36}$/)) {
    // This is a download request, check for auth but don't require it
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
        c.set('userId', payload.user_id);
      } catch (error) {
        // Authentication failed, but we'll continue without setting userId
        console.log('Optional authentication failed for download:', error);
      }
    }
    await next();
    return;
  }

  // For all other endpoints, require authentication
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
    c.set('userId', payload.user_id);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Upload file endpoint
files.post('/upload', async (c) => {
  try {
    const userId = c.get('userId');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file
    const validation = await validateFile(file, {
      maxSize: parseInt(c.env.MAX_FILE_SIZE || '52428800'),
      allowedTypes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
      allowedExtensions: ['.csv', '.txt', '.tsv']
    });

    if (!validation.valid) {
      return c.json({ 
        error: 'File validation failed', 
        details: validation.errors 
      }, 400);
    }

    // Generate file ID and key
    const fileId = crypto.randomUUID();
    const fileKey = `files/${userId}/${fileId}/${file.name}`;

    // Upload to R2
    await c.env.FILE_STORAGE.put(fileKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      },
      customMetadata: {
        userId,
        originalName: file.name,
        size: file.size.toString(),
        uploadedAt: new Date().toISOString()
      }
    });

    // Save file metadata to database
    await c.env.DB.prepare(
      `INSERT INTO files (id, user_id, filename, file_key, size_bytes, mime_type) 
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(fileId, userId, file.name, fileKey, file.size, file.type).run();

    return c.json({
      success: true,
      file: {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

// Download file endpoint - allows anonymous access for synthetic data
files.get('/:fileId', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    // Get file metadata from database - check both authenticated and anonymous users
    let fileRecord;
    if (userId) {
      // Authenticated user - check their files
      fileRecord = await c.env.DB.prepare(
        'SELECT * FROM files WHERE id = ? AND user_id = ?'
      ).bind(fileId, userId).first();
    } else {
      // Anonymous user - check for synthetic data files
      fileRecord = await c.env.DB.prepare(
        'SELECT * FROM files WHERE id = ? AND user_id = ? AND tags LIKE ?'
      ).bind(fileId, 'anonymous', '%synthetic-data%').first();
    }

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key || fileRecord.file_key);
    
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Return file with appropriate headers
    return new Response(object.body, {
      headers: {
        'Content-Type': fileRecord.mime_type || 'text/csv',
        'Content-Disposition': `attachment; filename="${fileRecord.original_filename || fileRecord.filename}"`,
        'Content-Length': (fileRecord.file_size || fileRecord.size_bytes).toString()
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    return c.json({ error: 'Download failed' }, 500);
  }
});

// Delete file endpoint
files.delete('/:fileId', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    // Get file metadata
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Delete from R2
    await c.env.FILE_STORAGE.delete(fileRecord.file_key);

    // Delete from database
    await c.env.DB.prepare(
      'DELETE FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).run();

    return c.json({ 
      success: true, 
      message: 'File deleted successfully' 
    });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: 'Delete failed' }, 500);
  }
});

// List files endpoint
files.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // Get files from database
    const files = await c.env.DB.prepare(
      `SELECT id, filename, size_bytes, mime_type, created_at 
       FROM files 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all();

    // Get total count
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM files WHERE user_id = ?'
    ).bind(userId).first();

    return c.json({
      success: true,
      files: files.results,
      pagination: {
        total: countResult.total,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    return c.json({ error: 'Failed to list files' }, 500);
  }
});

// Simple CSV processing endpoint
files.post('/:fileId/process', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const { operation, parameters } = await c.req.json();

    // Get file metadata
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.file_key);
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Read file content
    const content = await object.text();
    
    // Basic CSV processing (example: get row count)
    const rows = content.trim().split('\n');
    const headers = rows[0].split(',');
    
    let result;
    switch (operation) {
      case 'info':
        result = {
          rowCount: rows.length,
          columnCount: headers.length,
          headers: headers,
          fileSize: fileRecord.size_bytes
        };
        break;
      
      case 'slice':
        const start = parameters?.start || 0;
        const end = parameters?.end || rows.length;
        result = {
          data: rows.slice(start, end).join('\n'),
          rowCount: end - start
        };
        break;
      
      default:
        return c.json({ error: 'Unknown operation' }, 400);
    }

    return c.json({ success: true, result });
  } catch (error) {
    console.error('Process error:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

export default files;
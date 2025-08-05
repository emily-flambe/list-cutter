/**
 * Cuttytabs Segmentation Routes
 * 
 * Manages dynamic data segments from CSV files:
 * - Create, read, update, delete segments
 * - Query segment membership and counts
 * - Preview segment results before saving
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { validateToken } from '../services/auth/jwt';

const segments = new Hono<{ Bindings: Env }>();

// Authentication middleware
segments.use('*', async (c, next) => {
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

// Build SQL WHERE clause from segment query
function buildWhereClause(query: any): string {
  if (!query.conditions || !Array.isArray(query.conditions)) {
    throw new Error('Invalid query format');
  }

  const conditions = query.conditions.map((cond: any) => {
    const jsonPath = `json_extract(data, '$.${cond.field}')`;
    
    switch (cond.operator) {
      case 'equals':
        return `${jsonPath} = '${cond.value}'`;
      case 'not_equals':
        return `${jsonPath} != '${cond.value}'`;
      case 'contains':
        return `${jsonPath} LIKE '%${cond.value}%'`;
      case 'not_contains':
        return `${jsonPath} NOT LIKE '%${cond.value}%'`;
      case 'greater_than':
        return `CAST(${jsonPath} AS REAL) > ${Number(cond.value)}`;
      case 'less_than':
        return `CAST(${jsonPath} AS REAL) < ${Number(cond.value)}`;
      case 'greater_equal':
        return `CAST(${jsonPath} AS REAL) >= ${Number(cond.value)}`;
      case 'less_equal':
        return `CAST(${jsonPath} AS REAL) <= ${Number(cond.value)}`;
      case 'is_empty':
        return `(${jsonPath} IS NULL OR ${jsonPath} = '')`;
      case 'is_not_empty':
        return `(${jsonPath} IS NOT NULL AND ${jsonPath} != '')`;
      case 'starts_with':
        return `${jsonPath} LIKE '${cond.value}%'`;
      case 'ends_with':
        return `${jsonPath} LIKE '%${cond.value}'`;
      default:
        throw new Error(`Unknown operator: ${cond.operator}`);
    }
  });

  const logic = query.logic === 'OR' ? 'OR' : 'AND';
  return conditions.join(` ${logic} `);
}

// Preview segment without saving - get count and sample rows
segments.post('/preview', async (c) => {
  try {
    const userId = c.get('userId');
    const { fileId, query, limit = 10 } = await c.req.json();

    if (!fileId || !query) {
      return c.json({ error: 'fileId and query are required' }, 400);
    }

    // Verify user owns the file
    const fileCheck = await c.env.DB.prepare(
      'SELECT id FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileCheck) {
      return c.json({ error: 'File not found' }, 404);
    }

    const whereClause = buildWhereClause(query);
    
    // Get total count
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM csv_data 
      WHERE file_id = ? AND ${whereClause}
    `).bind(fileId).first();

    // Get sample rows
    const sampleRows = await c.env.DB.prepare(`
      SELECT id, data FROM csv_data 
      WHERE file_id = ? AND ${whereClause}
      LIMIT ?
    `).bind(fileId, limit).all();

    return c.json({
      success: true,
      count: countResult?.count || 0,
      sampleRows: sampleRows.results.map((row: any) => ({
        id: row.id,
        data: JSON.parse(row.data)
      }))
    });
  } catch (error) {
    console.error('Preview error:', error);
    return c.json({ 
      error: 'Preview failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Create new segment
segments.post('/', async (c) => {
  try {
    const userId = c.get('userId');
    const { name, description, fileId, query, googleAdsEnabled, googleAdsCustomerId, googleAdsListId } = await c.req.json();

    if (!name || !fileId || !query) {
      return c.json({ error: 'name, fileId, and query are required' }, 400);
    }

    // Verify user owns the file
    const fileCheck = await c.env.DB.prepare(
      'SELECT id FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileCheck) {
      return c.json({ error: 'File not found' }, 404);
    }

    const segmentId = crypto.randomUUID();
    
    // Create segment
    await c.env.DB.prepare(`
      INSERT INTO segments (
        id, name, description, file_id, query, user_id,
        google_ads_enabled, google_ads_customer_id, google_ads_list_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      segmentId, name, description || '', fileId, JSON.stringify(query), userId,
      !!googleAdsEnabled, googleAdsCustomerId || null, googleAdsListId || null
    ).run();

    // Get initial member count
    const whereClause = buildWhereClause(query);
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM csv_data 
      WHERE file_id = ? AND ${whereClause}
    `).bind(fileId).first();

    // Update member count
    await c.env.DB.prepare(`
      UPDATE segments SET member_count = ? WHERE id = ?
    `).bind(countResult?.count || 0, segmentId).run();

    return c.json({
      success: true,
      segment: {
        id: segmentId,
        name,
        description,
        fileId,
        query,
        memberCount: countResult?.count || 0,
        googleAdsEnabled: !!googleAdsEnabled,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Create segment error:', error);
    return c.json({ 
      error: 'Failed to create segment',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get all segments for user
segments.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await c.env.DB.prepare(`
      SELECT 
        s.*,
        f.original_filename as file_name
      FROM segments s
      JOIN files f ON s.file_id = f.id
      WHERE s.user_id = ?
      ORDER BY s.updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const segments = result.results.map((segment: any) => ({
      id: segment.id,
      name: segment.name,
      description: segment.description,
      fileId: segment.file_id,
      fileName: segment.file_name,
      memberCount: segment.member_count,
      lastProcessed: segment.last_processed,
      googleAdsEnabled: !!segment.google_ads_enabled,
      createdAt: segment.created_at,
      updatedAt: segment.updated_at
    }));

    return c.json({
      success: true,
      segments
    });
  } catch (error) {
    console.error('List segments error:', error);
    return c.json({ error: 'Failed to list segments' }, 500);
  }
});

// Get specific segment
segments.get('/:segmentId', async (c) => {
  try {
    const userId = c.get('userId');
    const segmentId = c.req.param('segmentId');

    const segment = await c.env.DB.prepare(`
      SELECT 
        s.*,
        f.original_filename as file_name
      FROM segments s
      JOIN files f ON s.file_id = f.id
      WHERE s.id = ? AND s.user_id = ?
    `).bind(segmentId, userId).first();

    if (!segment) {
      return c.json({ error: 'Segment not found' }, 404);
    }

    return c.json({
      success: true,
      segment: {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        fileId: segment.file_id,
        fileName: segment.file_name,
        query: JSON.parse(segment.query),
        memberCount: segment.member_count,
        lastProcessed: segment.last_processed,
        googleAdsEnabled: !!segment.google_ads_enabled,
        googleAdsCustomerId: segment.google_ads_customer_id,
        googleAdsListId: segment.google_ads_list_id,
        createdAt: segment.created_at,
        updatedAt: segment.updated_at
      }
    });
  } catch (error) {
    console.error('Get segment error:', error);
    return c.json({ error: 'Failed to get segment' }, 500);
  }
});

// Update segment
segments.put('/:segmentId', async (c) => {
  try {
    const userId = c.get('userId');
    const segmentId = c.req.param('segmentId');
    const { name, description, query, googleAdsEnabled, googleAdsCustomerId, googleAdsListId } = await c.req.json();

    // Verify ownership
    const existingSegment = await c.env.DB.prepare(
      'SELECT id, file_id FROM segments WHERE id = ? AND user_id = ?'
    ).bind(segmentId, userId).first();

    if (!existingSegment) {
      return c.json({ error: 'Segment not found' }, 404);
    }

    // Update segment
    await c.env.DB.prepare(`
      UPDATE segments SET 
        name = ?, 
        description = ?, 
        query = ?,
        google_ads_enabled = ?,
        google_ads_customer_id = ?,
        google_ads_list_id = ?,
        last_processed = NULL
      WHERE id = ? AND user_id = ?
    `).bind(
      name, description || '', JSON.stringify(query),
      !!googleAdsEnabled, googleAdsCustomerId || null, googleAdsListId || null,
      segmentId, userId
    ).run();

    // Recalculate member count if query changed
    if (query) {
      const whereClause = buildWhereClause(query);
      const countResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM csv_data 
        WHERE file_id = ? AND ${whereClause}
      `).bind(existingSegment.file_id).first();

      await c.env.DB.prepare(`
        UPDATE segments SET member_count = ? WHERE id = ?
      `).bind(countResult?.count || 0, segmentId).run();
    }

    return c.json({ success: true, message: 'Segment updated' });
  } catch (error) {
    console.error('Update segment error:', error);
    return c.json({ 
      error: 'Failed to update segment',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Delete segment
segments.delete('/:segmentId', async (c) => {
  try {
    const userId = c.get('userId');
    const segmentId = c.req.param('segmentId');

    // Verify ownership and delete
    const result = await c.env.DB.prepare(
      'DELETE FROM segments WHERE id = ? AND user_id = ?'
    ).bind(segmentId, userId).run();

    if (!result.changes) {
      return c.json({ error: 'Segment not found' }, 404);
    }

    return c.json({ success: true, message: 'Segment deleted' });
  } catch (error) {
    console.error('Delete segment error:', error);
    return c.json({ error: 'Failed to delete segment' }, 500);
  }
});

export default segments;
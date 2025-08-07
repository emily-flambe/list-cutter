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

// Build SQL WHERE clause from segment query with parameterized queries for security
interface QueryCondition {
  field: string;
  operator: string;
  value: any;
}

interface SegmentQuery {
  conditions: QueryCondition[];
  logic?: 'AND' | 'OR';
}

interface QueryBuilder {
  whereClause: string;
  parameters: any[];
}

function buildSecureWhereClause(query: SegmentQuery): QueryBuilder {
  if (!query.conditions || !Array.isArray(query.conditions)) {
    throw new Error('Invalid query format: conditions must be an array');
  }

  if (query.conditions.length === 0) {
    throw new Error('Invalid query format: at least one condition required');
  }

  if (query.conditions.length > 10) {
    throw new Error('Security limit: maximum 10 conditions allowed per query');
  }

  const parameters: any[] = [];
  const conditions: string[] = [];

  for (const cond of query.conditions) {
    // Validate field name - only allow alphanumeric and underscores
    if (!cond.field || typeof cond.field !== 'string') {
      throw new Error('Invalid field name: field must be a non-empty string');
    }
    
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(cond.field)) {
      throw new Error(`Invalid field name '${cond.field}': only alphanumeric characters and underscores allowed, max 50 chars`);
    }

    // Sanitize the JSON path - use parameterized field name
    const jsonPath = `json_extract(data, '$.' || ?)`;
    
    switch (cond.operator) {
      case 'equals':
        conditions.push(`${jsonPath} = ?`);
        parameters.push(cond.field, String(cond.value));
        break;
      case 'not_equals':
        conditions.push(`${jsonPath} != ?`);
        parameters.push(cond.field, String(cond.value));
        break;
      case 'contains':
        conditions.push(`${jsonPath} LIKE ?`);
        parameters.push(cond.field, `%${String(cond.value)}%`);
        break;
      case 'not_contains':
        conditions.push(`${jsonPath} NOT LIKE ?`);
        parameters.push(cond.field, `%${String(cond.value)}%`);
        break;
      case 'greater_than':
        if (isNaN(Number(cond.value))) {
          throw new Error('Invalid value for numeric comparison: must be a number');
        }
        conditions.push(`CAST(${jsonPath} AS REAL) > ?`);
        parameters.push(cond.field, Number(cond.value));
        break;
      case 'less_than':
        if (isNaN(Number(cond.value))) {
          throw new Error('Invalid value for numeric comparison: must be a number');
        }
        conditions.push(`CAST(${jsonPath} AS REAL) < ?`);
        parameters.push(cond.field, Number(cond.value));
        break;
      case 'greater_equal':
        if (isNaN(Number(cond.value))) {
          throw new Error('Invalid value for numeric comparison: must be a number');
        }
        conditions.push(`CAST(${jsonPath} AS REAL) >= ?`);
        parameters.push(cond.field, Number(cond.value));
        break;
      case 'less_equal':
        if (isNaN(Number(cond.value))) {
          throw new Error('Invalid value for numeric comparison: must be a number');
        }
        conditions.push(`CAST(${jsonPath} AS REAL) <= ?`);
        parameters.push(cond.field, Number(cond.value));
        break;
      case 'is_empty':
        conditions.push(`(${jsonPath} IS NULL OR ${jsonPath} = '')`);
        parameters.push(cond.field);
        break;
      case 'is_not_empty':
        conditions.push(`(${jsonPath} IS NOT NULL AND ${jsonPath} != '')`);
        parameters.push(cond.field);
        break;
      case 'starts_with':
        conditions.push(`${jsonPath} LIKE ?`);
        parameters.push(cond.field, `${String(cond.value)}%`);
        break;
      case 'ends_with':
        conditions.push(`${jsonPath} LIKE ?`);
        parameters.push(cond.field, `%${String(cond.value)}`);
        break;
      default:
        throw new Error(`Unknown operator: ${cond.operator}`);
    }
  }

  const logic = query.logic === 'OR' ? 'OR' : 'AND';
  return {
    whereClause: conditions.join(` ${logic} `),
    parameters
  };
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

    const { whereClause, parameters } = buildSecureWhereClause(query);
    
    // Get total count with parameterized query
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM csv_data 
      WHERE file_id = ? AND ${whereClause}
    `).bind(fileId, ...parameters).first();

    // Validate and sanitize limit parameter
    const sanitizedLimit = Math.min(Math.max(1, parseInt(String(limit)) || 10), 100);
    
    // Get sample rows with parameterized query
    const sampleRows = await c.env.DB.prepare(`
      SELECT id, data FROM csv_data 
      WHERE file_id = ? AND ${whereClause}
      LIMIT ?
    `).bind(fileId, ...parameters, sanitizedLimit).all();

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
    
    // Return safe error messages without exposing internal details
    if (error instanceof Error && (
      error.message.includes('Invalid query format') ||
      error.message.includes('Invalid field name') ||
      error.message.includes('Security limit') ||
      error.message.includes('Unknown operator') ||
      error.message.includes('Invalid value for numeric')
    )) {
      return c.json({ 
        error: 'Invalid query parameters', 
        message: error.message 
      }, 400);
    }
    
    // Log detailed error but return generic message
    return c.json({ 
      error: 'Preview operation failed', 
      message: 'An error occurred while processing the query'
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

    // Get initial member count with secure query
    const { whereClause, parameters } = buildSecureWhereClause(query);
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM csv_data 
      WHERE file_id = ? AND ${whereClause}
    `).bind(fileId, ...parameters).first();

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
    
    // Return safe error messages for validation errors
    if (error instanceof Error && (
      error.message.includes('Invalid query format') ||
      error.message.includes('Invalid field name') ||
      error.message.includes('Security limit') ||
      error.message.includes('Unknown operator') ||
      error.message.includes('Invalid value for numeric')
    )) {
      return c.json({ 
        error: 'Invalid segment parameters', 
        message: error.message 
      }, 400);
    }
    
    // Log detailed error but return generic message
    return c.json({ 
      error: 'Failed to create segment',
      message: 'An error occurred while creating the segment'
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
      const { whereClause, parameters } = buildSecureWhereClause(query);
      const countResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM csv_data 
        WHERE file_id = ? AND ${whereClause}
      `).bind(existingSegment.file_id, ...parameters).first();

      await c.env.DB.prepare(`
        UPDATE segments SET member_count = ? WHERE id = ?
      `).bind(countResult?.count || 0, segmentId).run();
    }

    return c.json({ success: true, message: 'Segment updated' });
  } catch (error) {
    console.error('Update segment error:', error);
    
    // Return safe error messages for validation errors
    if (error instanceof Error && (
      error.message.includes('Invalid query format') ||
      error.message.includes('Invalid field name') ||
      error.message.includes('Security limit') ||
      error.message.includes('Unknown operator') ||
      error.message.includes('Invalid value for numeric')
    )) {
      return c.json({ 
        error: 'Invalid segment parameters', 
        message: error.message 
      }, 400);
    }
    
    // Log detailed error but return generic message
    return c.json({ 
      error: 'Failed to update segment',
      message: 'An error occurred while updating the segment'
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
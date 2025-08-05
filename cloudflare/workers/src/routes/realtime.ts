/**
 * Real-time Updates via Server-Sent Events
 * 
 * Provides live segment count updates and status changes to the frontend
 * without the complexity of WebSockets. Simple and effective!
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { validateToken } from '../services/auth/jwt';

const realtime = new Hono<{ Bindings: Env }>();

// Authentication middleware
realtime.use('*', async (c, next) => {
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

// Server-Sent Events endpoint for segment updates
realtime.get('/segments', async (c) => {
  const userId = c.get('userId');
  
  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: 'Real-time segment updates connected'
      })}\n\n`;
      
      controller.enqueue(encoder.encode(initialMessage));
      
      // Function to send segment updates
      const sendUpdate = async () => {
        try {
          // Get current segment stats for the user
          const segments = await c.env.DB.prepare(`
            SELECT 
              s.id,
              s.name,
              s.member_count,
              s.last_processed,
              s.google_ads_enabled,
              s.updated_at,
              f.original_filename as file_name,
              CASE 
                WHEN s.last_processed IS NULL THEN 'never_processed'
                WHEN datetime(s.last_processed) < datetime('now', '-2 minutes') THEN 'stale'
                ELSE 'fresh'
              END as processing_status
            FROM segments s
            JOIN files f ON s.file_id = f.id
            WHERE s.user_id = ?
            ORDER BY s.updated_at DESC
          `).bind(userId).all();

          // Get activation queue stats
          const queueStats = await c.env.DB.prepare(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM activation_queue aq
            JOIN segments s ON aq.segment_id = s.id
            WHERE s.user_id = ?
            AND aq.created_at > datetime('now', '-1 hour')
          `).bind(userId).first();

          const updateData = {
            type: 'segment_update',
            timestamp: new Date().toISOString(),
            segments: segments.results.map((segment: any) => ({
              id: segment.id,
              name: segment.name,
              fileName: segment.file_name,
              memberCount: segment.member_count || 0,
              lastProcessed: segment.last_processed,
              processingStatus: segment.processing_status,
              googleAdsEnabled: !!segment.google_ads_enabled,
              updatedAt: segment.updated_at
            })),
            queueStats: {
              total: queueStats?.total || 0,
              pending: queueStats?.pending || 0,
              completed: queueStats?.completed || 0,
              failed: queueStats?.failed || 0
            }
          };

          const message = `data: ${JSON.stringify(updateData)}\n\n`;
          controller.enqueue(encoder.encode(message));
          
        } catch (error) {
          console.error('Error sending SSE update:', error);
          
          const errorMessage = `data: ${JSON.stringify({
            type: 'error',
            timestamp: new Date().toISOString(),
            message: 'Failed to fetch segment updates'
          })}\n\n`;
          
          controller.enqueue(encoder.encode(errorMessage));
        }
      };

      // Send initial update
      await sendUpdate();
      
      // Set up interval for regular updates (every 10 seconds)
      const interval = setInterval(sendUpdate, 10000);
      
      // Set up heartbeat (every 30 seconds to keep connection alive)
      const heartbeat = setInterval(() => {
        const heartbeatMessage = `data: ${JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        })}\n\n`;
        
        try {
          controller.enqueue(encoder.encode(heartbeatMessage));
        } catch (error) {
          console.log('SSE connection closed during heartbeat');
          clearInterval(interval);
          clearInterval(heartbeat);
        }
      }, 30000);
      
      // Clean up on client disconnect
      c.req.raw.signal.addEventListener('abort', () => {
        console.log('SSE client disconnected');
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch (e) {
          // Connection already closed
        }
      });
    }
  });

  // Return SSE response with proper headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': c.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    }
  });
});

// Get processing statistics endpoint (for debugging)
realtime.get('/stats', async (c) => {
  try {
    const userId = c.get('userId');
    
    // Get segment processing stats
    const segmentStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_segments,
        SUM(member_count) as total_members,
        COUNT(CASE WHEN last_processed IS NOT NULL THEN 1 END) as processed_segments,
        COUNT(CASE WHEN google_ads_enabled = 1 THEN 1 END) as ads_enabled_segments,
        MIN(last_processed) as oldest_processing,
        MAX(last_processed) as newest_processing
      FROM segments 
      WHERE user_id = ?
    `).bind(userId).first();

    // Get activation queue stats
    const activationStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_activations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM activation_queue aq
      JOIN segments s ON aq.segment_id = s.id
      WHERE s.user_id = ?
      AND aq.created_at > datetime('now', '-24 hours')
    `).bind(userId).first();

    // Get CSV data stats
    const dataStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(DISTINCT cd.file_id) as files_with_data,
        COUNT(*) as total_csv_rows,
        COUNT(CASE WHEN cd.updated_at > datetime('now', '-1 hour') THEN 1 END) as recent_changes
      FROM csv_data cd
      JOIN files f ON cd.file_id = f.id
      WHERE f.user_id = ?
    `).bind(userId).first();

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        segments: {
          total: segmentStats?.total_segments || 0,
          processed: segmentStats?.processed_segments || 0,
          totalMembers: segmentStats?.total_members || 0,
          adsEnabled: segmentStats?.ads_enabled_segments || 0,
          oldestProcessing: segmentStats?.oldest_processing,
          newestProcessing: segmentStats?.newest_processing
        },
        activations: {
          total: activationStats?.total_activations || 0,
          pending: activationStats?.pending || 0,
          processing: activationStats?.processing || 0,
          completed: activationStats?.completed || 0,
          failed: activationStats?.failed || 0
        },
        data: {
          filesWithData: dataStats?.files_with_data || 0,
          totalRows: dataStats?.total_csv_rows || 0,
          recentChanges: dataStats?.recent_changes || 0
        }
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({ 
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default realtime;
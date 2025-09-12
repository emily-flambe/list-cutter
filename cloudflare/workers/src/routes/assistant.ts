/**
 * Assistant API routes for CuttyAssistant AutoRAG integration
 * 
 * This module provides API endpoints for the AutoRAG-powered chatbot,
 * including query processing, conversation management, and health checks.
 * All endpoints require authentication and include proper error handling.
 * 
 * @module AssistantRoutes
 * @author Cutty Assistant System
 * @version 1.0.0
 */

import { Hono } from 'hono';
import type { CloudflareEnv } from '../types/env';
import { CuttyAssistant } from '../autorag/CuttyAssistant';
import { AutoRAGError } from '../autorag/types';
import { verifyJWTWithErrors } from '../services/auth/jwt';

type Variables = {
  userId?: string;
  assistant?: CuttyAssistant;
};

const assistant = new Hono<{ Bindings: CloudflareEnv; Variables: Variables }>();

/**
 * Authentication middleware for assistant routes
 * 
 * Verifies JWT tokens and extracts user information for request context.
 * The /query endpoint is public, other endpoints require authentication.
 */
assistant.use('*', async (c, next) => {
  // Skip authentication for the query endpoint, health check, and test endpoint
  const path = new URL(c.req.url).pathname;
  if (path.endsWith('/query') || path.endsWith('/health') || path.endsWith('/test-autorag')) {
    // Initialize assistant instance for public access
    const assistantInstance = new CuttyAssistant(c.env);
    c.set('assistant', assistantInstance);
    
    // Set a generic user ID for anonymous users
    c.set('userId', 'anonymous');
    
    // Check if user provided optional authentication
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = await verifyJWTWithErrors(token, c.env.JWT_SECRET);
        if (payload && payload.token_type === 'access') {
          c.set('userId', payload.user_id);
        }
      } catch {
        // Ignore auth errors for public endpoints - continue as anonymous
      }
    }
    
    await next();
    return;
  }
  
  // For other endpoints, require authentication
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token'
      }, 401);
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyJWTWithErrors(token, c.env.JWT_SECRET);
    
    if (!payload || payload.token_type !== 'access') {
      return c.json({
        error: 'Invalid token',
        message: 'Please provide a valid access token'
      }, 401);
    }
    
    // Store user ID in context
    c.set('userId', payload.user_id);
    
    // Initialize assistant instance
    const assistantInstance = new CuttyAssistant(c.env);
    c.set('assistant', assistantInstance);
    
    await next();
    
  } catch (error) {
    console.error('Assistant authentication error:', error);
    return c.json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Invalid token'
    }, 401);
  }
});

/**
 * Rate limiting middleware for assistant endpoints
 * 
 * Implements per-user rate limiting to prevent abuse of the AutoRAG service.
 * Anonymous users get stricter rate limits.
 */
assistant.use('*', async (c, next) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'User ID not found' }, 401);
  }
  
  try {
    // Check rate limit using KV storage
    if (c.env.AUTH_KV) {
      // Use IP address for anonymous users to prevent abuse
      let rateLimitIdentifier = userId;
      let maxRequests = 30; // Authenticated users get 30 requests per minute
      
      if (userId === 'anonymous') {
        // For anonymous users, use IP address for rate limiting
        const clientIP = c.req.header('CF-Connecting-IP') || 
                        c.req.header('X-Forwarded-For') || 
                        'unknown-ip';
        rateLimitIdentifier = `anonymous:${clientIP}`;
        maxRequests = 10; // Anonymous users get fewer requests
      }
      
      const rateLimitKey = `assistant_rate_limit:${rateLimitIdentifier}`;
      const currentMinute = Math.floor(Date.now() / 60000);
      const rateLimitData = await c.env.AUTH_KV.get(rateLimitKey);
      
      let requestCount = 1;
      let lastMinute = currentMinute;
      
      if (rateLimitData) {
        const parsed = JSON.parse(rateLimitData);
        lastMinute = parsed.minute;
        requestCount = parsed.minute === currentMinute ? parsed.count + 1 : 1;
      }
      
      // Check rate limit
      if (requestCount > maxRequests && lastMinute === currentMinute) {
        return c.json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please wait a minute before trying again.',
          retry_after: 60
        }, 429);
      }
      
      // Update rate limit counter
      await c.env.AUTH_KV.put(
        rateLimitKey,
        JSON.stringify({ minute: currentMinute, count: requestCount }),
        { expirationTtl: 120 } // Keep for 2 minutes
      );
    }
    
    await next();
    
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Continue on rate limiting errors to not block requests
    await next();
  }
});

/**
 * POST /query - Process user query with AutoRAG
 * 
 * Main endpoint for processing user questions. Returns enhanced responses
 * with intent analysis, sources, and action suggestions.
 * 
 * Request body:
 * {
 *   "query": "How do I upload a CSV file?",
 *   "conversation_id": "optional-conversation-id"
 * }
 * 
 * Response:
 * {
 *   "answer": "To upload a CSV file...",
 *   "intent": { "intent": "how_to", "confidence": 0.9 },
 *   "sources": [...],
 *   "actions": [...],
 *   "conversation_id": "conv_123",
 *   "metadata": { "response_time_ms": 1234 }
 * }
 */
assistant.post('/query', async (c) => {
  const startTime = Date.now();
  
  try {
    const assistantInstance = c.get('assistant');
    const userId = c.get('userId');
    
    if (!assistantInstance || !userId) {
      return c.json({
        error: 'Service unavailable',
        message: 'Assistant service not properly initialized'
      }, 503);
    }
    
    // Parse request body
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.query !== 'string') {
      return c.json({
        error: 'Invalid request',
        message: 'Request body must include a "query" field with string value'
      }, 400);
    }
    
    const { query, conversation_id } = body;
    
    // Validate query length
    if (query.trim().length === 0) {
      return c.json({
        error: 'Invalid query',
        message: 'Query cannot be empty'
      }, 400);
    }
    
    if (query.length > 1000) {
      return c.json({
        error: 'Query too long',
        message: 'Query must be less than 1000 characters'
      }, 400);
    }
    
    // Process query with assistant
    const response = await assistantInstance.processQuery(query, userId, conversation_id);
    
    // Add response timing
    response.metadata.response_time_ms = Date.now() - startTime;
    
    return c.json(response);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('Assistant query processing error:', error);
    
    if (error instanceof AutoRAGError) {
      return c.json({
        error: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
        metadata: { response_time_ms: responseTime }
      }, error.status || 500);
    }
    
    return c.json({
      error: 'Processing failed',
      message: 'Failed to process your query. Please try again.',
      metadata: { response_time_ms: responseTime }
    }, 500);
  }
});

/**
 * GET /conversations/:id - Get conversation history
 * 
 * Retrieves the conversation history for a specific conversation ID.
 * Users can only access their own conversations.
 * 
 * Response:
 * {
 *   "conversation_id": "conv_123",
 *   "user_id": "user_456",
 *   "messages": [...],
 *   "created_at": "2024-01-01T00:00:00Z",
 *   "last_activity": "2024-01-01T01:00:00Z"
 * }
 */
assistant.get('/conversations/:id', async (c) => {
  try {
    const assistantInstance = c.get('assistant');
    const userId = c.get('userId');
    const conversationId = c.req.param('id');
    
    if (!assistantInstance || !userId) {
      return c.json({
        error: 'Service unavailable',
        message: 'Assistant service not properly initialized'
      }, 503);
    }
    
    if (!conversationId) {
      return c.json({
        error: 'Invalid request',
        message: 'Conversation ID is required'
      }, 400);
    }
    
    const conversation = await assistantInstance.getConversationHistory(conversationId);
    
    if (!conversation) {
      return c.json({
        error: 'Not found',
        message: 'Conversation not found'
      }, 404);
    }
    
    // Ensure user can only access their own conversations
    if (conversation.user_id !== userId) {
      return c.json({
        error: 'Forbidden',
        message: 'You can only access your own conversations'
      }, 403);
    }
    
    return c.json(conversation);
    
  } catch (error) {
    console.error('Get conversation error:', error);
    return c.json({
      error: 'Retrieval failed',
      message: 'Failed to retrieve conversation history'
    }, 500);
  }
});

/**
 * DELETE /conversations/:id - Clear conversation history
 * 
 * Clears the conversation history for a specific conversation ID.
 * Users can only clear their own conversations.
 * 
 * Response:
 * {
 *   "message": "Conversation cleared successfully"
 * }
 */
assistant.delete('/conversations/:id', async (c) => {
  try {
    const assistantInstance = c.get('assistant');
    const userId = c.get('userId');
    const conversationId = c.req.param('id');
    
    if (!assistantInstance || !userId) {
      return c.json({
        error: 'Service unavailable',
        message: 'Assistant service not properly initialized'
      }, 503);
    }
    
    if (!conversationId) {
      return c.json({
        error: 'Invalid request',
        message: 'Conversation ID is required'
      }, 400);
    }
    
    // Check if conversation exists and belongs to user
    const conversation = await assistantInstance.getConversationHistory(conversationId);
    if (conversation && conversation.user_id !== userId) {
      return c.json({
        error: 'Forbidden',
        message: 'You can only clear your own conversations'
      }, 403);
    }
    
    await assistantInstance.clearConversation(conversationId);
    
    return c.json({
      message: 'Conversation cleared successfully'
    });
    
  } catch (error) {
    console.error('Clear conversation error:', error);
    
    if (error instanceof AutoRAGError) {
      return c.json({
        error: error.code,
        message: error.message
      }, error.status || 500);
    }
    
    return c.json({
      error: 'Clear failed',
      message: 'Failed to clear conversation history'
    }, 500);
  }
});

/**
 * GET /health - Health check for assistant service
 * 
 * Checks the health status of the AutoRAG service and returns
 * configuration information and latency metrics.
 * 
 * Response:
 * {
 *   "status": "healthy",
 *   "config": { "instance_name": "cutty-autorag", ... },
 *   "latency_ms": 123,
 *   "timestamp": "2024-01-01T00:00:00Z"
 * }
 */
assistant.get('/health', async (c) => {
  try {
    const assistantInstance = c.get('assistant');
    
    if (!assistantInstance) {
      return c.json({
        status: 'unhealthy',
        error: 'Assistant service not initialized',
        timestamp: new Date().toISOString()
      }, 503);
    }
    
    const healthStatus = await assistantInstance.healthCheck();
    
    return c.json({
      ...healthStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Assistant health check error:', error);
    return c.json({
      status: 'unhealthy',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * GET /config - Get assistant configuration (admin only)
 * 
 * Returns the current assistant configuration. Requires admin privileges.
 * 
 * Response:
 * {
 *   "instance_name": "cutty-autorag",
 *   "timeout_ms": 30000,
 *   "max_sources": 5,
 *   "rate_limit": { ... }
 * }
 */
assistant.get('/config', async (c) => {
  try {
    const assistantInstance = c.get('assistant');
    const userId = c.get('userId');
    
    if (!assistantInstance || !userId) {
      return c.json({
        error: 'Service unavailable',
        message: 'Assistant service not properly initialized'
      }, 503);
    }
    
    // Check if user is admin (simplified check - in production, check user role)
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({
        error: 'Forbidden',
        message: 'Admin access required'
      }, 403);
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyJWTWithErrors(token, c.env.JWT_SECRET);
    
    if (!payload || payload.role !== 'admin') {
      return c.json({
        error: 'Forbidden',
        message: 'Admin access required'
      }, 403);
    }
    
    // Return configuration (excluding sensitive data)
    return c.json({
      instance_name: c.env.AUTORAG_INSTANCE_NAME,
      timeout_ms: parseInt(c.env.AUTORAG_TIMEOUT_MS || '30000'),
      max_sources: parseInt(c.env.AUTORAG_MAX_SOURCES || '5'),
      min_confidence_threshold: parseFloat(c.env.AUTORAG_MIN_CONFIDENCE || '0.3'),
      rate_limit: {
        requests_per_minute: parseInt(c.env.AUTORAG_RATE_LIMIT || '60'),
        burst_limit: parseInt(c.env.AUTORAG_BURST_LIMIT || '10')
      }
    });
    
  } catch (error) {
    console.error('Get config error:', error);
    return c.json({
      error: 'Configuration retrieval failed',
      message: 'Failed to retrieve assistant configuration'
    }, 500);
  }
});

/**
 * POST /feedback - Submit feedback on assistant response
 * 
 * Allows users to provide feedback on assistant responses for
 * quality improvement and analytics.
 * 
 * Request body:
 * {
 *   "conversation_id": "conv_123",
 *   "message_id": "msg_456",
 *   "rating": 5,
 *   "comment": "Very helpful response"
 * }
 * 
 * Response:
 * {
 *   "message": "Feedback submitted successfully"
 * }
 */
assistant.post('/feedback', async (c) => {
  try {
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({
        error: 'Authentication required',
        message: 'User ID not found'
      }, 401);
    }
    
    const body = await c.req.json().catch(() => null);
    if (!body) {
      return c.json({
        error: 'Invalid request',
        message: 'Request body is required'
      }, 400);
    }
    
    const { conversation_id, message_id, rating, comment } = body;
    
    // Validate required fields
    if (!conversation_id || !message_id || typeof rating !== 'number') {
      return c.json({
        error: 'Invalid request',
        message: 'conversation_id, message_id, and rating are required'
      }, 400);
    }
    
    // Validate rating range
    if (rating < 1 || rating > 5) {
      return c.json({
        error: 'Invalid rating',
        message: 'Rating must be between 1 and 5'
      }, 400);
    }
    
    // Store feedback in KV storage
    if (c.env.CUTTY_SECURITY_METRICS) {
      const feedbackId = crypto.randomUUID();
      const feedback = {
        feedback_id: feedbackId,
        user_id: userId,
        conversation_id,
        message_id,
        rating,
        comment: comment || null,
        timestamp: new Date().toISOString()
      };
      
      await c.env.CUTTY_SECURITY_METRICS.put(
        `assistant_feedback:${feedbackId}`,
        JSON.stringify(feedback),
        { expirationTtl: 2592000 } // Keep for 30 days
      );
    }
    
    return c.json({
      message: 'Feedback submitted successfully'
    });
    
  } catch (error) {
    console.error('Submit feedback error:', error);
    return c.json({
      error: 'Feedback submission failed',
      message: 'Failed to submit feedback'
    }, 500);
  }
});

/**
 * GET /test-autorag - Simple AutoRAG test endpoint
 * 
 * Tests the simplest possible AutoRAG call as suggested by Cloudflare docs
 */
assistant.get('/test-autorag', async (c) => {
  try {
    // Simplest possible AutoRAG call per Cloudflare docs
    const answer = await c.env.AI.autorag("cutty-rag").aiSearch({
      query: "hello"
    });
    
    return c.json({
      success: true,
      raw_response: answer,
      message: 'Direct AutoRAG test'
    });
  } catch (error) {
    console.error('AutoRAG test error:', error);
    return c.json({
      success: false,
      error: error.message,
      stack: error.stack,
      name: error.name
    }, 500);
  }
});

export default assistant;
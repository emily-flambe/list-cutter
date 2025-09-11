/**
 * CuttyAssistant - AutoRAG-powered chatbot for Cutty application
 * 
 * This class provides intelligent documentation assistance and action suggestions
 * using Cloudflare AutoRAG. It integrates with the Cutty application to provide
 * contextual help, troubleshooting, and guidance for users.
 * 
 * @module CuttyAssistant
 * @author Cutty Assistant System
 * @version 1.0.0
 */

import {
  AutoRAGRequest,
  AutoRAGResponse,
  ProcessedResponse,
  ConversationContext,
  ConversationMessage,
  AutoRAGConfig,
  QueryMetrics,
  AutoRAGError,
  AutoRAGTimeoutError,
  AutoRAGRateLimitError,
  IntentDetectionError
} from './types';

import {
  analyzeIntent,
  generateActionSuggestions,
  processSources,
  validateAutoRAGRequest,
  formatResponse,
  sanitizeInput,
  generateConversationId
} from './utils';

import type { CloudflareEnv } from '../types/env';

/**
 * Main CuttyAssistant class for AutoRAG integration
 * 
 * Provides intelligent chat functionality with documentation lookup,
 * intent detection, and action suggestions for the Cutty application.
 */
export class CuttyAssistant {
  private config: AutoRAGConfig;
  private env: CloudflareEnv;
  private conversationCache: Map<string, ConversationContext> = new Map();
  
  constructor(env: CloudflareEnv) {
    this.env = env;
    this.config = this.initializeConfig();
  }
  
  /**
   * Initialize AutoRAG configuration from environment
   * 
   * @returns AutoRAG configuration object
   * @throws {Error} When required environment variables are missing
   */
  private initializeConfig(): AutoRAGConfig {
    const instanceName = this.env.AUTORAG_INSTANCE_NAME;
    if (!instanceName) {
      throw new Error('AUTORAG_INSTANCE_NAME environment variable is required');
    }
    
    return {
      instance_name: instanceName,
      api_endpoint: `https://autorag.${instanceName}.workers.dev`,
      timeout_ms: parseInt(this.env.AUTORAG_TIMEOUT_MS || '30000'),
      max_sources: parseInt(this.env.AUTORAG_MAX_SOURCES || '5'),
      min_confidence_threshold: parseFloat(this.env.AUTORAG_MIN_CONFIDENCE || '0.3'),
      rate_limit: {
        requests_per_minute: parseInt(this.env.AUTORAG_RATE_LIMIT || '60'),
        burst_limit: parseInt(this.env.AUTORAG_BURST_LIMIT || '10')
      }
    };
  }
  
  /**
   * Process user query with AutoRAG and return enhanced response
   * 
   * Main entry point for processing user queries. Handles intent detection,
   * AutoRAG integration, source processing, and action suggestions.
   * 
   * @param query - User input query
   * @param userId - User identifier for tracking
   * @param conversationId - Optional conversation ID for context
   * @returns Enhanced response with actions and sources
   */
  async processQuery(
    query: string, 
    userId: string, 
    conversationId?: string
  ): Promise<ProcessedResponse> {
    const startTime = Date.now();
    
    try {
      // Sanitize and validate input
      const sanitizedQuery = sanitizeInput(query);
      if (!sanitizedQuery.trim()) {
        throw new AutoRAGError('Query cannot be empty', 'INVALID_INPUT', 400);
      }
      
      // Analyze intent
      const intent = analyzeIntent(sanitizedQuery);
      
      // Generate conversation ID if not provided
      const convId = conversationId || generateConversationId(userId);
      
      // Prepare AutoRAG request
      const autoragRequest: AutoRAGRequest = {
        question: sanitizedQuery,
        user_id: userId,
        conversation_id: convId,
        max_results: this.config.max_sources,
        threshold: this.config.min_confidence_threshold
      };
      
      // Validate request
      const validation = validateAutoRAGRequest(autoragRequest);
      if (!validation.isValid) {
        throw new AutoRAGError(
          `Invalid request: ${validation.errors.join(', ')}`,
          'VALIDATION_ERROR',
          400
        );
      }
      
      // Query AutoRAG
      const autoragResponse = await this.queryAutoRAG(autoragRequest);
      
      // Process sources
      const processedSources = processSources(autoragResponse.sources, this.config.max_sources);
      
      // Generate action suggestions
      const actions = generateActionSuggestions(sanitizedQuery, intent);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Store conversation context
      await this.updateConversationContext(convId, userId, sanitizedQuery, intent);
      
      // Record metrics
      await this.recordQueryMetrics({
        query_id: crypto.randomUUID(),
        user_id: userId,
        intent: intent.intent,
        response_time_ms: responseTime,
        source_count: processedSources.length,
        confidence_score: intent.confidence,
        timestamp: new Date().toISOString()
      });
      
      // Format and return response
      return formatResponse({
        answer: autoragResponse.answer,
        intent,
        sources: processedSources,
        actions,
        conversation_id: convId,
        metadata: {
          response_time_ms: responseTime,
          source_count: processedSources.length,
          confidence_score: intent.confidence
        }
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log error for debugging
      console.error('CuttyAssistant query processing error:', error);
      
      // Return error response
      if (error instanceof AutoRAGError) {
        throw error;
      }
      
      throw new AutoRAGError(
        'Failed to process query',
        'PROCESSING_ERROR',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
  
  /**
   * Query AutoRAG service using Workers AI binding
   * 
   * @param request - AutoRAG request object
   * @returns AutoRAG response
   * @throws {AutoRAGError} For API errors
   */
  private async queryAutoRAG(request: AutoRAGRequest): Promise<AutoRAGResponse> {
    try {
      // Check if AI binding is available
      if (!this.env.AI) {
        throw new AutoRAGError(
          'AI binding not configured. Please ensure [ai] is configured in wrangler.toml',
          'CONFIGURATION_ERROR',
          500
        );
      }
      
      // Use the Workers AI binding to query AutoRAG using aiSearch method
      // This searches the indexed documents and generates a response
      const response = await this.env.AI.autorag(this.config.instance_name).aiSearch({
        query: request.question
      });
      
      // Format response to match expected structure
      // AutoRAG returns 'response' for the answer and 'data' for sources
      const formattedResponse: AutoRAGResponse = {
        answer: response.response || 'I couldn\'t find a specific answer to your question. Please try rephrasing or ask a different question.',
        sources: response.data?.map((item: any) => ({
          filename: item.filename,
          title: item.attributes?.file?.title || item.filename,
          score: item.score,
          content: item.content?.map((c: any) => c.text).join('\n').substring(0, 500) || '',
          metadata: item.attributes
        })) || [],
        confidence: response.data?.[0]?.score || 0,
        metadata: {
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          tokens: 0,
          cached: false,
          responseTime: 0 // Will be calculated by the calling method
        }
      };
      
      // Validate response structure
      if (!formattedResponse.answer) {
        throw new AutoRAGError(
          'AutoRAG returned an empty response',
          'EMPTY_RESPONSE',
          502
        );
      }
      
      return formattedResponse;
      
    } catch (error) {
      // Handle specific error types
      if (error instanceof AutoRAGError) {
        throw error;
      }
      
      // Log the error for debugging
      console.error('AutoRAG query error:', error);
      
      // Throw a generic AutoRAG error
      throw new AutoRAGError(
        'Failed to query AutoRAG service',
        'AUTORAG_ERROR',
        503,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
  
  /**
   * Update conversation context with new message
   * 
   * @param conversationId - Conversation identifier
   * @param userId - User identifier
   * @param query - User query
   * @param intent - Analyzed intent
   */
  private async updateConversationContext(
    conversationId: string,
    userId: string,
    query: string,
    intent: any
  ): Promise<void> {
    try {
      let context = this.conversationCache.get(conversationId);
      
      if (!context) {
        context = {
          conversation_id: conversationId,
          user_id: userId,
          messages: [],
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          metadata: {
            session_type: this.determineSessionType(intent.intent),
            feature_context: this.extractFeatureContext(query)
          }
        };
      }
      
      // Add user message
      const message: ConversationMessage = {
        message_id: crypto.randomUUID(),
        role: 'user',
        content: query,
        timestamp: new Date().toISOString(),
        metadata: {
          intent: intent.intent,
          confidence: intent.confidence
        }
      };
      
      context.messages.push(message);
      context.last_activity = new Date().toISOString();
      
      // Keep only last 10 messages to manage memory
      if (context.messages.length > 10) {
        context.messages = context.messages.slice(-10);
      }
      
      this.conversationCache.set(conversationId, context);
      
      // Optionally persist to KV storage for longer-term storage
      if (this.env.AUTH_KV) {
        await this.env.AUTH_KV.put(
          `conversation:${conversationId}`,
          JSON.stringify(context),
          { expirationTtl: 86400 } // 24 hours
        );
      }
      
    } catch (error) {
      console.error('Failed to update conversation context:', error);
      // Non-critical error, don't throw
    }
  }
  
  /**
   * Determine session type based on intent
   * 
   * @param intent - Query intent
   * @returns Session type classification
   */
  private determineSessionType(intent: string): 'documentation' | 'support' | 'onboarding' {
    switch (intent) {
      case 'documentation':
      case 'api_usage':
        return 'documentation';
      case 'troubleshooting':
        return 'support';
      case 'how_to':
        return 'onboarding';
      default:
        return 'documentation';
    }
  }
  
  /**
   * Extract feature context from query
   * 
   * @param query - User query
   * @returns Feature context if detected
   */
  private extractFeatureContext(query: string): string | undefined {
    const features = ['files', 'segments', 'analytics', 'upload', 'filter', 'dashboard'];
    const normalizedQuery = query.toLowerCase();
    
    for (const feature of features) {
      if (normalizedQuery.includes(feature)) {
        return feature;
      }
    }
    
    return undefined;
  }
  
  /**
   * Record query metrics for analytics
   * 
   * @param metrics - Query metrics to record
   */
  private async recordQueryMetrics(metrics: QueryMetrics): Promise<void> {
    try {
      if (this.env.CUTTY_SECURITY_METRICS) {
        const key = `query_metrics:${metrics.query_id}`;
        await this.env.CUTTY_SECURITY_METRICS.put(key, JSON.stringify(metrics), {
          expirationTtl: 604800 // 7 days
        });
      }
    } catch (error) {
      console.error('Failed to record query metrics:', error);
      // Non-critical error, don't throw
    }
  }
  
  /**
   * Get conversation history for a user
   * 
   * @param conversationId - Conversation identifier
   * @returns Conversation context or null if not found
   */
  async getConversationHistory(conversationId: string): Promise<ConversationContext | null> {
    try {
      // Check cache first
      let context = this.conversationCache.get(conversationId);
      
      if (!context && this.env.AUTH_KV) {
        // Try to load from KV storage
        const stored = await this.env.AUTH_KV.get(`conversation:${conversationId}`);
        if (stored) {
          context = JSON.parse(stored);
          this.conversationCache.set(conversationId, context);
        }
      }
      
      return context || null;
      
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return null;
    }
  }
  
  /**
   * Clear conversation history
   * 
   * @param conversationId - Conversation identifier
   */
  async clearConversation(conversationId: string): Promise<void> {
    try {
      this.conversationCache.delete(conversationId);
      
      if (this.env.AUTH_KV) {
        await this.env.AUTH_KV.delete(`conversation:${conversationId}`);
      }
      
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      throw new AutoRAGError('Failed to clear conversation', 'STORAGE_ERROR', 500);
    }
  }
  
  /**
   * Health check for AutoRAG service
   * 
   * @returns Health status and configuration info
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    config: Partial<AutoRAGConfig>;
    latency_ms?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const testRequest: AutoRAGRequest = {
        question: 'health check',
        user_id: 'system',
        max_results: 1,
        threshold: 0.1
      };
      
      await this.queryAutoRAG(testRequest);
      
      const latency = Date.now() - startTime;
      
      return {
        status: latency < 5000 ? 'healthy' : 'degraded',
        config: {
          instance_name: this.config.instance_name,
          timeout_ms: this.config.timeout_ms,
          max_sources: this.config.max_sources
        },
        latency_ms: latency
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        config: {
          instance_name: this.config.instance_name,
          timeout_ms: this.config.timeout_ms,
          max_sources: this.config.max_sources
        }
      };
    }
  }
}
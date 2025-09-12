/**
 * TypeScript definitions for CuttyAssistant AutoRAG integration
 * 
 * This module defines types for the AutoRAG chatbot system that provides
 * documentation assistance and action suggestions for the Cutty application.
 * 
 * @module AutoRAGTypes
 * @author Cutty Assistant System
 * @version 1.0.0
 */

// Core AutoRAG Request/Response Types
export interface AutoRAGRequest {
  question: string;
  conversation_id?: string;
  user_id: string;
  max_results?: number;
  threshold?: number;
}

export interface AutoRAGResponse {
  answer: string;
  sources: AutoRAGSource[];
  conversation_id: string;
  confidence?: number;
  processing_time_ms?: number;
}

export interface AutoRAGSource {
  content: string;
  metadata: {
    title?: string;
    url?: string;
    section?: string;
    relevance_score: number;
    document_type?: 'documentation' | 'api' | 'guide' | 'example';
  };
}

// Intent Detection Types
export type QueryIntent = 
  | 'documentation'
  | 'feature_request'
  | 'troubleshooting'
  | 'how_to'
  | 'api_usage'
  | 'general_question';

export interface IntentAnalysis {
  intent: QueryIntent;
  confidence: number;
  keywords: string[];
  context_type: 'technical' | 'business' | 'general';
  action_required: boolean;
}

// Action Suggestion Types
export interface ActionSuggestion {
  type: 'navigate' | 'create' | 'edit' | 'view' | 'search';
  description: string;
  target?: string;
  parameters?: Record<string, unknown>;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
}

export interface ProcessedResponse {
  answer: string;
  intent: IntentAnalysis;
  sources: ProcessedSource[];
  actions: ActionSuggestion[];
  conversation_id: string;
  metadata: {
    response_time_ms: number;
    source_count: number;
    confidence_score: number;
  };
}

export interface ProcessedSource {
  content: string;
  title: string;
  url?: string;
  section?: string;
  relevance_score: number;
  document_type: 'documentation' | 'api' | 'guide' | 'example';
  summary?: string;
}

// Conversation Management Types
export interface ConversationContext {
  conversation_id: string;
  user_id: string;
  messages: ConversationMessage[];
  created_at: string;
  last_activity: string;
  metadata: {
    session_type: 'documentation' | 'support' | 'onboarding';
    user_role?: 'admin' | 'user';
    feature_context?: string;
  };
}

export interface ConversationMessage {
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: QueryIntent;
    sources_count?: number;
    actions_count?: number;
    confidence?: number;
  };
}

// Configuration Types
export interface AutoRAGConfig {
  instance_name: string;
  api_endpoint: string;
  timeout_ms: number;
  max_sources: number;
  min_confidence_threshold: number;
  rate_limit: {
    requests_per_minute: number;
    burst_limit: number;
  };
}

// Error Types
export class AutoRAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AutoRAGError';
  }
}

export class IntentDetectionError extends AutoRAGError {
  constructor(message: string, details?: unknown) {
    super(message, 'INTENT_DETECTION_ERROR', 500, details);
    this.name = 'IntentDetectionError';
  }
}

export class AutoRAGTimeoutError extends AutoRAGError {
  constructor(timeoutMs: number) {
    super(`AutoRAG request timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR', 408);
    this.name = 'AutoRAGTimeoutError';
  }
}

export class AutoRAGRateLimitError extends AutoRAGError {
  constructor(resetTime?: number) {
    super('AutoRAG rate limit exceeded', 'RATE_LIMIT_ERROR', 429, { resetTime });
    this.name = 'AutoRAGRateLimitError';
  }
}

// Request/Response Validation Types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Analytics and Metrics Types
export interface QueryMetrics {
  query_id: string;
  user_id: string;
  intent: QueryIntent;
  response_time_ms: number;
  source_count: number;
  confidence_score: number;
  user_satisfaction?: number;
  timestamp: string;
}

export interface UsageStats {
  total_queries: number;
  unique_users: number;
  avg_response_time_ms: number;
  intent_distribution: Record<QueryIntent, number>;
  top_queries: Array<{
    query: string;
    count: number;
    avg_confidence: number;
  }>;
  period: {
    start: string;
    end: string;
  };
}
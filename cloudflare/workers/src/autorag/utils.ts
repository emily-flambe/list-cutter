/**
 * Utility functions for CuttyAssistant AutoRAG integration
 * 
 * This module provides helper functions for intent detection, source processing,
 * action suggestions, and response formatting for the AutoRAG chatbot system.
 * 
 * @module AutoRAGUtils
 * @author Cutty Assistant System
 * @version 1.0.0
 */

import { 
  QueryIntent, 
  IntentAnalysis, 
  ActionSuggestion, 
  ProcessedSource, 
  AutoRAGSource,
  ValidationResult,
  AutoRAGRequest,
  ProcessedResponse
} from './types';

// Intent Detection Keywords and Patterns
const INTENT_KEYWORDS: Record<QueryIntent, string[]> = {
  documentation: [
    'how to', 'documentation', 'docs', 'guide', 'manual', 'reference',
    'explain', 'what is', 'definition', 'overview', 'introduction'
  ],
  feature_request: [
    'feature', 'add', 'implement', 'create', 'build', 'new functionality',
    'enhancement', 'improvement', 'can you add', 'would like', 'need'
  ],
  troubleshooting: [
    'error', 'bug', 'issue', 'problem', 'not working', 'broken',
    'fix', 'troubleshoot', 'debug', 'help', 'wrong', 'failed'
  ],
  how_to: [
    'how do i', 'how can i', 'tutorial', 'step by step', 'walkthrough',
    'process', 'procedure', 'steps', 'instructions', 'guide me'
  ],
  api_usage: [
    'api', 'endpoint', 'request', 'response', 'authentication', 'auth',
    'parameter', 'payload', 'curl', 'postman', 'integration'
  ],
  general_question: [
    'what', 'when', 'where', 'why', 'general', 'about', 'information'
  ]
};

// Cutty-specific action patterns
const ACTION_PATTERNS = {
  navigate: {
    keywords: ['go to', 'navigate', 'show me', 'open', 'view', 'display'],
    targets: ['dashboard', 'files', 'segments', 'settings', 'profile']
  },
  create: {
    keywords: ['create', 'new', 'add', 'make', 'generate', 'upload'],
    targets: ['file', 'segment', 'filter', 'analysis', 'report']
  },
  edit: {
    keywords: ['edit', 'modify', 'change', 'update', 'configure'],
    targets: ['file', 'segment', 'settings', 'profile', 'data']
  },
  view: {
    keywords: ['view', 'see', 'show', 'display', 'list', 'browse'],
    targets: ['files', 'segments', 'analytics', 'history', 'results']
  },
  search: {
    keywords: ['find', 'search', 'look for', 'filter', 'query'],
    targets: ['files', 'data', 'segments', 'records', 'analytics']
  }
};

/**
 * Analyze user query to determine intent and context
 * 
 * Uses keyword matching and pattern analysis to classify user queries
 * into intent categories with confidence scoring.
 * 
 * @param query - User input query to analyze
 * @returns Intent analysis with confidence and context
 */
export function analyzeIntent(query: string): IntentAnalysis {
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);
  
  const intentScores: Record<QueryIntent, number> = {
    documentation: 0,
    feature_request: 0,
    troubleshooting: 0,
    how_to: 0,
    api_usage: 0,
    general_question: 0
  };
  
  // Calculate scores based on keyword matches
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        intentScores[intent as QueryIntent] += 1;
        
        // Boost score for exact phrase matches
        if (keyword.includes(' ') && normalizedQuery.includes(keyword)) {
          intentScores[intent as QueryIntent] += 0.5;
        }
      }
    }
  }
  
  // Special patterns for higher confidence
  if (normalizedQuery.startsWith('how to') || normalizedQuery.startsWith('how do i')) {
    intentScores.how_to += 2;
  }
  
  if (normalizedQuery.includes('api') && (normalizedQuery.includes('endpoint') || normalizedQuery.includes('request'))) {
    intentScores.api_usage += 2;
  }
  
  if (normalizedQuery.includes('error') || normalizedQuery.includes('not working')) {
    intentScores.troubleshooting += 2;
  }
  
  // Determine primary intent
  const topIntent = Object.entries(intentScores).reduce((a, b) => 
    intentScores[a[0] as QueryIntent] > intentScores[b[0] as QueryIntent] ? a : b
  )[0] as QueryIntent;
  
  const topScore = intentScores[topIntent];
  const totalWords = words.length;
  
  // Calculate confidence (0-1)
  const confidence = Math.min(topScore / Math.max(totalWords * 0.3, 1), 1);
  
  // Extract relevant keywords
  const extractedKeywords = words.filter(word => 
    word.length > 3 && 
    !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'have', 'more'].includes(word)
  );
  
  // Determine context type
  let contextType: 'technical' | 'business' | 'general' = 'general';
  const technicalTerms = ['api', 'database', 'query', 'endpoint', 'authentication', 'json', 'csv'];
  const businessTerms = ['segment', 'analysis', 'report', 'dashboard', 'data', 'filter'];
  
  if (technicalTerms.some(term => normalizedQuery.includes(term))) {
    contextType = 'technical';
  } else if (businessTerms.some(term => normalizedQuery.includes(term))) {
    contextType = 'business';
  }
  
  // Determine if action is required
  const actionRequired = ['feature_request', 'troubleshooting'].includes(topIntent) || 
                        confidence > 0.7 && ['how_to'].includes(topIntent);
  
  return {
    intent: topIntent,
    confidence,
    keywords: extractedKeywords,
    context_type: contextType,
    action_required: actionRequired
  };
}

/**
 * Generate action suggestions based on query intent and content
 * 
 * Analyzes the user query and intent to suggest specific actions
 * that could be taken within the Cutty application.
 * 
 * @param query - User input query
 * @param intent - Analyzed intent from query
 * @returns Array of suggested actions with priorities
 */
export function generateActionSuggestions(query: string, intent: IntentAnalysis): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = [];
  const normalizedQuery = query.toLowerCase();
  
  // Navigation suggestions
  for (const [action, pattern] of Object.entries(ACTION_PATTERNS)) {
    for (const keyword of pattern.keywords) {
      if (normalizedQuery.includes(keyword)) {
        for (const target of pattern.targets) {
          if (normalizedQuery.includes(target) || intent.keywords.includes(target)) {
            suggestions.push({
              type: action as any,
              description: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} ${target}`,
              target: `/${target}`,
              confidence: 0.8,
              priority: 'high'
            });
          }
        }
      }
    }
  }
  
  // Intent-specific suggestions
  switch (intent.intent) {
    case 'how_to':
      if (normalizedQuery.includes('upload') || normalizedQuery.includes('file')) {
        suggestions.push({
          type: 'navigate',
          description: 'Go to file upload page',
          target: '/files/upload',
          confidence: 0.9,
          priority: 'high'
        });
      }
      if (normalizedQuery.includes('segment') || normalizedQuery.includes('filter')) {
        suggestions.push({
          type: 'navigate',
          description: 'Create new segment',
          target: '/segments/create',
          confidence: 0.85,
          priority: 'high'
        });
      }
      break;
      
    case 'troubleshooting':
      suggestions.push({
        type: 'view',
        description: 'Check system status and logs',
        target: '/admin/logs',
        confidence: 0.7,
        priority: 'medium'
      });
      break;
      
    case 'api_usage':
      suggestions.push({
        type: 'view',
        description: 'View API documentation',
        target: '/docs/api',
        confidence: 0.9,
        priority: 'high'
      });
      break;
      
    case 'feature_request':
      suggestions.push({
        type: 'navigate',
        description: 'Submit feature request',
        target: '/feedback',
        confidence: 0.6,
        priority: 'low'
      });
      break;
  }
  
  // Remove duplicates and sort by priority and confidence
  const uniqueSuggestions = suggestions.filter((suggestion, index, array) => 
    array.findIndex(s => s.target === suggestion.target && s.type === suggestion.type) === index
  );
  
  return uniqueSuggestions
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] - priorityOrder[a.priority]) || (b.confidence - a.confidence);
    })
    .slice(0, 5); // Limit to top 5 suggestions
}

/**
 * Process and enhance AutoRAG sources for better presentation
 * 
 * Takes raw AutoRAG sources and processes them for better user experience,
 * including content summarization and relevance scoring.
 * 
 * @param sources - Raw sources from AutoRAG response
 * @param maxSources - Maximum number of sources to return
 * @returns Processed sources with enhanced metadata
 */
export function processSources(sources: AutoRAGSource[], maxSources: number = 5): ProcessedSource[] {
  return sources
    .slice(0, maxSources)
    .map(source => {
      const metadata = source.metadata;
      const processedSource: ProcessedSource = {
        content: source.content,
        title: metadata.title || 'Documentation',
        url: metadata.url,
        section: metadata.section,
        relevance_score: metadata.relevance_score,
        document_type: metadata.document_type || 'documentation'
      };
      
      // Generate summary for longer content
      if (source.content.length > 200) {
        const sentences = source.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        processedSource.summary = sentences.slice(0, 2).join('. ') + '.';
      }
      
      return processedSource;
    })
    .sort((a, b) => b.relevance_score - a.relevance_score);
}

/**
 * Validate AutoRAG request parameters
 * 
 * Validates request structure and parameters to ensure they meet
 * AutoRAG API requirements and security constraints.
 * 
 * @param request - Request object to validate
 * @returns Validation result with errors if any
 */
export function validateAutoRAGRequest(request: Partial<AutoRAGRequest>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!request.question || typeof request.question !== 'string') {
    errors.push('Question is required and must be a string');
  } else if (request.question.trim().length === 0) {
    errors.push('Question cannot be empty');
  } else if (request.question.length > 1000) {
    errors.push('Question must be less than 1000 characters');
  }
  
  if (!request.user_id || typeof request.user_id !== 'string') {
    errors.push('User ID is required and must be a string');
  }
  
  // Optional field validation
  if (request.max_results !== undefined) {
    if (typeof request.max_results !== 'number' || request.max_results < 1 || request.max_results > 20) {
      errors.push('max_results must be a number between 1 and 20');
    }
  }
  
  if (request.threshold !== undefined) {
    if (typeof request.threshold !== 'number' || request.threshold < 0 || request.threshold > 1) {
      errors.push('threshold must be a number between 0 and 1');
    }
  }
  
  if (request.conversation_id !== undefined) {
    if (typeof request.conversation_id !== 'string' || request.conversation_id.length > 100) {
      errors.push('conversation_id must be a string with length <= 100');
    }
  }
  
  // Security warnings
  if (request.question && containsSensitiveInfo(request.question)) {
    warnings.push('Query may contain sensitive information');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if text contains potentially sensitive information
 * 
 * @param text - Text to analyze
 * @returns True if sensitive info detected
 */
function containsSensitiveInfo(text: string): boolean {
  const sensitivePatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email pattern
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card pattern
    /password|secret|key|token/i, // Sensitive keywords
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(text));
}

/**
 * Format response for consistent API output
 * 
 * Ensures all AutoRAG responses follow a consistent structure
 * with proper error handling and metadata.
 * 
 * @param response - Processed response data
 * @returns Formatted response object
 */
export function formatResponse(response: Partial<ProcessedResponse>): ProcessedResponse {
  return {
    answer: response.answer || 'I apologize, but I could not generate a response to your query.',
    intent: response.intent || {
      intent: 'general_question',
      confidence: 0,
      keywords: [],
      context_type: 'general',
      action_required: false
    },
    sources: response.sources || [],
    actions: response.actions || [],
    conversation_id: response.conversation_id || crypto.randomUUID(),
    metadata: {
      response_time_ms: response.metadata?.response_time_ms || 0,
      source_count: response.sources?.length || 0,
      confidence_score: response.intent?.confidence || 0,
      ...response.metadata
    }
  };
}

/**
 * Sanitize user input for security
 * 
 * Removes potentially dangerous content from user queries
 * while preserving the intent and meaning.
 * 
 * @param input - Raw user input
 * @returns Sanitized input string
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>'"]/g, '') // Remove HTML/script characters
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .slice(0, 1000); // Enforce length limit
}

/**
 * Generate conversation ID for session tracking
 * 
 * Creates a unique conversation identifier that includes
 * timestamp and user context for better tracking.
 * 
 * @param userId - User identifier
 * @returns Unique conversation ID
 */
export function generateConversationId(userId: string): string {
  const timestamp = Date.now().toString(36);
  const userHash = btoa(userId).slice(0, 8);
  const random = Math.random().toString(36).slice(2, 8);
  return `conv_${timestamp}_${userHash}_${random}`;
}
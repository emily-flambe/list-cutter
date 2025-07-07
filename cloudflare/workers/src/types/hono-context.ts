/**
 * Hono Context Extensions
 * Type definitions for custom context variables used throughout the application
 */

import { SecurityConfigManager } from '../config/security-config';
import { SecurityMonitorService } from '../services/security/security-monitor';
import { SecurityMetricsCollector } from '../services/security/metrics-collector';

// File-related types
export interface FileRecord {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  ownerId: string;
  uploadedAt: Date;
  path: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface FileAuthContext {
  fileId: string;
  userId: string;
  operation: string;
  authorized: boolean;
  role?: string;
  permissions?: string[];
  shareToken?: string;
  auditId?: string;
}

// User quota information
export interface UserQuotaInfo {
  userId: string;
  currentUsage: number;
  quotaLimit: number;
  percentageUsed: number;
  resetTime?: Date;
}

// Extend Hono's Variables interface to include our custom context variables
declare module 'hono' {
  interface ContextVariableMap {
    // Security services
    securityConfig?: SecurityConfigManager;
    securityMonitor?: SecurityMonitorService;
    securityMetrics?: SecurityMetricsCollector;
    
    // Authentication/Authorization
    userId?: string;
    userRole?: string;
    sessionId?: string;
    
    // File-related context
    fileAuth?: FileAuthContext;
    fileRecord?: FileRecord;
    
    // Quota information
    userQuota?: UserQuotaInfo;
    
    // Request context
    requestId?: string;
    correlationId?: string;
    operationId?: string;
    
    // Performance tracking
    startTime?: number;
    performanceMetrics?: Record<string, number>;
  }
}

export default {};
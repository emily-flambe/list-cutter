/**
 * R2 Disaster Recovery Failover Integration Example
 * 
 * This file demonstrates how to integrate the failover system into your application.
 * It shows how to replace direct R2 calls with failover-aware operations.
 */

import type { Env } from '../../types';
import { R2FailoverService } from '../storage/r2-failover';
import { DegradationHandler } from './degradation-handler';
import { HealthMonitor } from './health-monitor';
import { NotificationService } from './notification';
import { OperationQueue } from './operation-queue';

/**
 * Application-level failover service that coordinates all failover components
 */
export class FailoverCoordinator {
  private env: Env;
  private r2Service: R2FailoverService;
  private degradationHandler: DegradationHandler;
  private healthMonitor: HealthMonitor;
  private notificationService: NotificationService;
  private operationQueue: OperationQueue;
  private initialized: boolean = false;

  constructor(env: Env) {
    this.env = env;
    this.r2Service = new R2FailoverService(env);
    this.degradationHandler = new DegradationHandler(env);
    this.healthMonitor = new HealthMonitor(env);
    this.notificationService = new NotificationService(env);
    this.operationQueue = new OperationQueue(env);
  }

  /**
   * Initialize all failover services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing failover coordinator...');
      
      // Initialize services in order
      await this.degradationHandler.initialize();
      await this.r2Service.initialize();
      await this.healthMonitor.startMonitoring();
      
      this.initialized = true;
      console.log('Failover coordinator initialized successfully');
      
      // Record initialization event
      await this.healthMonitor.recordSystemEvent(
        'FAILOVER_SYSTEM_INITIALIZED',
        'FAILOVER',
        'SYSTEM',
        { timestamp: new Date().toISOString() },
        'INFO'
      );
    } catch (error) {
      console.error('Error initializing failover coordinator:', error);
      throw error;
    }
  }

  /**
   * Enhanced file upload with failover handling
   */
  async uploadFile(
    fileName: string,
    content: ArrayBuffer,
    userId?: number,
    options: {
      contentType?: string;
      priority?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<{
    success: boolean;
    fileName?: string;
    operationId?: string;
    queued?: boolean;
    error?: string;
  }> {
    await this.ensureInitialized();

    try {
      const result = await this.r2Service.saveFileToR2(fileName, content, {
        priority: options.priority || 5,
        metadata: {
          contentType: options.contentType,
          ...options.metadata
        }
      });

      if (result.success) {
        // Notify user of successful upload
        if (userId) {
          await this.notificationService.sendUserNotification(
            userId,
            'OPERATION_COMPLETED',
            `File ${fileName} uploaded successfully`,
            'INFO',
            { fileName, operation: 'upload' }
          );
        }

        return {
          success: true,
          fileName: result.data!
        };
      } else if (result.queued) {
        // Operation was queued - extract operation ID from error message
        // In a real implementation, you'd have a better way to get the operation ID
        return {
          success: false,
          queued: true,
          operationId: 'queued_operation_id', // Would be extracted from result
          error: 'Upload queued due to service degradation'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Upload failed'
        };
      }
    } catch (error) {
      console.error('Error in enhanced upload:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Enhanced file download with failover handling
   */
  async downloadFile(fileName: string): Promise<{
    success: boolean;
    data?: R2ObjectBody;
    error?: string;
    degraded?: boolean;
  }> {
    await this.ensureInitialized();

    try {
      const result = await this.r2Service.getFileFromR2(fileName);

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        degraded: result.degraded
      };
    } catch (error) {
      console.error('Error in enhanced download:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Enhanced file deletion with failover handling
   */
  async deleteFile(
    fileName: string,
    userId?: number
  ): Promise<{
    success: boolean;
    queued?: boolean;
    error?: string;
  }> {
    await this.ensureInitialized();

    try {
      const result = await this.r2Service.deleteFileFromR2(fileName);

      if (result.success) {
        // Notify user of successful deletion
        if (userId) {
          await this.notificationService.sendUserNotification(
            userId,
            'OPERATION_COMPLETED',
            `File ${fileName} deleted successfully`,
            'INFO',
            { fileName, operation: 'delete' }
          );
        }

        return { success: true };
      } else if (result.queued) {
        return {
          success: false,
          queued: true,
          error: 'Delete queued due to service degradation'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Delete failed'
        };
      }
    } catch (error) {
      console.error('Error in enhanced delete:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Check if system is in degraded mode
   */
  isDegraded(): boolean {
    return this.degradationHandler.isReadOnlyMode();
  }

  /**
   * Get system health summary
   */
  async getHealthSummary() {
    await this.ensureInitialized();
    return this.healthMonitor.getSystemHealthSummary();
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: number, unreadOnly: boolean = false) {
    await this.ensureInitialized();
    return this.notificationService.getUserNotifications(userId, { unreadOnly });
  }

  /**
   * Get operation queue status
   */
  async getQueueStatus() {
    await this.ensureInitialized();
    const queueSize = await this.operationQueue.getQueueSize();
    const pendingOps = await this.operationQueue.getOperationsByStatus('PENDING');
    const processingOps = await this.operationQueue.getOperationsByStatus('PROCESSING');
    
    return {
      total_size: queueSize,
      pending: pendingOps.length,
      processing: processingOps.length
    };
  }

  /**
   * Force service degradation (for testing)
   */
  async forceDegradation(serviceName: string, reason: string) {
    await this.ensureInitialized();
    await this.degradationHandler.enterDegradedMode(serviceName, reason);
  }

  /**
   * Force service recovery (for testing)
   */
  async forceRecovery(serviceName: string) {
    await this.ensureInitialized();
    await this.degradationHandler.exitDegradedMode(serviceName);
  }

  /**
   * Shutdown failover services
   */
  async shutdown() {
    try {
      this.healthMonitor.stopMonitoring();
      console.log('Failover coordinator shutdown complete');
    } catch (error) {
      console.error('Error during failover coordinator shutdown:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Example of how to integrate failover into existing route handlers
 */
export class FailoverIntegrationExamples {
  /**
   * Example: Enhanced file upload route
   */
  static async handleFileUpload(
    env: Env,
    fileName: string,
    content: ArrayBuffer,
    userId: number,
    contentType?: string
  ) {
    const coordinator = new FailoverCoordinator(env);
    
    const result = await coordinator.uploadFile(fileName, content, userId, {
      contentType,
      priority: 5 // Normal priority
    });

    if (result.success) {
      return {
        success: true,
        data: { fileName: result.fileName },
        message: 'File uploaded successfully'
      };
    } else if (result.queued) {
      return {
        success: false,
        error: 'Service temporarily unavailable. Your upload has been queued.',
        data: { operationId: result.operationId },
        code: 202 // Accepted but queued
      };
    } else {
      return {
        success: false,
        error: result.error || 'Upload failed',
        code: 500
      };
    }
  }

  /**
   * Example: Enhanced file download route
   */
  static async handleFileDownload(env: Env, fileName: string) {
    const coordinator = new FailoverCoordinator(env);
    
    const result = await coordinator.downloadFile(fileName);

    if (result.success) {
      return {
        success: true,
        data: result.data,
        warning: result.degraded ? 'Service operating in degraded mode' : undefined
      };
    } else {
      return {
        success: false,
        error: result.error || 'Download failed',
        code: result.degraded ? 503 : 500 // Service unavailable vs internal error
      };
    }
  }

  /**
   * Example: Health check endpoint
   */
  static async handleHealthCheck(env: Env) {
    const coordinator = new FailoverCoordinator(env);
    
    const [healthSummary, queueStatus] = await Promise.all([
      coordinator.getHealthSummary(),
      coordinator.getQueueStatus()
    ]);

    return {
      success: true,
      data: {
        health: healthSummary,
        queue: queueStatus,
        degraded: coordinator.isDegraded()
      }
    };
  }

  /**
   * Example: User dashboard with notifications
   */
  static async handleUserDashboard(env: Env, userId: number) {
    const coordinator = new FailoverCoordinator(env);
    
    const [notifications, healthSummary] = await Promise.all([
      coordinator.getUserNotifications(userId, true), // Only unread
      coordinator.getHealthSummary()
    ]);

    return {
      success: true,
      data: {
        notifications,
        system_status: healthSummary,
        degraded: coordinator.isDegraded()
      }
    };
  }
}

/**
 * Utility functions for failover integration
 */
export class FailoverUtils {
  /**
   * Create a failover-aware wrapper for any async operation
   */
  static createFailoverWrapper<T>(
    env: Env,
    operationName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ) {
    return async (): Promise<{
      success: boolean;
      data?: T;
      error?: string;
      degraded?: boolean;
    }> => {
      const degradationHandler = new DegradationHandler(env);
      await degradationHandler.initialize();
      
      const result = await degradationHandler.executeWithFailover(
        operationName,
        operation,
        fallback
      );

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        degraded: result.degraded
      };
    };
  }

  /**
   * Check if operation should be allowed in current service state
   */
  static async shouldAllowOperation(
    env: Env,
    operationType: 'read' | 'write',
    serviceName: string = 'R2_STORAGE'
  ): Promise<boolean> {
    try {
      const healthMonitor = new HealthMonitor(env);
      const status = await healthMonitor.getServiceStatus(serviceName);
      
      if (!status) {
        return false; // Service not found
      }

      if (status.status === 'OFFLINE') {
        return false; // Service is offline
      }

      if (operationType === 'write' && status.status === 'DEGRADED') {
        // In degraded mode, only allow reads
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking operation allowance:', error);
      return false; // Fail safe
    }
  }

  /**
   * Get user-friendly status message
   */
  static getStatusMessage(
    isDegraded: boolean,
    queueSize: number
  ): string {
    if (!isDegraded && queueSize === 0) {
      return 'All systems operational';
    } else if (isDegraded && queueSize > 0) {
      return `System running in degraded mode. ${queueSize} operations queued.`;
    } else if (isDegraded) {
      return 'System running in degraded mode. Some features may be limited.';
    } else if (queueSize > 0) {
      return `${queueSize} operations are queued for processing.`;
    }
    
    return 'System status unknown';
  }
}
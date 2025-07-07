import type { 
  Env, 
  ServiceStatus, 
  ServiceStatusRecord, 
  DegradationOptions, 
  FailoverResult,
  HealthMetrics,
  CircuitBreakerState
} from '../../types';
import { ApiError } from '../../middleware/error';
import { OperationQueue } from './operation-queue';

export class DegradationHandler {
  private env: Env;
  private operationQueue: OperationQueue;
  private readOnlyMode: boolean = false;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private healthMetrics: Map<string, HealthMetrics> = new Map();
  private degradationOptions: DegradationOptions;

  constructor(env: Env, options: DegradationOptions = {}) {
    this.env = env;
    this.operationQueue = new OperationQueue(env);
    this.degradationOptions = {
      enableReadOnlyMode: true,
      queueOperations: true,
      notifyUsers: true,
      enableCircuitBreaker: true,
      maxQueueSize: 1000,
      retryDelayMs: 1000,
      ...options
    };
  }

  /**
   * Initialize degradation handler
   */
  async initialize(): Promise<void> {
    try {
      // Initialize service status records
      await this.initializeServiceStatus();
      
      // Load circuit breaker states
      await this.loadCircuitBreakerStates();
      
      console.log('Degradation handler initialized');
    } catch (error) {
      console.error('Error initializing degradation handler:', error);
      throw error;
    }
  }

  /**
   * Execute operation with failover handling
   */
  async executeWithFailover<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<FailoverResult<T>> {
    const result: FailoverResult<T> = {
      success: false,
      degraded: false,
      queued: false
    };

    try {
      // Check if service is in read-only mode
      if (this.readOnlyMode && this.isWriteOperation(serviceName)) {
        result.error = 'System is in read-only mode due to service degradation';
        result.degraded = true;
        return result;
      }

      // Check circuit breaker
      const circuitState = await this.getCircuitBreakerState(serviceName);
      if (circuitState === 'OPEN') {
        result.error = 'Circuit breaker is open for this service';
        result.degraded = true;
        
        // Try fallback if available
        if (fallbackOperation) {
          try {
            result.data = await fallbackOperation();
            result.success = true;
            result.degraded = true;
            return result;
          } catch (fallbackError) {
            console.error('Fallback operation failed:', fallbackError);
          }
        }
        
        return result;
      }

      // Execute primary operation
      const startTime = Date.now();
      try {
        result.data = await operation();
        result.success = true;
        
        // Record success metrics
        await this.recordSuccess(serviceName, Date.now() - startTime);
        
        // Close circuit breaker if it was half-open
        if (circuitState === 'HALF_OPEN') {
          await this.closeCircuitBreaker(serviceName);
        }
        
        return result;
      } catch (error) {
        // Record failure metrics
        await this.recordFailure(serviceName, String(error), Date.now() - startTime);
        
        // Check if we should open circuit breaker
        await this.evaluateCircuitBreaker(serviceName);
        
        // Try fallback operation
        if (fallbackOperation) {
          try {
            result.data = await fallbackOperation();
            result.success = true;
            result.degraded = true;
            return result;
          } catch (fallbackError) {
            console.error('Fallback operation failed:', fallbackError);
          }
        }
        
        result.error = String(error);
        return result;
      }
    } catch (error) {
      result.error = String(error);
      return result;
    }
  }

  /**
   * Enter degraded mode
   */
  async enterDegradedMode(
    serviceName: string, 
    reason: string, 
    options: DegradationOptions = {}
  ): Promise<void> {
    try {
      console.log(`Entering degraded mode for ${serviceName}: ${reason}`);
      
      // Update service status
      await this.updateServiceStatus(serviceName, 'DEGRADED', reason);
      
      // Enable read-only mode if configured
      if (options.enableReadOnlyMode !== false) {
        this.readOnlyMode = true;
        console.log('Read-only mode enabled');
      }
      
      // Open circuit breaker if configured
      if (options.enableCircuitBreaker !== false) {
        await this.openCircuitBreaker(serviceName, reason);
      }
      
      // Notify users if configured
      if (options.notifyUsers !== false) {
        await this.notifyServiceDegradation(serviceName, reason);
      }
      
      // Record system event
      await this.recordSystemEvent(
        'SERVICE_DEGRADED',
        'FAILOVER',
        serviceName,
        { reason, degradationOptions: options }
      );
      
    } catch (error) {
      console.error('Error entering degraded mode:', error);
    }
  }

  /**
   * Exit degraded mode
   */
  async exitDegradedMode(serviceName: string): Promise<void> {
    try {
      console.log(`Exiting degraded mode for ${serviceName}`);
      
      // Update service status
      await this.updateServiceStatus(serviceName, 'HEALTHY');
      
      // Disable read-only mode if all services are healthy
      const allHealthy = await this.areAllServicesHealthy();
      if (allHealthy) {
        this.readOnlyMode = false;
        console.log('Read-only mode disabled');
      }
      
      // Close circuit breaker
      await this.closeCircuitBreaker(serviceName);
      
      // Notify users of recovery
      await this.notifyServiceRecovery(serviceName);
      
      // Record system event
      await this.recordSystemEvent(
        'SERVICE_RECOVERED',
        'FAILOVER',
        serviceName,
        { recoveredAt: new Date().toISOString() }
      );
      
    } catch (error) {
      console.error('Error exiting degraded mode:', error);
    }
  }

  /**
   * Queue operation for later processing
   */
  async queueOperation(
    operationType: string,
    payload: any,
    userId?: number,
    fileId?: string,
    priority: number = 5
  ): Promise<string> {
    try {
      const operationId = await this.operationQueue.enqueue(
        operationType as any,
        payload,
        { priority, userId, fileId }
      );
      
      // Notify user that operation was queued
      if (userId) {
        await this.notifyOperationQueued(userId, operationType, operationId);
      }
      
      return operationId;
    } catch (error) {
      console.error('Error queuing operation:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatusRecord | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM service_status WHERE service_name = ?
      `).bind(serviceName).first();
      
      return result as ServiceStatusRecord | null;
    } catch (error) {
      console.error('Error getting service status:', error);
      return null;
    }
  }

  /**
   * Get all service statuses
   */
  async getAllServiceStatuses(): Promise<ServiceStatusRecord[]> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM service_status ORDER BY service_name
      `).all();
      
      return result.results as ServiceStatusRecord[];
    } catch (error) {
      console.error('Error getting all service statuses:', error);
      return [];
    }
  }

  /**
   * Check if system is in read-only mode
   */
  isReadOnlyMode(): boolean {
    return this.readOnlyMode;
  }

  /**
   * Get health metrics for a service
   */
  getHealthMetrics(serviceName: string): HealthMetrics | null {
    return this.healthMetrics.get(serviceName) || null;
  }

  /**
   * Private methods
   */

  private async initializeServiceStatus(): Promise<void> {
    const services = ['R2_STORAGE', 'D1_DATABASE', 'AUTH_KV'];
    
    for (const service of services) {
      try {
        await this.env.DB.prepare(`
          INSERT OR IGNORE INTO service_status (service_name, status, last_check)
          VALUES (?, 'HEALTHY', ?)
        `).bind(service, new Date().toISOString()).run();
      } catch (error) {
        console.error(`Error initializing service status for ${service}:`, error);
      }
    }
  }

  private async loadCircuitBreakerStates(): Promise<void> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT service_name, circuit_breaker_state FROM service_status
      `).all();
      
      for (const row of result.results) {
        const record = row as ServiceStatusRecord;
        this.circuitBreakers.set(record.service_name, record.circuit_breaker_state);
      }
    } catch (error) {
      console.error('Error loading circuit breaker states:', error);
    }
  }

  private async updateServiceStatus(
    serviceName: string, 
    status: ServiceStatus, 
    reason?: string
  ): Promise<void> {
    try {
      await this.env.DB.prepare(`
        UPDATE service_status 
        SET status = ?, last_check = ?, degradation_reason = ?
        WHERE service_name = ?
      `).bind(
        status,
        new Date().toISOString(),
        reason || null,
        serviceName
      ).run();
    } catch (error) {
      console.error('Error updating service status:', error);
    }
  }

  private async getCircuitBreakerState(serviceName: string): Promise<CircuitBreakerState> {
    const cached = this.circuitBreakers.get(serviceName);
    if (cached) {
      return cached;
    }
    
    try {
      const result = await this.env.DB.prepare(`
        SELECT circuit_breaker_state FROM service_status WHERE service_name = ?
      `).bind(serviceName).first() as { circuit_breaker_state: CircuitBreakerState } | null;
      
      const state = result?.circuit_breaker_state || 'CLOSED';
      this.circuitBreakers.set(serviceName, state);
      return state;
    } catch (error) {
      console.error('Error getting circuit breaker state:', error);
      return 'CLOSED';
    }
  }

  private async openCircuitBreaker(serviceName: string, reason: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        UPDATE service_status 
        SET circuit_breaker_state = 'OPEN', circuit_breaker_opened_at = ?
        WHERE service_name = ?
      `).bind(new Date().toISOString(), serviceName).run();
      
      this.circuitBreakers.set(serviceName, 'OPEN');
      console.log(`Circuit breaker opened for ${serviceName}: ${reason}`);
    } catch (error) {
      console.error('Error opening circuit breaker:', error);
    }
  }

  private async closeCircuitBreaker(serviceName: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        UPDATE service_status 
        SET circuit_breaker_state = 'CLOSED', circuit_breaker_opened_at = NULL
        WHERE service_name = ?
      `).bind(serviceName).run();
      
      this.circuitBreakers.set(serviceName, 'CLOSED');
      console.log(`Circuit breaker closed for ${serviceName}`);
    } catch (error) {
      console.error('Error closing circuit breaker:', error);
    }
  }

  private async recordSuccess(serviceName: string, responseTime: number): Promise<void> {
    try {
      const metrics = this.healthMetrics.get(serviceName) || {
        response_time_ms: 0,
        error_rate: 0,
        success_rate: 100,
        consecutive_failures: 0,
        last_health_check: new Date().toISOString()
      };
      
      metrics.response_time_ms = responseTime;
      metrics.consecutive_failures = 0;
      metrics.last_health_check = new Date().toISOString();
      
      this.healthMetrics.set(serviceName, metrics);
      
      // Update database
      await this.env.DB.prepare(`
        UPDATE service_status 
        SET last_success = ?, failure_count = 0, health_metrics = ?
        WHERE service_name = ?
      `).bind(
        new Date().toISOString(),
        JSON.stringify(metrics),
        serviceName
      ).run();
    } catch (error) {
      console.error('Error recording success:', error);
    }
  }

  private async recordFailure(serviceName: string, error: string, responseTime: number): Promise<void> {
    try {
      const metrics = this.healthMetrics.get(serviceName) || {
        response_time_ms: 0,
        error_rate: 0,
        success_rate: 100,
        consecutive_failures: 0,
        last_health_check: new Date().toISOString()
      };
      
      metrics.response_time_ms = responseTime;
      metrics.consecutive_failures += 1;
      metrics.last_error = error;
      metrics.last_health_check = new Date().toISOString();
      
      this.healthMetrics.set(serviceName, metrics);
      
      // Update database
      await this.env.DB.prepare(`
        UPDATE service_status 
        SET last_failure = ?, failure_count = failure_count + 1, health_metrics = ?
        WHERE service_name = ?
      `).bind(
        new Date().toISOString(),
        JSON.stringify(metrics),
        serviceName
      ).run();
    } catch (error) {
      console.error('Error recording failure:', error);
    }
  }

  private async evaluateCircuitBreaker(serviceName: string): Promise<void> {
    try {
      const status = await this.getServiceStatus(serviceName);
      if (!status) return;
      
      const threshold = 5; // Default threshold
      
      if (status.failure_count >= threshold) {
        await this.openCircuitBreaker(serviceName, `Failure threshold reached (${status.failure_count})`);
      }
    } catch (error) {
      console.error('Error evaluating circuit breaker:', error);
    }
  }

  private async areAllServicesHealthy(): Promise<boolean> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT COUNT(*) as count FROM service_status 
        WHERE status != 'HEALTHY'
      `).first();
      
      return (result?.count || 0) === 0;
    } catch (error) {
      console.error('Error checking if all services are healthy:', error);
      return false;
    }
  }

  private isWriteOperation(serviceName: string): boolean {
    // Define write operations that should be blocked in read-only mode
    const writeServices = ['R2_STORAGE'];
    return writeServices.includes(serviceName);
  }

  private async notifyServiceDegradation(serviceName: string, reason: string): Promise<void> {
    try {
      // This would typically notify all active users
      await this.env.DB.prepare(`
        INSERT INTO user_notifications (
          user_id, notification_type, message, severity, created_at
        )
        SELECT 
          id, 'SERVICE_DEGRADED', 
          'Service degradation: ' || ? || ' - ' || ?, 
          'WARNING', 
          ?
        FROM users
        WHERE id IN (
          SELECT DISTINCT user_id FROM saved_files 
          WHERE uploaded_at > datetime('now', '-1 hour')
        )
      `).bind(serviceName, reason, new Date().toISOString()).run();
    } catch (error) {
      console.error('Error notifying service degradation:', error);
    }
  }

  private async notifyServiceRecovery(serviceName: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO user_notifications (
          user_id, notification_type, message, severity, created_at
        )
        SELECT 
          id, 'SERVICE_RECOVERED', 
          'Service recovered: ' || ?, 
          'INFO', 
          ?
        FROM users
        WHERE id IN (
          SELECT DISTINCT user_id FROM saved_files 
          WHERE uploaded_at > datetime('now', '-1 hour')
        )
      `).bind(serviceName, new Date().toISOString()).run();
    } catch (error) {
      console.error('Error notifying service recovery:', error);
    }
  }

  private async notifyOperationQueued(
    userId: number, 
    operationType: string, 
    operationId: string
  ): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO user_notifications (
          user_id, notification_type, message, severity, metadata, created_at
        ) VALUES (?, 'OPERATION_QUEUED', ?, 'INFO', ?, ?)
      `).bind(
        userId,
        `Operation queued: ${operationType}`,
        JSON.stringify({ operationId, operationType }),
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Error notifying operation queued:', error);
    }
  }

  private async recordSystemEvent(
    eventType: string,
    category: string,
    serviceName: string,
    eventData: any
  ): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO system_events (
          event_type, event_category, service_name, event_data, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        eventType,
        category,
        serviceName,
        JSON.stringify(eventData),
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Error recording system event:', error);
    }
  }
}
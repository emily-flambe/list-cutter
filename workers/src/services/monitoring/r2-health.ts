import type { Env } from '../../types';
import { CircuitBreaker, CircuitBreakerState, createR2CircuitBreaker } from './circuit-breaker';

export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded'
}

export enum OperationType {
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  LIST = 'list',
  HEAD = 'head'
}

export enum AlertType {
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open',
  HIGH_ERROR_RATE = 'high_error_rate',
  SLOW_RESPONSE = 'slow_response',
  SERVICE_DEGRADED = 'service_degraded',
  SERVICE_RECOVERED = 'service_recovered'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface HealthCheckResult {
  id?: number;
  timestamp: string;
  status: HealthStatus;
  responseTime: number;
  errorMessage?: string;
  operationType: OperationType;
  bucketName: string;
  testFileKey?: string;
  successCount: number;
  failureCount: number;
  metadata?: Record<string, any>;
}

export interface HealthCheckConfig {
  id?: number;
  serviceName: string;
  checkInterval: number; // milliseconds
  timeout: number; // milliseconds
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  slowResponseThreshold: number; // milliseconds
  enabled: boolean;
  testOperations: OperationType[];
  alertOnFailure: boolean;
  alertOnRecovery: boolean;
  updatedAt: string;
}

export interface ServiceAlert {
  id?: number;
  timestamp: string;
  alertType: AlertType;
  severity: AlertSeverity;
  serviceName: string;
  message: string;
  details?: Record<string, any>;
  resolvedAt?: string;
  resolutionNotes?: string;
  notificationSent: boolean;
  createdBy: string;
}

export interface HealthMetrics {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  errorRate: number;
  slowCheckRate: number;
  uptimePercentage: number;
  lastCheckTime: string;
  lastSuccessTime?: string;
  lastFailureTime?: string;
}

export class R2HealthMonitor {
  private env: Env;
  private circuitBreaker: CircuitBreaker;
  private config: HealthCheckConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval?: number;
  private healthMetrics: HealthMetrics;

  constructor(env: Env, config?: Partial<HealthCheckConfig>) {
    this.env = env;
    this.circuitBreaker = createR2CircuitBreaker(env);
    this.config = {
      serviceName: 'r2',
      checkInterval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      failureThreshold: 3,
      recoveryTimeout: 60000, // 1 minute
      slowResponseThreshold: 2000, // 2 seconds
      enabled: true,
      testOperations: [OperationType.GET, OperationType.PUT, OperationType.DELETE],
      alertOnFailure: true,
      alertOnRecovery: true,
      updatedAt: new Date().toISOString(),
      ...config
    };
    
    this.healthMetrics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      errorRate: 0,
      slowCheckRate: 0,
      uptimePercentage: 100,
      lastCheckTime: new Date().toISOString(),
      lastSuccessTime: undefined,
      lastFailureTime: undefined
    };
  }

  /**
   * Start continuous health monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('R2 health monitoring is already running');
      return;
    }

    console.log('Starting R2 health monitoring...');
    this.isMonitoring = true;

    // Load configuration from database
    await this.loadConfiguration();

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      if (this.config.enabled) {
        await this.performHealthCheck();
      }
    }, this.config.checkInterval) as unknown as number;

    console.log(`R2 health monitoring started with ${this.config.checkInterval}ms interval`);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('R2 health monitoring is not running');
      return;
    }

    console.log('Stopping R2 health monitoring...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    console.log('R2 health monitoring stopped');
  }

  /**
   * Perform a single health check
   */
  async performHealthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const operation of this.config.testOperations) {
      try {
        const result = await this.executeHealthCheck(operation);
        results.push(result);
        await this.saveHealthCheckResult(result);
      } catch (error) {
        console.error(`Health check failed for operation ${operation}:`, error);
        const errorResult: HealthCheckResult = {
          timestamp: new Date().toISOString(),
          status: HealthStatus.UNHEALTHY,
          responseTime: this.config.timeout,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          operationType: operation,
          bucketName: this.getBucketName(),
          successCount: 0,
          failureCount: 1
        };
        results.push(errorResult);
        await this.saveHealthCheckResult(errorResult);
      }
    }

    // Update metrics
    await this.updateHealthMetrics(results);

    // Check for alerts
    await this.checkAndCreateAlerts(results);

    return results;
  }

  /**
   * Execute a specific health check operation
   */
  private async executeHealthCheck(operation: OperationType): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const bucketName = this.getBucketName();
    const testFileKey = `health-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const result = await this.circuitBreaker.execute(async () => {
        switch (operation) {
          case OperationType.GET:
            return await this.testGetOperation(testFileKey);
          case OperationType.PUT:
            return await this.testPutOperation(testFileKey);
          case OperationType.DELETE:
            return await this.testDeleteOperation(testFileKey);
          case OperationType.LIST:
            return await this.testListOperation();
          case OperationType.HEAD:
            return await this.testHeadOperation(testFileKey);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      });

      const responseTime = Date.now() - startTime;
      const status = responseTime > this.config.slowResponseThreshold ? HealthStatus.DEGRADED : HealthStatus.HEALTHY;

      return {
        timestamp: new Date().toISOString(),
        status,
        responseTime,
        operationType: operation,
        bucketName,
        testFileKey,
        successCount: 1,
        failureCount: 0,
        metadata: { result }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        timestamp: new Date().toISOString(),
        status: HealthStatus.UNHEALTHY,
        responseTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        operationType: operation,
        bucketName,
        testFileKey,
        successCount: 0,
        failureCount: 1,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Test GET operation
   */
  private async testGetOperation(testFileKey: string): Promise<any> {
    // Try to get a non-existent file - this should return null without error
    const result = await this.env.R2_BUCKET.get(testFileKey);
    return { success: true, result: result === null ? 'not_found' : 'found' };
  }

  /**
   * Test PUT operation
   */
  private async testPutOperation(testFileKey: string): Promise<any> {
    const testData = `Health check test data: ${new Date().toISOString()}`;
    const result = await this.env.R2_BUCKET.put(testFileKey, testData, {
      httpMetadata: { contentType: 'text/plain' }
    });
    
    // Clean up the test file
    setTimeout(async () => {
      try {
        await this.env.R2_BUCKET.delete(testFileKey);
      } catch (error) {
        console.warn('Failed to clean up test file:', error);
      }
    }, 1000);

    return { success: true, result: 'uploaded' };
  }

  /**
   * Test DELETE operation
   */
  private async testDeleteOperation(testFileKey: string): Promise<any> {
    // First create a file to delete
    const testData = `Health check test data for deletion: ${new Date().toISOString()}`;
    await this.env.R2_BUCKET.put(testFileKey, testData);
    
    // Then delete it
    await this.env.R2_BUCKET.delete(testFileKey);
    
    return { success: true, result: 'deleted' };
  }

  /**
   * Test LIST operation
   */
  private async testListOperation(): Promise<any> {
    const result = await this.env.R2_BUCKET.list({ limit: 1 });
    return { success: true, result: 'listed', count: result.objects.length };
  }

  /**
   * Test HEAD operation
   */
  private async testHeadOperation(testFileKey: string): Promise<any> {
    // Try to head a non-existent file - this should return null without error
    const result = await this.env.R2_BUCKET.head(testFileKey);
    return { success: true, result: result === null ? 'not_found' : 'found' };
  }

  /**
   * Save health check result to database
   */
  private async saveHealthCheckResult(result: HealthCheckResult): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO r2_health_checks (
          timestamp, status, response_time_ms, error_message, operation_type,
          bucket_name, test_file_key, success_count, failure_count, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        result.timestamp,
        result.status,
        result.responseTime,
        result.errorMessage || null,
        result.operationType,
        result.bucketName,
        result.testFileKey || null,
        result.successCount,
        result.failureCount,
        JSON.stringify(result.metadata || {})
      ).run();
    } catch (error) {
      console.error('Failed to save health check result:', error);
    }
  }

  /**
   * Update health metrics based on recent results
   */
  private async updateHealthMetrics(results: HealthCheckResult[]): Promise<void> {
    const now = new Date().toISOString();
    
    for (const result of results) {
      this.healthMetrics.totalChecks++;
      
      if (result.status === HealthStatus.HEALTHY) {
        this.healthMetrics.successfulChecks++;
        this.healthMetrics.lastSuccessTime = now;
      } else {
        this.healthMetrics.failedChecks++;
        this.healthMetrics.lastFailureTime = now;
      }

      // Update average response time
      const totalResponseTime = this.healthMetrics.averageResponseTime * (this.healthMetrics.totalChecks - 1);
      this.healthMetrics.averageResponseTime = (totalResponseTime + result.responseTime) / this.healthMetrics.totalChecks;
    }

    // Calculate rates
    this.healthMetrics.errorRate = (this.healthMetrics.failedChecks / this.healthMetrics.totalChecks) * 100;
    this.healthMetrics.uptimePercentage = (this.healthMetrics.successfulChecks / this.healthMetrics.totalChecks) * 100;
    this.healthMetrics.lastCheckTime = now;
  }

  /**
   * Check and create alerts based on health check results
   */
  private async checkAndCreateAlerts(results: HealthCheckResult[]): Promise<void> {
    const circuitBreakerState = this.circuitBreaker.getState();
    
    // Check for circuit breaker open
    if (circuitBreakerState === CircuitBreakerState.OPEN) {
      await this.createAlert({
        alertType: AlertType.CIRCUIT_BREAKER_OPEN,
        severity: AlertSeverity.CRITICAL,
        message: 'R2 circuit breaker is open due to repeated failures',
        details: {
          circuitBreakerState,
          failureRate: this.circuitBreaker.getFailureRate(),
          timeUntilNextAttempt: this.circuitBreaker.getTimeUntilNextAttempt()
        }
      });
    }

    // Check for high error rate
    if (this.healthMetrics.errorRate > 20) { // 20% error rate threshold
      await this.createAlert({
        alertType: AlertType.HIGH_ERROR_RATE,
        severity: this.healthMetrics.errorRate > 50 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
        message: `R2 error rate is ${this.healthMetrics.errorRate.toFixed(2)}%`,
        details: {
          errorRate: this.healthMetrics.errorRate,
          totalChecks: this.healthMetrics.totalChecks,
          failedChecks: this.healthMetrics.failedChecks
        }
      });
    }

    // Check for slow responses
    if (this.healthMetrics.averageResponseTime > this.config.slowResponseThreshold) {
      await this.createAlert({
        alertType: AlertType.SLOW_RESPONSE,
        severity: AlertSeverity.MEDIUM,
        message: `R2 average response time is ${this.healthMetrics.averageResponseTime.toFixed(2)}ms`,
        details: {
          averageResponseTime: this.healthMetrics.averageResponseTime,
          threshold: this.config.slowResponseThreshold
        }
      });
    }

    // Check for service degradation
    const unhealthyResults = results.filter(r => r.status === HealthStatus.UNHEALTHY);
    if (unhealthyResults.length > 0) {
      await this.createAlert({
        alertType: AlertType.SERVICE_DEGRADED,
        severity: AlertSeverity.HIGH,
        message: `R2 service is degraded: ${unhealthyResults.length} of ${results.length} operations failed`,
        details: {
          failedOperations: unhealthyResults.map(r => r.operationType),
          totalOperations: results.length
        }
      });
    }
  }

  /**
   * Create an alert
   */
  private async createAlert(alert: Partial<ServiceAlert>): Promise<void> {
    const fullAlert: ServiceAlert = {
      timestamp: new Date().toISOString(),
      serviceName: this.config.serviceName,
      notificationSent: false,
      createdBy: 'system',
      ...alert
    } as ServiceAlert;

    try {
      await this.env.DB.prepare(`
        INSERT INTO service_alerts (
          timestamp, alert_type, severity, service_name, message, 
          details, notification_sent, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        fullAlert.timestamp,
        fullAlert.alertType,
        fullAlert.severity,
        fullAlert.serviceName,
        fullAlert.message,
        JSON.stringify(fullAlert.details || {}),
        fullAlert.notificationSent,
        fullAlert.createdBy
      ).run();

      console.log(`Created alert: ${fullAlert.alertType} - ${fullAlert.message}`);
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  /**
   * Load configuration from database
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM health_check_config WHERE service_name = ?
      `).bind(this.config.serviceName).first();

      if (result) {
        this.config = {
          id: result.id,
          serviceName: result.service_name,
          checkInterval: result.check_interval_ms,
          timeout: result.timeout_ms,
          failureThreshold: result.failure_threshold,
          recoveryTimeout: result.recovery_timeout_ms,
          slowResponseThreshold: result.slow_response_threshold_ms,
          enabled: result.enabled,
          testOperations: JSON.parse(result.test_operations || '["get", "put", "delete"]'),
          alertOnFailure: result.alert_on_failure,
          alertOnRecovery: result.alert_on_recovery,
          updatedAt: result.updated_at
        };
      }
    } catch (error) {
      console.error('Failed to load health check configuration:', error);
    }
  }

  /**
   * Get bucket name from environment
   */
  private getBucketName(): string {
    return this.env.R2_BUCKET.name || 'default-bucket';
  }

  /**
   * Get current health status
   */
  getHealthStatus(): {
    overall: HealthStatus;
    circuitBreakerState: CircuitBreakerState;
    metrics: HealthMetrics;
    isMonitoring: boolean;
  } {
    const circuitBreakerState = this.circuitBreaker.getState();
    
    let overall: HealthStatus;
    if (circuitBreakerState === CircuitBreakerState.OPEN) {
      overall = HealthStatus.UNHEALTHY;
    } else if (this.healthMetrics.errorRate > 10 || this.healthMetrics.averageResponseTime > this.config.slowResponseThreshold) {
      overall = HealthStatus.DEGRADED;
    } else {
      overall = HealthStatus.HEALTHY;
    }

    return {
      overall,
      circuitBreakerState,
      metrics: this.healthMetrics,
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Get circuit breaker instance
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Get configuration
   */
  getConfiguration(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfiguration(updates: Partial<HealthCheckConfig>): Promise<void> {
    this.config = { ...this.config, ...updates, updatedAt: new Date().toISOString() };
    
    try {
      await this.env.DB.prepare(`
        UPDATE health_check_config 
        SET check_interval_ms = ?, timeout_ms = ?, failure_threshold = ?, 
            recovery_timeout_ms = ?, slow_response_threshold_ms = ?, enabled = ?,
            test_operations = ?, alert_on_failure = ?, alert_on_recovery = ?,
            updated_at = ?
        WHERE service_name = ?
      `).bind(
        this.config.checkInterval,
        this.config.timeout,
        this.config.failureThreshold,
        this.config.recoveryTimeout,
        this.config.slowResponseThreshold,
        this.config.enabled,
        JSON.stringify(this.config.testOperations),
        this.config.alertOnFailure,
        this.config.alertOnRecovery,
        this.config.updatedAt,
        this.config.serviceName
      ).run();
    } catch (error) {
      console.error('Failed to update health check configuration:', error);
    }
  }

  /**
   * Get recent health check results
   */
  async getRecentHealthChecks(limit: number = 50): Promise<HealthCheckResult[]> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT * FROM r2_health_checks 
        ORDER BY timestamp DESC 
        LIMIT ?
      `).bind(limit).all();

      return results.results.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        status: row.status as HealthStatus,
        responseTime: row.response_time_ms,
        errorMessage: row.error_message,
        operationType: row.operation_type as OperationType,
        bucketName: row.bucket_name,
        testFileKey: row.test_file_key,
        successCount: row.success_count,
        failureCount: row.failure_count,
        metadata: JSON.parse(row.metadata || '{}')
      }));
    } catch (error) {
      console.error('Failed to get recent health checks:', error);
      return [];
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<ServiceAlert[]> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT * FROM service_alerts 
        WHERE resolved_at IS NULL 
        ORDER BY severity DESC, timestamp DESC
      `).all();

      return results.results.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        alertType: row.alert_type as AlertType,
        severity: row.severity as AlertSeverity,
        serviceName: row.service_name,
        message: row.message,
        details: JSON.parse(row.details || '{}'),
        resolvedAt: row.resolved_at,
        resolutionNotes: row.resolution_notes,
        notificationSent: row.notification_sent,
        createdBy: row.created_by
      }));
    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: number, resolutionNotes?: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        UPDATE service_alerts 
        SET resolved_at = ?, resolution_notes = ?
        WHERE id = ?
      `).bind(
        new Date().toISOString(),
        resolutionNotes || null,
        alertId
      ).run();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  }
}
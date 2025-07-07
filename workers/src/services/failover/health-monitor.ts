import type { 
  Env, 
  ServiceStatus, 
  ServiceStatusRecord, 
  HealthMetrics,
  SystemEvent 
} from '../../types';
import { ApiError } from '../../middleware/error';

export class HealthMonitor {
  private env: Env;
  private checkInterval: number;
  private isMonitoring: boolean = false;
  private healthCheckTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(env: Env, checkInterval: number = 30000) {
    this.env = env;
    this.checkInterval = checkInterval;
  }

  /**
   * Start health monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('Health monitoring started');

    // Initialize health checks for all services
    await this.initializeHealthChecks();

    // Start periodic health checks
    this.scheduleHealthChecks();
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    
    // Clear all scheduled health checks
    this.healthCheckTimeouts.forEach(timeout => clearTimeout(timeout));
    this.healthCheckTimeouts.clear();
    
    console.log('Health monitoring stopped');
  }

  /**
   * Perform health check for a specific service
   */
  async checkServiceHealth(serviceName: string): Promise<HealthMetrics> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      switch (serviceName) {
        case 'R2_STORAGE':
          success = await this.checkR2Health();
          break;
        case 'D1_DATABASE':
          success = await this.checkD1Health();
          break;
        case 'AUTH_KV':
          success = await this.checkKVHealth();
          break;
        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }
    } catch (err) {
      error = String(err);
      success = false;
    }

    const responseTime = Date.now() - startTime;
    const metrics: HealthMetrics = {
      response_time_ms: responseTime,
      error_rate: success ? 0 : 100,
      success_rate: success ? 100 : 0,
      last_error: error,
      consecutive_failures: 0, // This will be calculated when updating
      last_health_check: new Date().toISOString()
    };

    // Update service status
    await this.updateServiceHealthStatus(serviceName, success, metrics, error);

    return metrics;
  }

  /**
   * Check health of all services
   */
  async checkAllServicesHealth(): Promise<Record<string, HealthMetrics>> {
    const services = ['R2_STORAGE', 'D1_DATABASE', 'AUTH_KV'];
    const results: Record<string, HealthMetrics> = {};

    const healthChecks = services.map(async (service) => {
      try {
        const metrics = await this.checkServiceHealth(service);
        results[service] = metrics;
      } catch (error) {
        console.error(`Error checking health for ${service}:`, error);
        results[service] = {
          response_time_ms: 0,
          error_rate: 100,
          success_rate: 0,
          last_error: String(error),
          consecutive_failures: 0,
          last_health_check: new Date().toISOString()
        };
      }
    });

    await Promise.all(healthChecks);
    return results;
  }

  /**
   * Get current service status
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatusRecord | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM service_status WHERE service_name = ?
      `).bind(serviceName).first();

      return result as ServiceStatusRecord | null;
    } catch (error) {
      console.error(`Error getting service status for ${serviceName}:`, error);
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
   * Get system health summary
   */
  async getSystemHealthSummary(): Promise<{
    overall_status: ServiceStatus;
    healthy_services: number;
    degraded_services: number;
    offline_services: number;
    total_services: number;
    last_check: string;
  }> {
    try {
      const statuses = await this.getAllServiceStatuses();
      
      const healthy = statuses.filter(s => s.status === 'HEALTHY').length;
      const degraded = statuses.filter(s => s.status === 'DEGRADED').length;
      const offline = statuses.filter(s => s.status === 'OFFLINE').length;
      const total = statuses.length;

      let overallStatus: ServiceStatus = 'HEALTHY';
      if (offline > 0) {
        overallStatus = 'OFFLINE';
      } else if (degraded > 0) {
        overallStatus = 'DEGRADED';
      }

      return {
        overall_status: overallStatus,
        healthy_services: healthy,
        degraded_services: degraded,
        offline_services: offline,
        total_services: total,
        last_check: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting system health summary:', error);
      return {
        overall_status: 'OFFLINE',
        healthy_services: 0,
        degraded_services: 0,
        offline_services: 0,
        total_services: 0,
        last_check: new Date().toISOString()
      };
    }
  }

  /**
   * Get recent system events
   */
  async getRecentSystemEvents(limit: number = 50): Promise<SystemEvent[]> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM system_events 
        ORDER BY created_at DESC 
        LIMIT ?
      `).bind(limit).all();

      return result.results as SystemEvent[];
    } catch (error) {
      console.error('Error getting recent system events:', error);
      return [];
    }
  }

  /**
   * Record a system event
   */
  async recordSystemEvent(
    eventType: string,
    category: string,
    serviceName: string,
    eventData: any,
    severity: string = 'INFO'
  ): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO system_events (
          event_type, event_category, service_name, event_data, severity, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        eventType,
        category,
        serviceName,
        JSON.stringify(eventData),
        severity,
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Error recording system event:', error);
    }
  }

  /**
   * Private methods
   */

  private async initializeHealthChecks(): Promise<void> {
    const services = ['R2_STORAGE', 'D1_DATABASE', 'AUTH_KV'];
    
    for (const service of services) {
      try {
        // Ensure service status record exists
        await this.env.DB.prepare(`
          INSERT OR IGNORE INTO service_status (service_name, status, last_check)
          VALUES (?, 'HEALTHY', ?)
        `).bind(service, new Date().toISOString()).run();

        // Perform initial health check
        await this.checkServiceHealth(service);
      } catch (error) {
        console.error(`Error initializing health check for ${service}:`, error);
      }
    }
  }

  private scheduleHealthChecks(): void {
    const services = ['R2_STORAGE', 'D1_DATABASE', 'AUTH_KV'];
    
    services.forEach(service => {
      this.scheduleServiceHealthCheck(service);
    });
  }

  private scheduleServiceHealthCheck(serviceName: string): void {
    if (!this.isMonitoring) {
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        await this.checkServiceHealth(serviceName);
      } catch (error) {
        console.error(`Error in scheduled health check for ${serviceName}:`, error);
      }
      
      // Schedule next check
      this.scheduleServiceHealthCheck(serviceName);
    }, this.checkInterval);

    this.healthCheckTimeouts.set(serviceName, timeout);
  }

  private async checkR2Health(): Promise<boolean> {
    try {
      // Perform a simple list operation to check R2 health
      const result = await this.env.R2_BUCKET.list({ limit: 1 });
      return result !== null;
    } catch (error) {
      console.error('R2 health check failed:', error);
      return false;
    }
  }

  private async checkD1Health(): Promise<boolean> {
    try {
      // Perform a simple query to check D1 health
      const result = await this.env.DB.prepare('SELECT 1 as test').first();
      return result !== null;
    } catch (error) {
      console.error('D1 health check failed:', error);
      return false;
    }
  }

  private async checkKVHealth(): Promise<boolean> {
    try {
      // Perform a simple get operation to check KV health
      const testKey = 'health_check_' + Date.now();
      const testValue = 'test';
      
      await this.env.AUTH_KV.put(testKey, testValue, { expirationTtl: 60 });
      const result = await this.env.AUTH_KV.get(testKey);
      await this.env.AUTH_KV.delete(testKey);
      
      return result === testValue;
    } catch (error) {
      console.error('KV health check failed:', error);
      return false;
    }
  }

  private async updateServiceHealthStatus(
    serviceName: string,
    success: boolean,
    metrics: HealthMetrics,
    error?: string
  ): Promise<void> {
    try {
      // Get current status to calculate consecutive failures
      const currentStatus = await this.getServiceStatus(serviceName);
      
      let consecutiveFailures = 0;
      let newStatus: ServiceStatus = 'HEALTHY';
      let degradationReason: string | undefined;

      if (success) {
        // Success - reset consecutive failures
        consecutiveFailures = 0;
        newStatus = 'HEALTHY';
      } else {
        // Failure - increment consecutive failures
        consecutiveFailures = (currentStatus?.failure_count || 0) + 1;
        
        if (consecutiveFailures >= 3) {
          newStatus = 'OFFLINE';
          degradationReason = `${consecutiveFailures} consecutive failures`;
        } else if (consecutiveFailures >= 1) {
          newStatus = 'DEGRADED';
          degradationReason = `${consecutiveFailures} recent failures`;
        }
      }

      // Update metrics with consecutive failures
      metrics.consecutive_failures = consecutiveFailures;

      // Update service status
      await this.env.DB.prepare(`
        UPDATE service_status 
        SET 
          status = ?,
          last_check = ?,
          last_success = ?,
          last_failure = ?,
          failure_count = ?,
          degradation_reason = ?,
          health_metrics = ?
        WHERE service_name = ?
      `).bind(
        newStatus,
        new Date().toISOString(),
        success ? new Date().toISOString() : currentStatus?.last_success,
        success ? currentStatus?.last_failure : new Date().toISOString(),
        consecutiveFailures,
        degradationReason,
        JSON.stringify(metrics),
        serviceName
      ).run();

      // Record status change events
      if (currentStatus && currentStatus.status !== newStatus) {
        await this.recordSystemEvent(
          'SERVICE_STATUS_CHANGE',
          'HEALTH',
          serviceName,
          {
            previous_status: currentStatus.status,
            new_status: newStatus,
            consecutive_failures: consecutiveFailures,
            error: error
          },
          newStatus === 'OFFLINE' ? 'ERROR' : newStatus === 'DEGRADED' ? 'WARNING' : 'INFO'
        );
      }

      // Log status changes
      if (currentStatus && currentStatus.status !== newStatus) {
        console.log(`Service ${serviceName} status changed: ${currentStatus.status} -> ${newStatus}`);
      }

    } catch (error) {
      console.error(`Error updating service health status for ${serviceName}:`, error);
    }
  }
}

// Health monitoring utilities
export class HealthMonitoringUtils {
  /**
   * Format health metrics for display
   */
  static formatHealthMetrics(metrics: HealthMetrics): string {
    return `Response: ${metrics.response_time_ms}ms | ` +
           `Success: ${metrics.success_rate}% | ` +
           `Errors: ${metrics.error_rate}% | ` +
           `Consecutive Failures: ${metrics.consecutive_failures}`;
  }

  /**
   * Get health status color for UI display
   */
  static getHealthStatusColor(status: ServiceStatus): string {
    switch (status) {
      case 'HEALTHY':
        return 'green';
      case 'DEGRADED':
        return 'yellow';
      case 'OFFLINE':
        return 'red';
      default:
        return 'gray';
    }
  }

  /**
   * Calculate service availability percentage
   */
  static async calculateAvailability(
    env: Env,
    serviceName: string,
    periodHours: number = 24
  ): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - periodHours);

      const result = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total_checks,
          SUM(CASE WHEN JSON_EXTRACT(event_data, '$.new_status') = 'HEALTHY' THEN 1 ELSE 0 END) as healthy_checks
        FROM system_events 
        WHERE service_name = ? 
        AND event_type = 'SERVICE_STATUS_CHANGE'
        AND created_at > ?
      `).bind(serviceName, cutoffTime.toISOString()).first();

      if (!result || result.total_checks === 0) {
        return 100; // Assume healthy if no data
      }

      return (result.healthy_checks / result.total_checks) * 100;
    } catch (error) {
      console.error('Error calculating availability:', error);
      return 0;
    }
  }

  /**
   * Get service health trend
   */
  static async getHealthTrend(
    env: Env,
    serviceName: string,
    periodHours: number = 24
  ): Promise<'improving' | 'stable' | 'degrading'> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - periodHours);

      const result = await env.DB.prepare(`
        SELECT event_data, created_at
        FROM system_events 
        WHERE service_name = ? 
        AND event_type = 'SERVICE_STATUS_CHANGE'
        AND created_at > ?
        ORDER BY created_at ASC
        LIMIT 10
      `).bind(serviceName, cutoffTime.toISOString()).all();

      if (result.results.length < 2) {
        return 'stable';
      }

      const events = result.results.map(row => JSON.parse(row.event_data));
      const recent = events.slice(-3);
      const older = events.slice(0, 3);

      const recentHealthy = recent.filter(e => e.new_status === 'HEALTHY').length;
      const olderHealthy = older.filter(e => e.new_status === 'HEALTHY').length;

      if (recentHealthy > olderHealthy) {
        return 'improving';
      } else if (recentHealthy < olderHealthy) {
        return 'degrading';
      } else {
        return 'stable';
      }
    } catch (error) {
      console.error('Error getting health trend:', error);
      return 'stable';
    }
  }
}
import { 
  DegradedModeConfig, 
  PerformanceThresholds, 
  AlertThresholds, 
  HealthCheckResult, 
  ServiceHealthStatus 
} from '../types/backup';
import { CloudflareEnv } from '../types/env';

export class DegradedModeService {
  private readonly env: CloudflareEnv;
  private readonly config: DegradedModeConfig;

  constructor(env: CloudflareEnv) {
    this.env = env;
    this.config = {
      enabledFeatures: [
        'file_upload',
        'file_download', 
        'file_list',
        'basic_authentication',
        'health_checks'
      ],
      disabledFeatures: [
        'file_compression',
        'thumbnail_generation',
        'advanced_analytics',
        'batch_operations',
        'background_processing',
        'file_sharing',
        'advanced_search',
        'bulk_operations'
      ],
      readOnlyMode: false,
      performanceThresholds: {
        maxResponseTime: 5000, // 5 seconds
        maxErrorRate: 0.05, // 5%
        maxConcurrentRequests: 100
      },
      alertThresholds: {
        responseTimeWarning: 2000, // 2 seconds
        errorRateWarning: 0.02, // 2%
        storageUsageWarning: 0.85 // 85%
      }
    };
  }

  async enableDegradedMode(reason: string): Promise<void> {
    console.log(`Enabling degraded mode: ${reason}`);
    
    try {
      // 1. Update system status
      await this.updateSystemStatus('degraded', reason);
      
      // 2. Disable non-essential features
      await this.disableNonEssentialFeatures();
      
      // 3. Enable read-only mode if necessary
      if (this.shouldEnableReadOnlyMode(reason)) {
        await this.enableReadOnlyMode();
      }
      
      // 4. Update performance thresholds
      await this.adjustPerformanceThresholds();
      
      // 5. Update monitoring thresholds
      await this.adjustMonitoringThresholds();
      
      // 6. Notify administrators
      await this.notifyAdministrators('degraded_mode_enabled', reason);
      
      console.log('Degraded mode enabled successfully');
      
    } catch (error) {
      console.error('Failed to enable degraded mode:', error);
      throw error;
    }
  }

  async disableDegradedMode(): Promise<void> {
    console.log('Disabling degraded mode');
    
    try {
      // 1. Verify system health
      const healthCheck = await this.performHealthCheck();
      
      if (!healthCheck.isHealthy) {
        throw new Error('Cannot disable degraded mode: system health check failed');
      }
      
      // 2. Re-enable all features
      await this.enableAllFeatures();
      
      // 3. Disable read-only mode
      await this.disableReadOnlyMode();
      
      // 4. Restore normal performance thresholds
      await this.restoreNormalPerformanceThresholds();
      
      // 5. Restore normal monitoring thresholds
      await this.restoreNormalMonitoringThresholds();
      
      // 6. Update system status
      await this.updateSystemStatus('operational', 'Recovery completed');
      
      // 7. Notify administrators
      await this.notifyAdministrators('degraded_mode_disabled', 'System fully recovered');
      
      console.log('Degraded mode disabled successfully');
      
    } catch (error) {
      console.error('Failed to disable degraded mode:', error);
      throw error;
    }
  }

  async getCurrentMode(): Promise<string> {
    try {
      const statusResult = await this.env.DB.prepare(`
        SELECT status FROM system_status 
        ORDER BY created_at DESC 
        LIMIT 1
      `).all();
      
      if (statusResult.results.length === 0) {
        return 'operational';
      }
      
      return String(statusResult.results[0].status);
      
    } catch (error) {
      console.error('Failed to get current mode:', error);
      return 'unknown';
    }
  }

  async isFeatureEnabled(featureName: string): Promise<boolean> {
    const currentMode = await this.getCurrentMode();
    
    if (currentMode === 'operational') {
      return true;
    }
    
    if (currentMode === 'degraded') {
      return this.config.enabledFeatures.includes(featureName);
    }
    
    return false;
  }

  async isReadOnlyMode(): Promise<boolean> {
    try {
      const modeResult = await this.env.DB.prepare(`
        SELECT read_only_mode FROM system_configuration 
        ORDER BY created_at DESC 
        LIMIT 1
      `).all();
      
      if (modeResult.results.length === 0) {
        return false;
      }
      
      return Boolean(modeResult.results[0].read_only_mode);
      
    } catch (error) {
      console.error('Failed to check read-only mode:', error);
      return false;
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    console.log('Performing system health check');
    
    const healthChecks = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkFileStorageHealth(),
      this.checkApiHealth(),
      this.checkMonitoringHealth()
    ]);
    
    const results = healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : { 
        status: 'unhealthy' as const, 
        responseTime: 0, 
        errorRate: 1, 
        lastChecked: new Date().toISOString()
      }
    );
    
    const isHealthy = results.every(result => result.status === 'healthy');
    const overallScore = results.reduce((sum, result) => {
      const score = result.status === 'healthy' ? 100 : 
                   result.status === 'degraded' ? 50 : 0;
      return sum + score;
    }, 0) / results.length;
    
    return {
      isHealthy,
      details: results,
      timestamp: new Date().toISOString(),
      overallScore
    };
  }

  async checkSystemLoad(): Promise<{
    responseTime: number;
    errorRate: number;
    concurrentRequests: number;
    memoryUsage: number;
  }> {
    // Placeholder for system load checking
    // In production, this would check actual system metrics
    return {
      responseTime: 1000,
      errorRate: 0.01,
      concurrentRequests: 50,
      memoryUsage: 0.6
    };
  }

  async shouldEnterDegradedMode(): Promise<boolean> {
    try {
      const systemLoad = await this.checkSystemLoad();
      const healthCheck = await this.performHealthCheck();
      
      // Check if system exceeds performance thresholds
      if (systemLoad.responseTime > this.config.performanceThresholds.maxResponseTime) {
        return true;
      }
      
      if (systemLoad.errorRate > this.config.performanceThresholds.maxErrorRate) {
        return true;
      }
      
      if (systemLoad.concurrentRequests > this.config.performanceThresholds.maxConcurrentRequests) {
        return true;
      }
      
      // Check if system health is below threshold
      if (healthCheck.overallScore < 70) {
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Failed to check if should enter degraded mode:', error);
      return false;
    }
  }

  // Private methods
  private async updateSystemStatus(status: string, reason: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT INTO system_status (status, reason, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).bind(status, reason, new Date().toISOString(), new Date().toISOString()).run();
      
      console.log(`System status updated: ${status} - ${reason}`);
      
    } catch (error) {
      console.error('Failed to update system status:', error);
    }
  }

  private async disableNonEssentialFeatures(): Promise<void> {
    console.log('Disabling non-essential features');
    
    try {
      for (const feature of this.config.disabledFeatures) {
        await this.disableFeature(feature);
      }
      
      console.log(`Disabled ${this.config.disabledFeatures.length} non-essential features`);
      
    } catch (error) {
      console.error('Failed to disable non-essential features:', error);
    }
  }

  private async enableAllFeatures(): Promise<void> {
    console.log('Enabling all features');
    
    try {
      const allFeatures = [...this.config.enabledFeatures, ...this.config.disabledFeatures];
      
      for (const feature of allFeatures) {
        await this.enableFeature(feature);
      }
      
      console.log(`Enabled ${allFeatures.length} features`);
      
    } catch (error) {
      console.error('Failed to enable all features:', error);
    }
  }

  private async disableFeature(featureName: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO feature_flags (feature_name, enabled, updated_at)
        VALUES (?, ?, ?)
      `).bind(featureName, false, new Date().toISOString()).run();
      
      console.log(`Feature disabled: ${featureName}`);
      
    } catch (error) {
      console.error(`Failed to disable feature ${featureName}:`, error);
    }
  }

  private async enableFeature(featureName: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO feature_flags (feature_name, enabled, updated_at)
        VALUES (?, ?, ?)
      `).bind(featureName, true, new Date().toISOString()).run();
      
      console.log(`Feature enabled: ${featureName}`);
      
    } catch (error) {
      console.error(`Failed to enable feature ${featureName}:`, error);
    }
  }

  private shouldEnableReadOnlyMode(reason: string): boolean {
    const readOnlyReasons = [
      'database_corruption',
      'storage_failure',
      'critical_error',
      'maintenance_mode'
    ];
    
    return readOnlyReasons.some(readOnlyReason => 
      reason.toLowerCase().includes(readOnlyReason)
    );
  }

  private async enableReadOnlyMode(): Promise<void> {
    console.log('Enabling read-only mode');
    
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO system_configuration (key, value, updated_at)
        VALUES (?, ?, ?)
      `).bind('read_only_mode', 'true', new Date().toISOString()).run();
      
      this.config.readOnlyMode = true;
      
      console.log('Read-only mode enabled');
      
    } catch (error) {
      console.error('Failed to enable read-only mode:', error);
    }
  }

  private async disableReadOnlyMode(): Promise<void> {
    console.log('Disabling read-only mode');
    
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO system_configuration (key, value, updated_at)
        VALUES (?, ?, ?)
      `).bind('read_only_mode', 'false', new Date().toISOString()).run();
      
      this.config.readOnlyMode = false;
      
      console.log('Read-only mode disabled');
      
    } catch (error) {
      console.error('Failed to disable read-only mode:', error);
    }
  }

  private async adjustPerformanceThresholds(): Promise<void> {
    console.log('Adjusting performance thresholds for degraded mode');
    
    // Relax thresholds in degraded mode
    const degradedThresholds = {
      maxResponseTime: this.config.performanceThresholds.maxResponseTime * 2,
      maxErrorRate: this.config.performanceThresholds.maxErrorRate * 1.5,
      maxConcurrentRequests: this.config.performanceThresholds.maxConcurrentRequests * 0.7
    };
    
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO system_configuration (key, value, updated_at)
        VALUES (?, ?, ?)
      `).bind('performance_thresholds', JSON.stringify(degradedThresholds), new Date().toISOString()).run();
      
      console.log('Performance thresholds adjusted for degraded mode');
      
    } catch (error) {
      console.error('Failed to adjust performance thresholds:', error);
    }
  }

  private async restoreNormalPerformanceThresholds(): Promise<void> {
    console.log('Restoring normal performance thresholds');
    
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO system_configuration (key, value, updated_at)
        VALUES (?, ?, ?)
      `).bind('performance_thresholds', JSON.stringify(this.config.performanceThresholds), new Date().toISOString()).run();
      
      console.log('Normal performance thresholds restored');
      
    } catch (error) {
      console.error('Failed to restore normal performance thresholds:', error);
    }
  }

  private async adjustMonitoringThresholds(): Promise<void> {
    console.log('Adjusting monitoring thresholds for degraded mode');
    
    // Relax alert thresholds in degraded mode
    const degradedAlertThresholds = {
      responseTimeWarning: this.config.alertThresholds.responseTimeWarning * 1.5,
      errorRateWarning: this.config.alertThresholds.errorRateWarning * 2,
      storageUsageWarning: this.config.alertThresholds.storageUsageWarning * 1.1
    };
    
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO system_configuration (key, value, updated_at)
        VALUES (?, ?, ?)
      `).bind('alert_thresholds', JSON.stringify(degradedAlertThresholds), new Date().toISOString()).run();
      
      console.log('Monitoring thresholds adjusted for degraded mode');
      
    } catch (error) {
      console.error('Failed to adjust monitoring thresholds:', error);
    }
  }

  private async restoreNormalMonitoringThresholds(): Promise<void> {
    console.log('Restoring normal monitoring thresholds');
    
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO system_configuration (key, value, updated_at)
        VALUES (?, ?, ?)
      `).bind('alert_thresholds', JSON.stringify(this.config.alertThresholds), new Date().toISOString()).run();
      
      console.log('Normal monitoring thresholds restored');
      
    } catch (error) {
      console.error('Failed to restore normal monitoring thresholds:', error);
    }
  }

  private async notifyAdministrators(eventType: string, message: string): Promise<void> {
    console.log(`Notifying administrators: ${eventType} - ${message}`);
    
    try {
      // Record notification in database
      await this.env.DB.prepare(`
        INSERT INTO admin_notifications (event_type, message, created_at, status)
        VALUES (?, ?, ?, ?)
      `).bind(eventType, message, new Date().toISOString(), 'sent').run();
      
      // In production, this would send actual notifications via email/SMS/webhook
      console.log(`Administrator notification sent: ${eventType}`);
      
    } catch (error) {
      console.error('Failed to notify administrators:', error);
    }
  }

  private async checkDatabaseHealth(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    
    try {
      await this.env.DB.prepare('SELECT 1').all();
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        errorRate: 0,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorRate: 1,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkFileStorageHealth(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    
    try {
      const testKey = `health-check-${Date.now()}`;
      await this.env.FILE_STORAGE.put(testKey, 'test');
      const result = await this.env.FILE_STORAGE.get(testKey);
      await this.env.FILE_STORAGE.delete(testKey);
      
      return {
        status: result ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        errorRate: result ? 0 : 0.1,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorRate: 1,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkApiHealth(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Placeholder for API health check
      // In production, this would test critical API endpoints
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        errorRate: 0,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorRate: 1,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkMonitoringHealth(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Placeholder for monitoring health check
      // In production, this would check monitoring system connectivity
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        errorRate: 0,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorRate: 1,
        lastChecked: new Date().toISOString()
      };
    }
  }
}
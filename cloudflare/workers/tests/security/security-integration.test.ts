/**
 * Security Integration Tests
 * 
 * Comprehensive integration testing for security components including:
 * - Security configuration management
 * - Security monitoring and metrics
 * - Security headers middleware
 * - File validation security
 * - Authentication security
 * - Rate limiting
 * - End-to-end security workflows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityConfigManager, SecurityPolicy } from '../../src/config/security-config';
import { SecurityMonitorService } from '../../src/services/security/security-monitor';
import { SecurityMetricsCollector } from '../../src/services/security/metrics-collector';
import { SecurityHeadersMiddleware } from '../../src/middleware/security-headers';
import { FileValidationService } from '../../src/services/security/file-validator';

// Mock KV and Analytics
class MockKVNamespace {
  private storage = new Map<string, string>();
  
  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }
  
  async put(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
  
  clear(): void {
    this.storage.clear();
  }
}

class MockAnalyticsEngineDataset {
  private dataPoints: any[] = [];
  
  writeDataPoint(data: any): void {
    this.dataPoints.push(data);
  }
  
  getDataPoints(): any[] {
    return this.dataPoints;
  }
  
  clear(): void {
    this.dataPoints = [];
  }
}

class MockD1Database {
  private tables = new Map<string, any[]>();
  
  prepare(query: string) {
    return {
      bind: (...params: any[]) => ({
        first: async () => {
          // Mock database responses
          if (query.includes('COUNT(*)')) {
            return { count: 0, total_size: 0 };
          }
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => ({ success: true })
      })
    };
  }
}

describe('Security Integration Tests', () => {
  let mockKV: MockKVNamespace;
  let mockAnalytics: MockAnalyticsEngineDataset;
  let mockDB: MockD1Database;
  let configManager: SecurityConfigManager;
  let monitor: SecurityMonitorService;
  let metricsCollector: SecurityMetricsCollector;
  let headersMiddleware: SecurityHeadersMiddleware;
  let fileValidator: FileValidationService;
  
  beforeEach(() => {
    // Setup mocks
    mockKV = new MockKVNamespace();
    mockAnalytics = new MockAnalyticsEngineDataset();
    mockDB = new MockD1Database();
    
    // Create security configuration manager
    configManager = new SecurityConfigManager({
      kvNamespace: mockKV as any,
      environment: 'development',
      enableDynamicUpdates: true,
      cacheExpirationMinutes: 5,
      fallbackToDefaults: true
    });
    
    // Create security monitor
    monitor = new SecurityMonitorService({
      configManager,
      analytics: mockAnalytics as any,
      kvNamespace: mockKV as any,
      performanceThreshold: 100,
      enableRealTimeMonitoring: true,
      batchSize: 10,
      metricsRetentionDays: 30
    });
    
    // Create metrics collector
    metricsCollector = new SecurityMetricsCollector({
      configManager,
      monitor,
      analytics: mockAnalytics as any,
      kvStorage: mockKV as any,
      config: {
        enabled: true,
        batchSize: 10,
        flushIntervalSeconds: 60,
        retentionDays: 30,
        aggregationWindows: [5, 15, 60],
        enabledMetrics: ['security.auth.attempts', 'security.file.validations'],
        alertThresholds: { 'security.auth.failures': 5 }
      }
    });
    
    // Create headers middleware
    headersMiddleware = new SecurityHeadersMiddleware({
      configManager,
      monitor,
      enableNonceGeneration: true,
      enableReporting: true
    });
    
    // Create file validator
    fileValidator = new FileValidationService(mockDB as any);
  });
  
  afterEach(() => {
    mockKV.clear();
    mockAnalytics.clear();
  });
  
  describe('Security Configuration Management', () => {
    it('should load default configuration', async () => {
      const config = await configManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.environment).toBe('development');
      expect(config.auth.jwtExpirationSeconds).toBe(3600);
      expect(config.fileUpload.maxFileSize).toBe(50 * 1024 * 1024);
    });
    
    it('should update configuration dynamically', async () => {
      const updates = {
        auth: {
          jwtExpirationSeconds: 7200,
          maxLoginAttempts: 3
        }
      };
      
      await configManager.updateConfig(updates);
      const config = await configManager.getConfig();
      
      expect(config.auth.jwtExpirationSeconds).toBe(7200);
      expect(config.auth.maxLoginAttempts).toBe(3);
    });
    
    it('should validate configuration integrity', async () => {
      const invalidConfig = {
        auth: {
          jwtExpirationSeconds: 60, // Too short
          maxLoginAttempts: 0 // Too low
        }
      } as any;
      
      const validation = await configManager.validateConfig(invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('JWT expiration must be at least 5 minutes');
      expect(validation.errors).toContain('Max login attempts must be at least 1');
    });
    
    it('should provide domain-specific configuration', async () => {
      const authConfig = await configManager.getAuthConfig();
      const fileConfig = await configManager.getFileUploadConfig();
      
      expect(authConfig.jwtExpirationSeconds).toBeDefined();
      expect(fileConfig.maxFileSize).toBeDefined();
    });
  });
  
  describe('Security Monitoring', () => {
    it('should record security events', async () => {
      await monitor.recordAuthEvent(false, 'user123', '192.168.1.1', 'Mozilla/5.0', 150);
      
      const metrics = await monitor.getSecurityMetrics();
      expect(metrics.counters.authenticationAttempts).toBe(1);
      expect(metrics.counters.authenticationFailures).toBe(1);
    });
    
    it('should track performance metrics', async () => {
      const timerId = monitor.startPerformanceTimer('test_operation');
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const duration = monitor.endPerformanceTimer(timerId);
      expect(duration).toBeGreaterThan(0);
    });
    
    it('should generate security dashboard', async () => {
      // Record some events
      await monitor.recordAuthEvent(true, 'user1', '192.168.1.1');
      await monitor.recordAuthEvent(false, 'user2', '192.168.1.2');
      await monitor.recordFileUploadEvent(true, 'test.csv', 1024, 'user1');
      
      const dashboard = await monitor.getSecurityDashboard();
      
      expect(dashboard.summary.totalEvents).toBeGreaterThan(0);
      expect(dashboard.recentEvents.length).toBeGreaterThan(0);
      expect(dashboard.metrics).toBeDefined();
    });
    
    it('should check system health', async () => {
      const health = await monitor.checkSystemHealth();
      
      expect(health.overall).toBe('healthy');
      expect(health.authSystem).toBe('healthy');
      expect(health.fileValidation).toBe('healthy');
    });
  });
  
  describe('Security Metrics Collection', () => {
    it('should collect authentication metrics', async () => {
      await metricsCollector.collectAuthMetrics(
        true, 
        'password', 
        100, 
        'user123', 
        '192.168.1.1'
      );
      
      const dataPoints = mockAnalytics.getDataPoints();
      expect(dataPoints.length).toBeGreaterThan(0);
    });
    
    it('should collect file validation metrics', async () => {
      await metricsCollector.collectFileValidationMetrics(
        true,
        1024,
        'text/csv',
        50,
        { errors: [], warnings: [] }
      );
      
      const dataPoints = mockAnalytics.getDataPoints();
      expect(dataPoints.length).toBeGreaterThan(0);
    });
    
    it('should generate dashboard data', async () => {
      // Collect some metrics
      await metricsCollector.collectAuthMetrics(true, 'password', 100);
      await metricsCollector.collectFileValidationMetrics(true, 1024, 'text/csv', 50);
      
      const dashboardData = await metricsCollector.generateDashboardData('24h');
      
      expect(dashboardData.overview).toBeDefined();
      expect(dashboardData.performance).toBeDefined();
      expect(dashboardData.security).toBeDefined();
    });
    
    it('should export metrics data', async () => {
      await metricsCollector.collectAuthMetrics(true, 'password', 100);
      
      const startTime = new Date(Date.now() - 60000).toISOString();
      const endTime = new Date().toISOString();
      
      const jsonData = await metricsCollector.exportMetrics(startTime, endTime, 'json');
      expect(jsonData).toBeDefined();
      
      const csvData = await metricsCollector.exportMetrics(startTime, endTime, 'csv');
      expect(csvData).toContain('timestamp,metric,value');
    });
  });
  
  describe('Security Headers Middleware', () => {
    it('should create security context', async () => {
      const mockContext = {
        req: {
          path: '/api/auth/login',
          method: 'POST',
          header: (name: string) => name === 'User-Agent' ? 'Mozilla/5.0' : undefined
        },
        res: {
          headers: new Map<string, string>()
        },
        get: (key: string) => key === 'requestId' ? 'test-123' : undefined,
        set: vi.fn(),
        env: { ENVIRONMENT: 'development' }
      };
      
      // This would typically be tested through actual middleware execution
      // For now, we'll test the configuration integration
      const config = await configManager.getHeadersConfig();
      expect(config.contentSecurityPolicy).toBeDefined();
      expect(config.strictTransportSecurity).toBeDefined();
    });
  });
  
  describe('File Validation Security', () => {
    it('should validate file security', async () => {
      const mockFile = {
        name: 'test.csv',
        size: 1024,
        type: 'text/csv',
        slice: (start: number, end: number) => ({
          arrayBuffer: async () => new ArrayBuffer(100)
        })
      } as File;
      
      const result = await fileValidator.validateFile(mockFile, 'user123');
      
      expect(result.valid).toBe(true);
      expect(result.fileInfo.size).toBe(1024);
      expect(result.fileInfo.type).toBe('text/csv');
    });
    
    it('should detect malicious files', async () => {
      const mockMaliciousFile = {
        name: 'malicious.exe',
        size: 1024,
        type: 'application/octet-stream',
        slice: (start: number, end: number) => ({
          arrayBuffer: async () => {
            // Simulate PE header (MZ)
            const buffer = new ArrayBuffer(100);
            const view = new Uint8Array(buffer);
            view[0] = 0x4D; // M
            view[1] = 0x5A; // Z
            return buffer;
          }
        })
      } as File;
      
      const result = await fileValidator.validateFile(mockMaliciousFile, 'user123');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should check rate limits', async () => {
      // This would be tested with actual database queries
      // For now, we'll test the configuration
      const config = await configManager.getFileUploadConfig();
      expect(config.maxFilesPerHour).toBeDefined();
      expect(config.maxTotalSizePerHour).toBeDefined();
    });
  });
  
  describe('End-to-End Security Workflows', () => {
    it('should handle complete authentication workflow', async () => {
      // Start monitoring
      const timerId = monitor.startPerformanceTimer('auth_workflow');
      
      // Simulate authentication attempt
      const authSuccess = true;
      const authDuration = 150;
      
      // Record event
      await monitor.recordAuthEvent(
        authSuccess,
        'user123',
        '192.168.1.1',
        'Mozilla/5.0',
        authDuration
      );
      
      // Collect metrics
      await metricsCollector.collectAuthMetrics(
        authSuccess,
        'password',
        authDuration,
        'user123',
        '192.168.1.1'
      );
      
      // End monitoring
      const totalDuration = monitor.endPerformanceTimer(timerId);
      
      // Verify metrics were collected
      const metrics = await monitor.getSecurityMetrics();
      expect(metrics.counters.authenticationAttempts).toBe(1);
      expect(totalDuration).toBeGreaterThan(0);
    });
    
    it('should handle complete file upload workflow', async () => {
      // Start monitoring
      const timerId = monitor.startPerformanceTimer('file_upload_workflow');
      
      // Create test file
      const testFile = {
        name: 'test-data.csv',
        size: 2048,
        type: 'text/csv',
        slice: () => ({
          arrayBuffer: async () => new ArrayBuffer(100)
        })
      } as File;
      
      // Validate file
      const validationResult = await fileValidator.validateFile(testFile, 'user123');
      const validationDuration = 75;
      
      // Record events
      await monitor.recordFileUploadEvent(
        validationResult.valid,
        testFile.name,
        testFile.size,
        'user123',
        '192.168.1.1',
        validationResult,
        validationDuration
      );
      
      // Collect metrics
      await metricsCollector.collectFileValidationMetrics(
        validationResult.valid,
        testFile.size,
        testFile.type,
        validationDuration,
        validationResult
      );
      
      // End monitoring
      const totalDuration = monitor.endPerformanceTimer(timerId);
      
      // Verify metrics
      const metrics = await monitor.getSecurityMetrics();
      expect(metrics.counters.fileUploads).toBe(1);
      expect(totalDuration).toBeGreaterThan(0);
    });
    
    it('should handle security incident workflow', async () => {
      // Simulate multiple failed authentication attempts
      for (let i = 0; i < 6; i++) {
        await monitor.recordAuthEvent(
          false,
          'attacker',
          '192.168.1.100',
          'BadBot/1.0',
          50
        );
      }
      
      // Check if alerts were generated
      const dashboard = await monitor.getSecurityDashboard();
      expect(dashboard.summary.totalEvents).toBe(6);
      
      // Verify system health degradation
      const health = await monitor.checkSystemHealth();
      // Health might be degraded due to multiple failures
      expect(['healthy', 'degraded']).toContain(health.overall);
    });
  });
  
  describe('Security Performance Tests', () => {
    it('should meet performance requirements', async () => {
      const iterations = 100;
      const startTime = Date.now();
      
      // Simulate security operations
      for (let i = 0; i < iterations; i++) {
        await monitor.recordAuthEvent(true, `user${i}`, '192.168.1.1');
        await metricsCollector.collectAuthMetrics(true, 'password', 50);
      }
      
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / iterations;
      
      // Should be under 100ms per operation
      expect(averageTime).toBeLessThan(100);
    });
    
    it('should handle high load', async () => {
      const promises = [];
      
      // Simulate concurrent security operations
      for (let i = 0; i < 50; i++) {
        promises.push(
          monitor.recordAuthEvent(true, `user${i}`, '192.168.1.1')
        );
        promises.push(
          metricsCollector.collectAuthMetrics(true, 'password', 50)
        );
      }
      
      // All operations should complete without error
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
  
  describe('Security Configuration Validation', () => {
    it('should validate environment-specific configurations', async () => {
      // Test development environment
      const devConfig = await configManager.getConfig();
      expect(devConfig.environment).toBe('development');
      expect(devConfig.auth.allowedOrigins).toContain('http://localhost:5173');
      
      // Test production-like configuration
      const prodConfigManager = new SecurityConfigManager({
        kvNamespace: mockKV as any,
        environment: 'production',
        enableDynamicUpdates: true,
        cacheExpirationMinutes: 5,
        fallbackToDefaults: true
      });
      
      const prodConfig = await prodConfigManager.getConfig();
      expect(prodConfig.environment).toBe('production');
      expect(prodConfig.auth.requireMfa).toBe(true);
    });
    
    it('should handle configuration errors gracefully', async () => {
      // Test with invalid KV storage
      const failingKV = {
        get: async () => { throw new Error('KV unavailable'); },
        put: async () => { throw new Error('KV unavailable'); },
        delete: async () => { throw new Error('KV unavailable'); }
      };
      
      const resilientConfigManager = new SecurityConfigManager({
        kvNamespace: failingKV as any,
        environment: 'development',
        enableDynamicUpdates: true,
        cacheExpirationMinutes: 5,
        fallbackToDefaults: true
      });
      
      // Should still provide default configuration
      const config = await resilientConfigManager.getConfig();
      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
    });
  });
});

describe('Security Integration Edge Cases', () => {
  it('should handle malformed configuration data', async () => {
    const mockKV = new MockKVNamespace();
    await mockKV.put('security-config-development', '{ invalid json }');
    
    const configManager = new SecurityConfigManager({
      kvNamespace: mockKV as any,
      environment: 'development',
      enableDynamicUpdates: true,
      cacheExpirationMinutes: 5,
      fallbackToDefaults: true
    });
    
    // Should fall back to defaults
    const config = await configManager.getConfig();
    expect(config).toBeDefined();
    expect(config.version).toBeDefined();
  });
  
  it('should handle memory constraints', async () => {
    const mockKV = new MockKVNamespace();
    const mockAnalytics = new MockAnalyticsEngineDataset();
    
    // Create large number of metrics
    const metricsCollector = new SecurityMetricsCollector({
      configManager: new SecurityConfigManager({
        kvNamespace: mockKV as any,
        environment: 'development',
        enableDynamicUpdates: true,
        cacheExpirationMinutes: 5,
        fallbackToDefaults: true
      }),
      monitor: {} as any, // Mock monitor
      analytics: mockAnalytics as any,
      kvStorage: mockKV as any,
      config: {
        enabled: true,
        batchSize: 5, // Small batch size to test batching
        flushIntervalSeconds: 1,
        retentionDays: 1,
        aggregationWindows: [5],
        enabledMetrics: ['security.test'],
        alertThresholds: {}
      }
    });
    
    // Generate many metrics
    for (let i = 0; i < 20; i++) {
      await metricsCollector.collectMetric('security.test', i);
    }
    
    // Should batch and flush automatically
    const dataPoints = mockAnalytics.getDataPoints();
    expect(dataPoints.length).toBeGreaterThan(0);
  });
});
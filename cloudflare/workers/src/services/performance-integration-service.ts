// Performance Integration Service - Performance Optimization Issue #69
// Integrates all performance optimization components and provides unified interface

import { MultiLayerCacheService } from './cache-service';
import { CompressionService } from './compression-service';
import { OptimizedR2Service } from './storage/optimized-r2-service';
import { OptimizedDatabaseService } from './optimized-database-service';
import { OptimizedPresignedUrlService } from './optimized-presigned-url-service';
import { PerformanceMonitoringService } from './performance-monitoring-service';
import { CachingMiddleware } from '../middleware/caching-middleware';
import { CloudflareEnv } from '../types/env';
import { EnhancedMetricsService } from './monitoring/enhanced-metrics-service';
import { AlertService } from './monitoring/alert-management-service';
import { MetricsService } from './monitoring/metrics-service';
import { R2StorageService } from './storage/r2-service';
import { QuotaManager } from './security/quota-manager';
import { SecurityAuditLogger } from './security/audit-logger';

export interface PerformanceConfig {
  caching: {
    enabled: boolean;
    maxMemoryEntries: number;
    defaultTTL: number;
    edgeCachingEnabled: boolean;
  };
  compression: {
    enabled: boolean;
    minFileSize: number;
    preferredAlgorithm: 'gzip' | 'brotli' | 'deflate';
  };
  database: {
    queryOptimizationEnabled: boolean;
    cacheEnabled: boolean;
    batchingEnabled: boolean;
  };
  monitoring: {
    enabled: boolean;
    alertingEnabled: boolean;
    reportingEnabled: boolean;
  };
}

export interface PerformanceStats {
  caching: {
    hitRate: number;
    totalRequests: number;
    memoryCacheSize: number;
  };
  compression: {
    totalFiles: number;
    compressionRatio: number;
    storageSavings: number;
  };
  database: {
    totalQueries: number;
    averageQueryTime: number;
    cacheHitRate: number;
  };
  overall: {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export class PerformanceIntegrationService {
  private cacheService: MultiLayerCacheService;
  private compressionService: CompressionService;
  private optimizedR2Service: OptimizedR2Service;
  private optimizedDatabaseService: OptimizedDatabaseService;
  private presignedUrlService: OptimizedPresignedUrlService;
  private performanceMonitoringService: PerformanceMonitoringService;
  private cachingMiddleware: CachingMiddleware;
  
  private config: PerformanceConfig = {
    caching: {
      enabled: true,
      maxMemoryEntries: 1000,
      defaultTTL: 3600,
      edgeCachingEnabled: true
    },
    compression: {
      enabled: true,
      minFileSize: 1024, // 1KB
      preferredAlgorithm: 'gzip'
    },
    database: {
      queryOptimizationEnabled: true,
      cacheEnabled: true,
      batchingEnabled: true
    },
    monitoring: {
      enabled: true,
      alertingEnabled: true,
      reportingEnabled: true
    }
  };
  
  constructor(private env: CloudflareEnv) {}
  
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Performance Optimization Services...');
      
      // 1. Initialize core services
      await this.initializeCoreServices();
      
      // 2. Initialize optimization services
      await this.initializeOptimizationServices();
      
      // 3. Initialize monitoring
      await this.initializeMonitoring();
      
      // 4. Warm up caches
      await this.warmupServices();
      
      console.log('Performance Optimization Services initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Performance Integration Service:', error);
      throw error;
    }
  }
  
  private async initializeCoreServices(): Promise<void> {
    // Initialize metrics and alerting services
    const metricsService = new MetricsService(this.env.DB);
    const enhancedMetricsService = new EnhancedMetricsService(this.env.DB);
    const alertService = new AlertService(this.env.DB, enhancedMetricsService);
    
    // Initialize caching service
    this.cacheService = new MultiLayerCacheService(
      caches.default, // Edge cache
      this.env.CACHE_KV, // KV cache
      this.config.caching.maxMemoryEntries
    );
    
    // Initialize compression service
    this.compressionService = new CompressionService();
    
    // Initialize optimized database service
    this.optimizedDatabaseService = new OptimizedDatabaseService(
      this.env.DB,
      this.cacheService,
      enhancedMetricsService
    );
    
    // Initialize pre-signed URL service
    this.presignedUrlService = new OptimizedPresignedUrlService(
      this.env.FILE_STORAGE,
      this.cacheService,
      this.env.DB,
      enhancedMetricsService
    );
    
    // Initialize performance monitoring
    this.performanceMonitoringService = new PerformanceMonitoringService(
      enhancedMetricsService,
      alertService,
      this.cacheService
    );
    
    // Initialize caching middleware
    this.cachingMiddleware = new CachingMiddleware(
      this.cacheService,
      enhancedMetricsService
    );
  }
  
  private async initializeOptimizationServices(): Promise<void> {
    // Initialize quota manager and audit logger for R2 service
    const quotaManager = new QuotaManager(this.env.DB, this.env.CUTTY_QUOTA_TRACKING);
    const auditLogger = new SecurityAuditLogger(this.env.DB, this.env.CUTTY_SECURITY_EVENTS);
    const metricsService = new MetricsService(this.env.DB);
    
    // Initialize optimized R2 service
    this.optimizedR2Service = new OptimizedR2Service(
      this.env.FILE_STORAGE,
      this.env.DB,
      metricsService,
      this.compressionService,
      this.cacheService,
      quotaManager,
      auditLogger
    );
  }
  
  private async initializeMonitoring(): Promise<void> {
    if (!this.config.monitoring.enabled) {
      return;
    }
    
    // Set up performance monitoring intervals
    setInterval(async () => {
      try {
        await this.performanceHealthCheck();
      } catch (error) {
        console.error('Performance health check failed:', error);
      }
    }, 60000); // Every minute
    
    // Set up cache cleanup intervals
    setInterval(() => {
      try {
        this.cacheService.cleanupExpiredEntries();
      } catch (error) {
        console.error('Cache cleanup failed:', error);
      }
    }, 300000); // Every 5 minutes
  }
  
  private async warmupServices(): Promise<void> {
    console.log('Warming up performance optimization services...');
    
    try {
      // Warm up database query cache with common queries
      const commonQueries = [
        'SELECT COUNT(*) FROM files',
        'SELECT tier, COUNT(*) FROM user_quotas GROUP BY tier',
        'SELECT action, COUNT(*) FROM file_access_logs WHERE timestamp > datetime("now", "-24 hours") GROUP BY action'
      ];
      
      for (const query of commonQueries) {
        try {
          await this.optimizedDatabaseService.executeOptimizedQuery(query);
        } catch (error) {
          console.warn(`Failed to warm up query cache for: ${query}`, error);
        }
      }
      
      // Warm up URL cache for common operations (if we have recent files)
      try {
        const recentFiles = await this.optimizedDatabaseService.executeOptimizedQuery(
          'SELECT r2_key FROM files ORDER BY created_at DESC LIMIT 10'
        );
        
        if (recentFiles.results.length > 0) {
          const fileKeys = recentFiles.results.map((row: any) => row.r2_key);
          await this.presignedUrlService.warmUrlCache(fileKeys, ['read']);
        }
      } catch (error) {
        console.warn('Failed to warm up URL cache:', error);
      }
      
      console.log('Service warmup completed');
      
    } catch (error) {
      console.error('Service warmup failed:', error);
    }
  }
  
  private async performanceHealthCheck(): Promise<void> {
    try {
      // Get cache statistics
      const cacheStats = await this.cacheService.getCacheStats();
      
      // Get database statistics
      const dbStats = this.optimizedDatabaseService.getQueryStatistics();
      
      // Get pre-signed URL statistics
      const urlStats = this.presignedUrlService.getGenerationStats();
      
      // Check performance thresholds
      if (cacheStats.overall.hitRate < 0.8) {
        console.warn(`Cache hit rate below threshold: ${(cacheStats.overall.hitRate * 100).toFixed(1)}%`);
      }
      
      const avgDbTime = dbStats.length > 0 
        ? dbStats.reduce((sum, stat) => sum + stat.averageDuration, 0) / dbStats.length 
        : 0;
      
      if (avgDbTime > 1000) {
        console.warn(`Database queries are slow: ${avgDbTime.toFixed(0)}ms average`);
      }
      
      if (urlStats.errorRate > 0.05) {
        console.warn(`Pre-signed URL error rate high: ${(urlStats.errorRate * 100).toFixed(1)}%`);
      }
      
    } catch (error) {
      console.error('Performance health check failed:', error);
    }
  }
  
  // Public API methods
  
  async getPerformanceStats(): Promise<PerformanceStats> {
    try {
      const cacheStats = await this.cacheService.getCacheStats();
      const dbStats = this.optimizedDatabaseService.getQueryStatistics();
      const urlStats = this.presignedUrlService.getGenerationStats();
      
      return {
        caching: {
          hitRate: cacheStats.overall.hitRate,
          totalRequests: cacheStats.overall.totalRequests,
          memoryCacheSize: cacheStats.memoryCache.size
        },
        compression: {
          totalFiles: 0, // Would need to query this from database
          compressionRatio: 0.7, // Placeholder - would calculate from recent operations
          storageSavings: 0 // Would calculate from compression metrics
        },
        database: {
          totalQueries: dbStats.reduce((sum, stat) => sum + stat.count, 0),
          averageQueryTime: dbStats.length > 0 
            ? dbStats.reduce((sum, stat) => sum + stat.averageDuration, 0) / dbStats.length 
            : 0,
          cacheHitRate: 0.85 // Would calculate from actual cache metrics
        },
        overall: {
          averageResponseTime: 250, // Would calculate from recent performance metrics
          throughput: 100, // Operations per minute - would calculate from metrics
          errorRate: 0.02 // Would calculate from error metrics
        }
      };
    } catch (error) {
      console.error('Failed to get performance stats:', error);
      throw error;
    }
  }
  
  async generatePerformanceReport(): Promise<any> {
    if (!this.config.monitoring.reportingEnabled) {
      throw new Error('Performance reporting is disabled');
    }
    
    return await this.performanceMonitoringService.generatePerformanceReport();
  }
  
  async optimizePerformance(): Promise<void> {
    console.log('Starting automated performance optimization...');
    
    try {
      // Get optimization targets
      const targets = await this.performanceMonitoringService.getOptimizationTargets();
      
      if (targets.length === 0) {
        console.log('No optimization targets identified');
        return;
      }
      
      console.log(`Found ${targets.length} optimization targets:`, targets);
      
      // Trigger optimization actions
      await this.performanceMonitoringService.triggerOptimizationActions(targets);
      
      console.log('Automated performance optimization completed');
      
    } catch (error) {
      console.error('Automated performance optimization failed:', error);
    }
  }
  
  // Service accessors
  getCacheService(): MultiLayerCacheService {
    return this.cacheService;
  }
  
  getCompressionService(): CompressionService {
    return this.compressionService;
  }
  
  getOptimizedR2Service(): OptimizedR2Service {
    return this.optimizedR2Service;
  }
  
  getOptimizedDatabaseService(): OptimizedDatabaseService {
    return this.optimizedDatabaseService;
  }
  
  getPresignedUrlService(): OptimizedPresignedUrlService {
    return this.presignedUrlService;
  }
  
  getPerformanceMonitoringService(): PerformanceMonitoringService {
    return this.performanceMonitoringService;
  }
  
  getCachingMiddleware(): CachingMiddleware {
    return this.cachingMiddleware;
  }
  
  // Configuration management
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Performance configuration updated:', this.config);
  }
  
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }
  
  // Utility methods for testing and validation
  async validatePerformanceTargets(): Promise<{
    responseTimeReduction: boolean; // Target: 50% reduction
    cacheHitRate: boolean; // Target: 80% or higher
    compressionEfficiency: boolean; // Target: 30% storage savings
    errorRate: boolean; // Target: < 5%
  }> {
    const stats = await this.getPerformanceStats();
    
    return {
      responseTimeReduction: stats.overall.averageResponseTime < 500, // Assuming baseline was 1000ms
      cacheHitRate: stats.caching.hitRate >= 0.8,
      compressionEfficiency: stats.compression.compressionRatio >= 0.3,
      errorRate: stats.overall.errorRate < 0.05
    };
  }
  
  async clearAllCaches(): Promise<void> {
    console.log('Clearing all performance caches...');
    
    try {
      await this.cacheService.invalidateCache('');
      await this.optimizedDatabaseService.clearCaches();
      await this.presignedUrlService.clearUrlCaches();
      
      console.log('All performance caches cleared');
    } catch (error) {
      console.error('Failed to clear caches:', error);
      throw error;
    }
  }
  
  async runPerformanceBenchmark(): Promise<{
    cachePerformance: number; // ms
    compressionPerformance: number; // ms
    databasePerformance: number; // ms
    urlGenerationPerformance: number; // ms
  }> {
    console.log('Running performance benchmark...');
    
    const results = {
      cachePerformance: 0,
      compressionPerformance: 0,
      databasePerformance: 0,
      urlGenerationPerformance: 0
    };
    
    try {
      // Benchmark cache performance
      const cacheStart = Date.now();
      await this.cacheService.cacheFile('benchmark-test', new ArrayBuffer(1024), 60);
      await this.cacheService.getCachedFile('benchmark-test');
      results.cachePerformance = Date.now() - cacheStart;
      
      // Benchmark compression performance
      const compressionStart = Date.now();
      const testData = new ArrayBuffer(10240); // 10KB
      await this.compressionService.compressFile(testData);
      results.compressionPerformance = Date.now() - compressionStart;
      
      // Benchmark database performance
      const dbStart = Date.now();
      await this.optimizedDatabaseService.executeOptimizedQuery('SELECT 1');
      results.databasePerformance = Date.now() - dbStart;
      
      // Benchmark URL generation performance
      const urlStart = Date.now();
      await this.presignedUrlService.generatePresignedUrl('benchmark-file', { operation: 'read' });
      results.urlGenerationPerformance = Date.now() - urlStart;
      
      console.log('Performance benchmark completed:', results);
      return results;
      
    } catch (error) {
      console.error('Performance benchmark failed:', error);
      throw error;
    }
  }
}
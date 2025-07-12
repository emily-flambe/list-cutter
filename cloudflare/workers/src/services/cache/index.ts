// Cache Services Index - Performance Optimization Issue #69
// Exports all cache services and utilities

export { MultiLayerCacheService } from './multi-layer-cache';
export { MemoryCacheService } from './memory-cache';
export { EdgeCacheService } from './edge-cache';
export { HybridCacheService } from './hybrid-cache';
export { CacheFactory, type CacheConfiguration, type CacheServiceOptions } from './cache-factory';

// Re-export types from the main types file
export type {
  CacheService,
  CacheEntry,
  CacheStats,
  CompressionOptions,
  CompressionResult,
  OptimizedFile,
  FileOptimizationMetadata,
  PerformanceMetrics,
  PerformanceReport,
  TrendData,
  PerformanceRecommendation
} from '../../types/cache';

// Utility function to create a cache service with intelligent defaults
export function createOptimalCacheService(
  environment: 'development' | 'staging' | 'production' = 'production',
  options: {
    edgeCache?: Cache;
    kvNamespace?: KVNamespace;
    metricsService?: any;
    workloadType?: 'read-heavy' | 'write-heavy' | 'balanced' | 'large-files';
  } = {}
): CacheService {
  if (options.workloadType) {
    return CacheFactory.createOptimizedForWorkload(options.workloadType, options);
  }
  
  return CacheFactory.createForEnvironment(environment, options);
}

// Utility function to create cache service with metrics
export function createCacheServiceWithMetrics(
  metricsService: any,
  environment: 'development' | 'staging' | 'production' = 'production',
  options: Omit<CacheServiceOptions, 'metricsService'> = {}
): CacheService {
  const config = environment === 'production' 
    ? { type: 'hybrid' as const, enableCompression: true, maxMemoryEntries: 2000 }
    : environment === 'staging'
    ? { type: 'multilayer' as const, maxMemoryEntries: 1000 }
    : { type: 'memory' as const, maxMemoryEntries: 500 };

  return CacheFactory.createWithMetrics(config, metricsService, options);
}
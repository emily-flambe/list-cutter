// Cache Factory - Performance Optimization Issue #69
// Creates and configures different types of cache services based on environment and requirements

import { CacheService } from '../../types/cache';
import { MultiLayerCacheService } from './multi-layer-cache';
import { MemoryCacheService } from './memory-cache';
import { EdgeCacheService } from './edge-cache';
import { HybridCacheService } from './hybrid-cache';

export interface CacheConfiguration {
  type: 'memory' | 'edge' | 'multilayer' | 'hybrid';
  maxMemoryEntries?: number;
  defaultTTL?: number;
  enableKV?: boolean;
  enableEdge?: boolean;
  enableCompression?: boolean;
  compressionThreshold?: number;
  environment?: 'development' | 'staging' | 'production';
}

export interface CacheServiceOptions {
  edgeCache?: Cache;
  kvNamespace?: KVNamespace;
  maxMemoryEntries?: number;
  enableMetrics?: boolean;
  metricsService?: any;
}

export class CacheFactory {
  static create(config: CacheConfiguration, options: CacheServiceOptions = {}): CacheService {
    switch (config.type) {
      case 'memory':
        return new MemoryCacheService(
          config.maxMemoryEntries || 1000,
          config.defaultTTL || 300
        );
      
      case 'edge':
        if (!options.edgeCache) {
          throw new Error('Edge cache instance required for edge cache service');
        }
        return new EdgeCacheService(
          options.edgeCache,
          config.defaultTTL || 300
        );
      
      case 'multilayer':
        return new MultiLayerCacheService(
          options.edgeCache || caches.default,
          options.kvNamespace || null,
          config.maxMemoryEntries || 1000
        );
      
      case 'hybrid':
        return new HybridCacheService({
          edgeCache: options.edgeCache || caches.default,
          kvNamespace: options.kvNamespace || null,
          maxMemoryEntries: config.maxMemoryEntries || 1000,
          enableCompression: config.enableCompression || true,
          compressionThreshold: config.compressionThreshold || 1024, // 1KB
          metricsService: options.metricsService
        });
      
      default:
        throw new Error(`Unknown cache type: ${config.type}`);
    }
  }

  static createForEnvironment(
    environment: 'development' | 'staging' | 'production',
    options: CacheServiceOptions = {}
  ): CacheService {
    const configs = {
      development: {
        type: 'memory' as const,
        maxMemoryEntries: 500,
        defaultTTL: 60, // Shorter TTL for development
        enableKV: false,
        enableEdge: false
      },
      staging: {
        type: 'multilayer' as const,
        maxMemoryEntries: 1000,
        defaultTTL: 300,
        enableKV: true,
        enableEdge: true
      },
      production: {
        type: 'hybrid' as const,
        maxMemoryEntries: 2000,
        defaultTTL: 600,
        enableKV: true,
        enableEdge: true,
        enableCompression: true,
        compressionThreshold: 1024
      }
    };

    const config = configs[environment];
    return CacheFactory.create(config, options);
  }

  static createOptimizedForWorkload(
    workloadType: 'read-heavy' | 'write-heavy' | 'balanced' | 'large-files',
    options: CacheServiceOptions = {}
  ): CacheService {
    const configs = {
      'read-heavy': {
        type: 'multilayer' as const,
        maxMemoryEntries: 3000, // Larger memory cache
        defaultTTL: 1800, // Longer TTL
        enableKV: true,
        enableEdge: true
      },
      'write-heavy': {
        type: 'memory' as const,
        maxMemoryEntries: 1000, // Smaller cache, faster invalidation
        defaultTTL: 180, // Shorter TTL
        enableKV: false,
        enableEdge: false
      },
      'balanced': {
        type: 'hybrid' as const,
        maxMemoryEntries: 1500,
        defaultTTL: 600,
        enableKV: true,
        enableEdge: true,
        enableCompression: true
      },
      'large-files': {
        type: 'hybrid' as const,
        maxMemoryEntries: 500, // Fewer entries for large files
        defaultTTL: 3600, // Longer TTL for static content
        enableKV: true,
        enableEdge: true,
        enableCompression: true,
        compressionThreshold: 512 // Lower threshold for large files
      }
    };

    const config = configs[workloadType];
    return CacheFactory.create(config, options);
  }

  static createWithMetrics(
    baseConfig: CacheConfiguration,
    metricsService: any,
    options: CacheServiceOptions = {}
  ): CacheService {
    const enhancedOptions = {
      ...options,
      enableMetrics: true,
      metricsService
    };

    return CacheFactory.create(baseConfig, enhancedOptions);
  }

  // Utility method to determine optimal cache configuration based on runtime metrics
  static async createAdaptive(
    currentMetrics: {
      avgResponseTime: number;
      cacheHitRate: number;
      memoryUsage: number;
      requestVolume: number;
    },
    options: CacheServiceOptions = {}
  ): Promise<CacheService> {
    let config: CacheConfiguration;

    // Adaptive logic based on current performance metrics
    if (currentMetrics.cacheHitRate < 0.6) {
      // Low cache hit rate - need more aggressive caching
      config = {
        type: 'multilayer',
        maxMemoryEntries: 2000,
        defaultTTL: 900,
        enableKV: true,
        enableEdge: true
      };
    } else if (currentMetrics.avgResponseTime > 2000) {
      // High response time - optimize for speed
      config = {
        type: 'hybrid',
        maxMemoryEntries: 3000,
        defaultTTL: 1200,
        enableKV: true,
        enableEdge: true,
        enableCompression: true
      };
    } else if (currentMetrics.memoryUsage > 0.8) {
      // High memory usage - use edge/KV more
      config = {
        type: 'edge',
        maxMemoryEntries: 500,
        defaultTTL: 600,
        enableKV: true,
        enableEdge: true
      };
    } else if (currentMetrics.requestVolume > 1000) {
      // High volume - balanced approach
      config = {
        type: 'hybrid',
        maxMemoryEntries: 1500,
        defaultTTL: 600,
        enableKV: true,
        enableEdge: true,
        enableCompression: true
      };
    } else {
      // Normal conditions - standard multilayer
      config = {
        type: 'multilayer',
        maxMemoryEntries: 1000,
        defaultTTL: 300,
        enableKV: true,
        enableEdge: true
      };
    }

    return CacheFactory.create(config, options);
  }
}
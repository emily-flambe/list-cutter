// Optimized Pre-signed URL Service - Performance Optimization Issue #69
// Implements high-performance pre-signed URL generation with caching and batch operations

import { 
  CacheService, 
  PresignedUrlResult, 
  BatchPresignedUrlResult 
} from '../types/cache';
import { EnhancedMetricsService } from './monitoring/enhanced-metrics-service';

export interface PresignedUrlOptions {
  operation: 'read' | 'write' | 'delete';
  expiresIn?: number; // seconds
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
  cacheEnabled?: boolean;
  customDomain?: string;
}

export interface BatchPresignedUrlOptions extends Omit<PresignedUrlOptions, 'operation'> {
  operations: Array<{
    fileKey: string;
    operation: 'read' | 'write' | 'delete';
    options?: Partial<PresignedUrlOptions>;
  }>;
  concurrency?: number;
}

export interface PresignedUrlStats {
  totalGenerated: number;
  cacheHitRate: number;
  averageGenerationTime: number;
  batchOperations: number;
  errorRate: number;
}

export class OptimizedPresignedUrlService {
  private urlCache: Map<string, { url: string; expiresAt: Date; timestamp: number }> = new Map();
  private generationStats = {
    total: 0,
    cached: 0,
    errors: 0,
    totalTime: 0,
    batchOps: 0
  };
  
  constructor(
    private r2Bucket: R2Bucket,
    private cacheService: CacheService,
    private db: D1Database,
    private metricsService: EnhancedMetricsService
  ) {}
  
  async generatePresignedUrl(
    fileKey: string, 
    options: PresignedUrlOptions
  ): Promise<PresignedUrlResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(fileKey, options);
    
    try {
      this.generationStats.total++;
      
      // 1. Check cache for existing valid URL (if caching enabled)
      if (options.cacheEnabled !== false) {
        const cachedUrl = await this.getCachedUrl(cacheKey);
        if (cachedUrl && this.isUrlValid(cachedUrl)) {
          this.generationStats.cached++;
          await this.recordMetrics(fileKey, options, Date.now() - startTime, true);
          
          return {
            url: cachedUrl.url,
            expiresAt: cachedUrl.expiresAt,
            cached: true
          };
        }
      }
      
      // 2. Generate new pre-signed URL
      const expiresIn = options.expiresIn || 3600; // Default 1 hour
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      
      let url: string;
      
      switch (options.operation) {
        case 'read':
          url = await this.generateReadUrl(fileKey, options, expiresIn);
          break;
        case 'write':
          url = await this.generateWriteUrl(fileKey, options, expiresIn);
          break;
        case 'delete':
          url = await this.generateDeleteUrl(fileKey, options, expiresIn);
          break;
        default:
          throw new Error(`Unsupported operation: ${options.operation}`);
      }
      
      const result: PresignedUrlResult = {
        url,
        expiresAt,
        cached: false
      };
      
      // 3. Cache the URL (with shorter TTL than expiration for safety)
      if (options.cacheEnabled !== false) {
        const cacheTTL = Math.min(expiresIn * 0.8, 1800); // 80% of expiration or 30 minutes max
        await this.cacheUrl(cacheKey, result, cacheTTL);
      }
      
      // 4. Record performance metrics
      await this.recordMetrics(fileKey, options, Date.now() - startTime, false);
      
      return result;
      
    } catch (error) {
      this.generationStats.errors++;
      console.error('Pre-signed URL generation failed:', error);
      
      return {
        url: '',
        expiresAt: new Date(),
        cached: false,
        error: error.message
      };
    }
  }
  
  async generateBatchPresignedUrls(
    batchOptions: BatchPresignedUrlOptions
  ): Promise<BatchPresignedUrlResult> {
    const startTime = Date.now();
    const results: Record<string, PresignedUrlResult> = {};
    const concurrency = batchOptions.concurrency || 10;
    
    try {
      this.generationStats.batchOps++;
      
      // Process URLs in parallel batches for optimal performance
      const operations = batchOptions.operations;
      const batches: Array<typeof operations> = [];
      
      // Split into batches
      for (let i = 0; i < operations.length; i += concurrency) {
        batches.push(operations.slice(i, i + concurrency));
      }
      
      // Process each batch
      for (const batch of batches) {
        const batchPromises = batch.map(async (op) => {
          try {
            const mergedOptions: PresignedUrlOptions = {
              ...batchOptions,
              ...op.options,
              operation: op.operation
            };
            
            const result = await this.generatePresignedUrl(op.fileKey, mergedOptions);
            results[op.fileKey] = result;
          } catch (error) {
            results[op.fileKey] = {
              error: error.message,
              url: '',
              expiresAt: new Date(),
              cached: false
            };
          }
        });
        
        await Promise.all(batchPromises);
      }
      
      const processingTime = Date.now() - startTime;
      const successCount = Object.values(results).filter(r => !r.error).length;
      const cachedCount = Object.values(results).filter(r => r.cached).length;
      
      const batchResult: BatchPresignedUrlResult = {
        results,
        totalCount: operations.length,
        successCount,
        errorCount: operations.length - successCount,
        processingTime,
        cached: cachedCount
      };
      
      // Record batch metrics
      await this.recordBatchMetrics(batchResult);
      
      return batchResult;
      
    } catch (error) {
      console.error('Batch pre-signed URL generation failed:', error);
      
      // Return error results for all requested URLs
      for (const op of batchOptions.operations) {
        results[op.fileKey] = {
          error: error.message,
          url: '',
          expiresAt: new Date(),
          cached: false
        };
      }
      
      return {
        results,
        totalCount: batchOptions.operations.length,
        successCount: 0,
        errorCount: batchOptions.operations.length,
        processingTime: Date.now() - startTime,
        cached: 0
      };
    }
  }
  
  private async generateReadUrl(
    fileKey: string, 
    options: PresignedUrlOptions, 
    expiresIn: number
  ): Promise<string> {
    // For read operations, generate a direct R2 URL
    // Note: Actual implementation would depend on R2 API capabilities
    
    // Check if file exists first
    const fileExists = await this.checkFileExists(fileKey);
    if (!fileExists) {
      throw new Error(`File not found: ${fileKey}`);
    }
    
    // Generate signed URL for reading
    const baseUrl = options.customDomain || 'https://r2.emilycogsdill.com';
    const timestamp = Math.floor(Date.now() / 1000);
    const expires = timestamp + expiresIn;
    
    // Create a simple signed URL (this is a simplified implementation)
    // In production, you'd use proper R2 pre-signed URL generation
    const signature = await this.createSignature(fileKey, expires, 'GET');
    const url = `${baseUrl}/${fileKey}?expires=${expires}&signature=${signature}`;
    
    return url;
  }
  
  private async generateWriteUrl(
    fileKey: string, 
    options: PresignedUrlOptions, 
    expiresIn: number
  ): Promise<string> {
    // Generate pre-signed URL for uploads
    const baseUrl = options.customDomain || 'https://r2.emilycogsdill.com';
    const timestamp = Math.floor(Date.now() / 1000);
    const expires = timestamp + expiresIn;
    
    // Create upload URL with appropriate parameters
    const urlParams = new URLSearchParams();
    urlParams.set('expires', expires.toString());
    
    if (options.contentType) {
      urlParams.set('content-type', options.contentType);
    }
    
    if (options.contentLength) {
      urlParams.set('content-length', options.contentLength.toString());
    }
    
    // Add metadata as URL parameters
    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        urlParams.set(`metadata-${key}`, value);
      }
    }
    
    const signature = await this.createSignature(fileKey, expires, 'PUT');
    urlParams.set('signature', signature);
    
    const url = `${baseUrl}/upload/${fileKey}?${urlParams.toString()}`;
    return url;
  }
  
  private async generateDeleteUrl(
    fileKey: string, 
    options: PresignedUrlOptions, 
    expiresIn: number
  ): Promise<string> {
    // Generate pre-signed URL for deletions
    const baseUrl = options.customDomain || 'https://r2.emilycogsdill.com';
    const timestamp = Math.floor(Date.now() / 1000);
    const expires = timestamp + expiresIn;
    
    const signature = await this.createSignature(fileKey, expires, 'DELETE');
    const url = `${baseUrl}/${fileKey}?expires=${expires}&signature=${signature}&method=DELETE`;
    
    return url;
  }
  
  private async createSignature(fileKey: string, expires: number, method: string): Promise<string> {
    // Simplified signature generation - in production, use proper cryptographic signing
    const data = `${method}:${fileKey}:${expires}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Use crypto.subtle for proper signing
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return hashHex.substring(0, 16); // Truncate for example
  }
  
  private async checkFileExists(fileKey: string): Promise<boolean> {
    try {
      const fileObject = await this.r2Bucket.head(fileKey);
      return fileObject !== null;
    } catch (error) {
      return false;
    }
  }
  
  private generateCacheKey(fileKey: string, options: PresignedUrlOptions): string {
    const keyComponents = [
      'presigned',
      fileKey,
      options.operation,
      options.expiresIn || 3600,
      options.contentType || '',
      options.customDomain || 'default'
    ];
    
    return keyComponents.join(':')
      .replace(/[^a-zA-Z0-9:\-_]/g, '_')
      .substring(0, 256);
  }
  
  private async getCachedUrl(cacheKey: string): Promise<{ url: string; expiresAt: Date } | null> {
    try {
      // Check memory cache first
      const memoryResult = this.urlCache.get(cacheKey);
      if (memoryResult && this.isUrlValid(memoryResult)) {
        return memoryResult;
      }
      
      // Check distributed cache
      const cachedResult = await this.cacheService.getCachedQuery(cacheKey);
      if (cachedResult && this.isUrlValid(cachedResult)) {
        // Populate memory cache
        this.urlCache.set(cacheKey, {
          url: cachedResult.url,
          expiresAt: new Date(cachedResult.expiresAt),
          timestamp: Date.now()
        });
        
        return cachedResult;
      }
      
      return null;
    } catch (error) {
      console.error('URL cache retrieval failed:', error);
      return null;
    }
  }
  
  private async cacheUrl(
    cacheKey: string, 
    result: PresignedUrlResult, 
    ttl: number
  ): Promise<void> {
    try {
      const cacheData = {
        url: result.url,
        expiresAt: result.expiresAt.toISOString()
      };
      
      // Cache in distributed cache
      await this.cacheService.cacheQuery(cacheKey, cacheData, ttl);
      
      // Cache in memory for faster access
      this.urlCache.set(cacheKey, {
        url: result.url,
        expiresAt: result.expiresAt,
        timestamp: Date.now()
      });
      
      // Cleanup old memory cache entries
      this.cleanupMemoryCache();
      
    } catch (error) {
      console.error('URL caching failed:', error);
    }
  }
  
  private isUrlValid(urlData: { url: string; expiresAt: Date | string }): boolean {
    const expiresAt = typeof urlData.expiresAt === 'string' 
      ? new Date(urlData.expiresAt) 
      : urlData.expiresAt;
    
    return expiresAt > new Date();
  }
  
  private cleanupMemoryCache(): void {
    if (this.urlCache.size <= 1000) return; // Only cleanup if cache is large
    
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.urlCache.entries()) {
      // Remove expired entries
      if (!this.isUrlValid(entry)) {
        keysToDelete.push(key);
      }
      // Remove entries older than 1 hour
      else if (now - entry.timestamp > 3600000) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.urlCache.delete(key);
    }
    
    // If still too large, remove oldest entries
    if (this.urlCache.size > 1000) {
      const entries = Array.from(this.urlCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.urlCache.size - 800); // Keep newest 800
      for (const [key] of toRemove) {
        this.urlCache.delete(key);
      }
    }
  }
  
  private async recordMetrics(
    fileKey: string, 
    options: PresignedUrlOptions, 
    duration: number, 
    cached: boolean
  ): Promise<void> {
    try {
      this.generationStats.totalTime += duration;
      
      await this.metricsService.recordCustomMetric('presigned_url_generation', {
        fileKey,
        operation: options.operation,
        duration,
        cached,
        expiresIn: options.expiresIn || 3600,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to record pre-signed URL metrics:', error);
    }
  }
  
  private async recordBatchMetrics(result: BatchPresignedUrlResult): Promise<void> {
    try {
      await this.metricsService.recordCustomMetric('presigned_url_batch', {
        totalCount: result.totalCount,
        successCount: result.successCount,
        errorCount: result.errorCount,
        processingTime: result.processingTime,
        cacheHitRate: result.cached / result.totalCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to record batch pre-signed URL metrics:', error);
    }
  }
  
  // Public method to get generation statistics
  getGenerationStats(): PresignedUrlStats {
    const { total, cached, errors, totalTime, batchOps } = this.generationStats;
    
    return {
      totalGenerated: total,
      cacheHitRate: total > 0 ? cached / total : 0,
      averageGenerationTime: total > 0 ? totalTime / total : 0,
      batchOperations: batchOps,
      errorRate: total > 0 ? errors / total : 0
    };
  }
  
  // Utility method for cache warming
  async warmUrlCache(
    fileKeys: string[], 
    operations: Array<'read' | 'write' | 'delete'> = ['read'],
    options: Partial<PresignedUrlOptions> = {}
  ): Promise<void> {
    console.log(`Warming URL cache for ${fileKeys.length} files`);
    
    const warmupOperations = [];
    for (const fileKey of fileKeys) {
      for (const operation of operations) {
        warmupOperations.push({
          fileKey,
          operation,
          options: { ...options, cacheEnabled: true }
        });
      }
    }
    
    // Warm cache in batches
    const batchSize = 20;
    for (let i = 0; i < warmupOperations.length; i += batchSize) {
      const batch = warmupOperations.slice(i, i + batchSize);
      
      await this.generateBatchPresignedUrls({
        operations: batch,
        cacheEnabled: true,
        concurrency: 10
      });
    }
    
    console.log('URL cache warming completed');
  }
  
  // Clear all URL caches
  async clearUrlCaches(): Promise<void> {
    this.urlCache.clear();
    await this.cacheService.invalidateCache('presigned:');
  }
}
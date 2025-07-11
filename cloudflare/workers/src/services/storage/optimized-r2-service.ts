// Optimized R2 Service - Performance Optimization Issue #69
// Extends R2StorageService with compression, caching, and performance optimizations

import { R2StorageService, FileUploadOptions, UploadResult } from './r2-service';
import { CompressionService } from '../compression-service';
import { CacheService } from '../../types/cache';
import { 
  OptimizedFile, 
  FormDataResult, 
  FileOptimizationMetadata 
} from '../../types/cache';
import { MetricsService } from '../monitoring/metrics-service';
import { QuotaManager } from '../security/quota-manager';
import { SecurityAuditLogger } from '../security/audit-logger';

export interface OptimizedUploadOptions extends FileUploadOptions {
  enableCompression?: boolean;
  compressionLevel?: number;
  skipCache?: boolean;
}

export interface OptimizedUploadResult extends UploadResult {
  metadata: FileOptimizationMetadata;
  compressionSavings?: number;
  cacheWarmed?: boolean;
}

export class OptimizedR2Service extends R2StorageService {
  constructor(
    r2Bucket: R2Bucket,
    db: D1Database,
    metricsService: MetricsService,
    private compressionService: CompressionService,
    private cacheService: CacheService,
    quotaManager?: QuotaManager,
    auditLogger?: SecurityAuditLogger
  ) {
    super(r2Bucket, db, metricsService, quotaManager, auditLogger);
  }
  
  async uploadFileOptimized(
    fileData: ArrayBuffer | File,
    options: OptimizedUploadOptions,
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ): Promise<OptimizedUploadResult> {
    const startTime = Date.now();
    
    try {
      // 1. Parse and validate file
      const file = await this.processFileInput(fileData, options);
      
      // 2. Optimize file (compression if beneficial)
      const optimizedFile = await this.optimizeFile(file, options);
      
      // 3. Perform optimized upload
      const uploadResult = await this.performOptimizedUpload(optimizedFile, options, context);
      
      // 4. Cache file metadata and content if appropriate
      if (!options.skipCache) {
        await this.cacheFileData(uploadResult, optimizedFile);
      }
      
      // 5. Record performance metrics
      await this.recordOptimizedUploadMetrics(uploadResult, Date.now() - startTime, optimizedFile);
      
      return {
        ...uploadResult,
        metadata: optimizedFile.metadata,
        compressionSavings: optimizedFile.metadata.isCompressed 
          ? optimizedFile.metadata.originalSize - optimizedFile.metadata.optimizedSize 
          : 0,
        cacheWarmed: !options.skipCache
      };
      
    } catch (error) {
      console.error('Optimized upload failed:', error);
      
      // Fallback to standard upload if optimization fails
      console.log('Falling back to standard upload');
      const fallbackResult = await this.uploadFile(
        fileData instanceof File ? await fileData.arrayBuffer() : fileData,
        options,
        context
      );
      
      return {
        ...fallbackResult,
        metadata: {
          originalSize: fallbackResult.size,
          mimeType: options.contentType,
          isCompressed: false,
          optimizedSize: fallbackResult.size,
          filename: options.fileName
        },
        compressionSavings: 0,
        cacheWarmed: false
      };
    }
  }
  
  async downloadFileOptimized(fileKey: string, userId?: string): Promise<Response> {
    const startTime = Date.now();
    
    try {
      // 1. Check cache first
      const cachedFile = await this.cacheService.getCachedFile(fileKey);
      if (cachedFile) {
        await this.recordDownloadMetrics(fileKey, Date.now() - startTime, true);
        
        return new Response(cachedFile, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Cache': 'HIT',
            'X-Performance-Optimized': 'true'
          }
        });
      }
      
      // 2. Get file metadata from database
      const metadata = await this.getFileMetadata(fileKey);
      if (!metadata) {
        return new Response('File not found', { status: 404 });
      }
      
      // 3. Get file from R2
      const fileObject = await this.bucket.get(fileKey);
      if (!fileObject) {
        return new Response('File not found in storage', { status: 404 });
      }
      
      // 4. Process file data (decompress if needed)
      let responseData: ArrayBuffer | ReadableStream = fileObject.body;
      let contentLength = metadata.originalSize;
      
      if (metadata.isCompressed && metadata.compressionAlgorithm) {
        // Decompress file
        const compressedData = await fileObject.arrayBuffer();
        responseData = await this.compressionService.decompressFile(
          compressedData,
          metadata.compressionAlgorithm
        );
        contentLength = (responseData as ArrayBuffer).byteLength;
      }
      
      // 5. Cache the decompressed file for future requests
      if (responseData instanceof ArrayBuffer) {
        await this.cacheService.cacheFile(fileKey, responseData, 3600); // 1 hour
      }
      
      // 6. Create optimized response
      const headers: Record<string, string> = {
        'Content-Type': metadata.mimeType || 'application/octet-stream',
        'Content-Length': contentLength.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'MISS',
        'X-Performance-Optimized': 'true'
      };
      
      if (metadata.isCompressed) {
        headers['X-Original-Size'] = metadata.originalSize.toString();
        headers['X-Compression-Algorithm'] = metadata.compressionAlgorithm || '';
        headers['X-Compression-Ratio'] = (metadata.compressionRatio || 1).toString();
      }
      
      // 7. Record performance metrics
      await this.recordDownloadMetrics(fileKey, Date.now() - startTime, false);
      
      return new Response(responseData, { headers });
      
    } catch (error) {
      console.error('Optimized download failed:', error);
      
      // Fallback to basic R2 get
      try {
        const fileObject = await this.bucket.get(fileKey);
        if (!fileObject) {
          return new Response('File not found', { status: 404 });
        }
        
        return new Response(fileObject.body, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Cache': 'MISS',
            'X-Performance-Optimized': 'false',
            'X-Fallback': 'true'
          }
        });
      } catch (fallbackError) {
        console.error('Fallback download failed:', fallbackError);
        return new Response('Download failed', { status: 500 });
      }
    }
  }
  
  private async processFileInput(
    fileData: ArrayBuffer | File,
    options: OptimizedUploadOptions
  ): Promise<{ data: ArrayBuffer; name: string; type: string; size: number }> {
    if (fileData instanceof File) {
      return {
        data: await fileData.arrayBuffer(),
        name: fileData.name || options.fileName,
        type: fileData.type || options.contentType,
        size: fileData.size
      };
    } else {
      return {
        data: fileData,
        name: options.fileName,
        type: options.contentType,
        size: fileData.byteLength
      };
    }
  }
  
  private async optimizeFile(
    file: { data: ArrayBuffer; name: string; type: string; size: number },
    options: OptimizedUploadOptions
  ): Promise<OptimizedFile> {
    // 1. Determine if compression should be applied
    const shouldCompress = options.enableCompression !== false && file.size > 1024; // > 1KB
    
    let optimizedData = file.data;
    let compressionMetadata = {
      isCompressed: false,
      compressionAlgorithm: undefined as string | undefined,
      compressionRatio: 1
    };
    
    if (shouldCompress) {
      try {
        const compressionResult = await this.compressionService.compressFile(file.data, {
          contentType: file.type
        });
        
        if (compressionResult.success && compressionResult.data) {
          optimizedData = compressionResult.data;
          compressionMetadata = {
            isCompressed: true,
            compressionAlgorithm: compressionResult.algorithm,
            compressionRatio: compressionResult.compressionRatio
          };
        }
      } catch (error) {
        console.warn('Compression failed, using original file:', error);
      }
    }
    
    // 2. Generate optimized metadata
    const metadata: FileOptimizationMetadata = {
      originalSize: file.size,
      mimeType: file.type,
      isCompressed: compressionMetadata.isCompressed,
      compressionAlgorithm: compressionMetadata.compressionAlgorithm,
      compressionRatio: compressionMetadata.compressionRatio,
      optimizedSize: optimizedData.byteLength,
      filename: file.name
    };
    
    return {
      data: optimizedData,
      metadata
    };
  }
  
  private async performOptimizedUpload(
    optimizedFile: OptimizedFile,
    options: OptimizedUploadOptions,
    context: any
  ): Promise<UploadResult> {
    // Use the parent class upload method with optimized data
    const uploadOptions: FileUploadOptions = {
      userId: options.userId,
      fileId: options.fileId,
      fileName: optimizedFile.metadata.filename || options.fileName,
      contentType: optimizedFile.metadata.mimeType,
      metadata: {
        ...options.metadata,
        originalSize: optimizedFile.metadata.originalSize.toString(),
        isCompressed: optimizedFile.metadata.isCompressed.toString(),
        compressionAlgorithm: optimizedFile.metadata.compressionAlgorithm || '',
        compressionRatio: optimizedFile.metadata.compressionRatio?.toString() || '1',
        optimizedSize: optimizedFile.metadata.optimizedSize.toString()
      }
    };
    
    return await this.uploadFile(optimizedFile.data, uploadOptions, context);
  }
  
  private async cacheFileData(uploadResult: UploadResult, optimizedFile: OptimizedFile): Promise<void> {
    try {
      // Cache file content for fast retrieval
      await this.cacheService.cacheFile(uploadResult.r2Key, optimizedFile.data, 3600);
      
      // Cache file metadata
      await this.cacheService.cacheMetadata(uploadResult.r2Key, {
        ...optimizedFile.metadata,
        r2Key: uploadResult.r2Key,
        fileId: uploadResult.fileId,
        etag: uploadResult.etag
      }, 7200); // 2 hours for metadata
      
    } catch (error) {
      console.warn('Failed to cache file data:', error);
      // Don't throw - caching failures shouldn't break uploads
    }
  }
  
  private async getFileMetadata(fileKey: string): Promise<FileOptimizationMetadata | null> {
    try {
      // Try cache first
      const cachedMetadata = await this.cacheService.getCachedMetadata(fileKey);
      if (cachedMetadata) {
        return cachedMetadata;
      }
      
      // Query database
      const result = await this.db.prepare(`
        SELECT 
          file_size as originalSize,
          mime_type as mimeType,
          metadata,
          r2_key
        FROM files 
        WHERE r2_key = ?
      `).bind(fileKey).first();
      
      if (!result) {
        return null;
      }
      
      // Parse metadata from JSON if stored as JSON
      let metadata: any = {};
      try {
        metadata = typeof result.metadata === 'string' 
          ? JSON.parse(result.metadata) 
          : result.metadata || {};
      } catch (error) {
        console.warn('Failed to parse file metadata:', error);
      }
      
      const fileMetadata: FileOptimizationMetadata = {
        originalSize: Number(metadata.originalSize) || Number(result.originalSize),
        mimeType: String(result.mimeType),
        isCompressed: metadata.isCompressed === 'true',
        compressionAlgorithm: metadata.compressionAlgorithm || undefined,
        compressionRatio: Number(metadata.compressionRatio) || 1,
        optimizedSize: Number(metadata.optimizedSize) || Number(result.originalSize)
      };
      
      // Cache the metadata
      await this.cacheService.cacheMetadata(fileKey, fileMetadata, 7200);
      
      return fileMetadata;
      
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return null;
    }
  }
  
  private async recordOptimizedUploadMetrics(
    uploadResult: UploadResult,
    duration: number,
    optimizedFile: OptimizedFile
  ): Promise<void> {
    try {
      const metrics = {
        operation: 'optimized_upload',
        fileSize: optimizedFile.metadata.originalSize,
        optimizedSize: optimizedFile.metadata.optimizedSize,
        duration,
        compressionRatio: optimizedFile.metadata.compressionRatio,
        compressionAlgorithm: optimizedFile.metadata.compressionAlgorithm,
        isCompressed: optimizedFile.metadata.isCompressed,
        savings: optimizedFile.metadata.originalSize - optimizedFile.metadata.optimizedSize,
        timestamp: new Date().toISOString()
      };
      
      await this.metricsService.recordCustomMetric('file_upload_optimized', metrics);
    } catch (error) {
      console.error('Failed to record upload metrics:', error);
    }
  }
  
  private async recordDownloadMetrics(
    fileKey: string,
    duration: number,
    cacheHit: boolean
  ): Promise<void> {
    try {
      const metrics = {
        operation: 'optimized_download',
        fileKey,
        duration,
        cacheHit,
        timestamp: new Date().toISOString()
      };
      
      await this.metricsService.recordCustomMetric('file_download_optimized', metrics);
    } catch (error) {
      console.error('Failed to record download metrics:', error);
    }
  }
  
  // Utility method for batch file optimization
  async optimizeExistingFiles(
    fileKeys: string[],
    options: { 
      batchSize?: number;
      enableCompression?: boolean;
      updateCache?: boolean;
    } = {}
  ): Promise<{
    processed: number;
    optimized: number;
    errors: number;
    totalSavings: number;
  }> {
    const batchSize = options.batchSize || 10;
    let processed = 0;
    let optimized = 0;
    let errors = 0;
    let totalSavings = 0;
    
    for (let i = 0; i < fileKeys.length; i += batchSize) {
      const batch = fileKeys.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (fileKey) => {
        try {
          const fileObject = await this.bucket.get(fileKey);
          if (!fileObject) {
            return { processed: true, optimized: false, error: true, savings: 0 };
          }
          
          const fileData = await fileObject.arrayBuffer();
          const metadata = await this.getFileMetadata(fileKey);
          
          if (!metadata || metadata.isCompressed) {
            return { processed: true, optimized: false, error: false, savings: 0 };
          }
          
          if (options.enableCompression) {
            const compressionResult = await this.compressionService.compressFile(fileData, {
              contentType: metadata.mimeType
            });
            
            if (compressionResult.success && compressionResult.data) {
              // Update the file in R2 with compressed version
              await this.bucket.put(fileKey, compressionResult.data);
              
              // Update metadata in cache
              if (options.updateCache) {
                const updatedMetadata = {
                  ...metadata,
                  isCompressed: true,
                  compressionAlgorithm: compressionResult.algorithm,
                  compressionRatio: compressionResult.compressionRatio,
                  optimizedSize: compressionResult.compressedSize
                };
                await this.cacheService.cacheMetadata(fileKey, updatedMetadata, 7200);
              }
              
              const savings = metadata.originalSize - compressionResult.compressedSize;
              return { processed: true, optimized: true, error: false, savings };
            }
          }
          
          return { processed: true, optimized: false, error: false, savings: 0 };
          
        } catch (error) {
          console.error(`Failed to optimize file ${fileKey}:`, error);
          return { processed: true, optimized: false, error: true, savings: 0 };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.processed) processed++;
        if (result.optimized) optimized++;
        if (result.error) errors++;
        totalSavings += result.savings;
      }
    }
    
    return { processed, optimized, errors, totalSavings };
  }
}
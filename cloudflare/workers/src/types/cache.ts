// Performance Optimization Cache Types - Issue #69

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export interface CacheService {
  // File content caching
  cacheFile(key: string, content: ArrayBuffer, ttl: number): Promise<void>;
  getCachedFile(key: string): Promise<ArrayBuffer | null>;
  
  // Database query caching
  cacheQuery(key: string, result: any, ttl: number): Promise<void>;
  getCachedQuery(key: string): Promise<any | null>;
  
  // Metadata caching
  cacheMetadata(key: string, metadata: any, ttl: number): Promise<void>;
  getCachedMetadata(key: string): Promise<any | null>;
  
  // Cache management
  invalidateCache(keyPattern: string): Promise<void>;
  getCacheStats(): Promise<CacheStats>;
}

export interface CacheStats {
  memoryCache: {
    size: number;
    hitRate: number;
    missRate: number;
    entries: number;
  };
  kvCache: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
  };
  edgeCache: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
  };
  overall: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
  };
}

export interface CompressionOptions {
  contentType?: string;
  algorithm?: 'gzip' | 'brotli' | 'lz4';
  level?: number;
}

export interface CompressionResult {
  success: boolean;
  data?: ArrayBuffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: string;
  compressionTime?: number;
  reason?: string;
}

export interface CompressionAlgorithm {
  name: string;
  compress(data: ArrayBuffer): Promise<ArrayBuffer>;
  decompress(data: ArrayBuffer): Promise<ArrayBuffer>;
}

export interface OptimizedFile {
  data: ArrayBuffer;
  metadata: FileOptimizationMetadata;
}

export interface FileOptimizationMetadata {
  originalSize: number;
  mimeType: string;
  isCompressed: boolean;
  compressionAlgorithm?: string;
  compressionRatio?: number;
  optimizedSize: number;
  filename?: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: Date;
  cached: boolean;
  error?: string;
}

export interface BatchPresignedUrlResult {
  results: Record<string, PresignedUrlResult>;
  totalCount: number;
  successCount: number;
  errorCount: number;
  processingTime: number;
  cached: number;
}

export interface PerformanceMetrics {
  operation: string;
  fileSize?: number;
  duration: number;
  cacheHit: boolean;
  compressionRatio?: number;
  timestamp: string;
  userId?: string;
  errorRate?: number;
  errors?: number;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalOperations: number;
    averageResponseTime: number;
    cacheHitRate: number;
    compressionEfficiency: number;
    throughput: number;
  };
  trends: {
    responseTimetrend: TrendData;
    cacheHitTrend: TrendData;
    errorRateTrend: TrendData;
  };
  recommendations: PerformanceRecommendation[];
}

export interface TrendData {
  direction: 'improving' | 'degrading' | 'stable';
  percentage: number;
  confidence: number;
}

export interface PerformanceRecommendation {
  type: 'response_time' | 'cache_optimization' | 'compression' | 'database' | 'network';
  priority: 'high' | 'medium' | 'low';
  message: string;
  details: string;
  estimatedImpact?: string;
}

export interface FileOperation {
  type: 'upload' | 'download' | 'delete' | 'list';
  fileSize?: number;
  duration: number;
  cacheHit: boolean;
  compressionRatio?: number;
  userId?: string;
  fileId?: string;
}

export interface QueryAnalysis {
  hasWhereClause: boolean;
  hasJoins: boolean;
  hasLimit: boolean;
  hasOrderBy: boolean;
  potentiallyLargeResult: boolean;
  whereColumns: string[];
  joinTables: string[];
  appliedOptimizations: string[];
}

export interface OptimizedQuery {
  sql: string;
  params: any[];
  optimizations: string[];
}

export interface FormDataResult {
  file: File;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  fileId: string;
  r2Key: string;
  metadata: FileOptimizationMetadata;
}

// Request handler type for middleware
export type RequestHandler = (request: Request) => Promise<Response>;
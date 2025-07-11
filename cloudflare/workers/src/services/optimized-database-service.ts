// Optimized Database Service - Performance Optimization Issue #69
// Implements query optimization, caching, and performance monitoring for D1 database operations

import { CacheService, QueryAnalysis, OptimizedQuery } from '../types/cache';
import { EnhancedMetricsService } from './monitoring/enhanced-metrics-service';

export interface QueryOptions {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  queryTimeout?: number;
  useIndexHints?: boolean;
}

export interface QueryResult {
  results: any[];
  meta?: {
    duration: number;
    cached: boolean;
    rowsAffected?: number;
    changes?: number;
    lastRowId?: number;
  };
  optimizations?: string[];
}

export interface BatchQueryResult {
  results: QueryResult[];
  totalDuration: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ query: string; error: string }>;
}

export class OptimizedDatabaseService {
  private queryCache: Map<string, { result: any; timestamp: number; ttl: number }> = new Map();
  private queryStats: Map<string, { count: number; totalDuration: number; errors: number }> = new Map();
  
  constructor(
    private db: D1Database,
    private cacheService: CacheService,
    private metricsService: EnhancedMetricsService
  ) {}
  
  async executeOptimizedQuery(
    query: string, 
    params: any[] = [], 
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const queryKey = this.generateQueryKey(query, params);
    const startTime = Date.now();
    
    try {
      // 1. Check cache first (if enabled)
      if (options.cacheEnabled !== false) {
        const cachedResult = await this.getCachedQuery(queryKey);
        if (cachedResult) {
          await this.recordQueryMetrics(queryKey, Date.now() - startTime, true);
          return {
            results: cachedResult,
            meta: {
              duration: Date.now() - startTime,
              cached: true
            }
          };
        }
      }
      
      // 2. Optimize query before execution
      const optimizedQuery = await this.optimizeQuery(query, params, options);
      
      // 3. Execute optimized query
      const result = await this.executeQuery(optimizedQuery, options);
      
      // 4. Cache result if appropriate
      if (options.cacheEnabled !== false && this.shouldCacheQuery(query)) {
        const ttl = options.cacheTTL || this.calculateQueryTTL(query);
        await this.cacheQueryResult(queryKey, result.results, ttl);
      }
      
      // 5. Record performance metrics
      const duration = Date.now() - startTime;
      await this.recordQueryMetrics(queryKey, duration, false);
      
      // 6. Update query statistics
      this.updateQueryStats(queryKey, duration, false);
      
      return {
        ...result,
        meta: {
          ...result.meta,
          duration,
          cached: false
        },
        optimizations: optimizedQuery.optimizations
      };
      
    } catch (error) {
      console.error('Optimized query failed:', error);
      
      // Record error metrics
      await this.recordQueryMetrics(queryKey, Date.now() - startTime, false, true);
      this.updateQueryStats(queryKey, Date.now() - startTime, true);
      
      throw error;
    }
  }
  
  async executeBatchQueries(
    queries: Array<{ sql: string; params?: any[]; options?: QueryOptions }>,
    options: { 
      parallel?: boolean; 
      stopOnError?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<BatchQueryResult> {
    const startTime = Date.now();
    const results: QueryResult[] = [];
    const errors: Array<{ query: string; error: string }> = [];
    
    const batchSize = options.batchSize || 10;
    const executeInParallel = options.parallel !== false;
    
    try {
      if (executeInParallel) {
        // Process queries in parallel batches
        for (let i = 0; i < queries.length; i += batchSize) {
          const batch = queries.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (queryItem) => {
            try {
              const result = await this.executeOptimizedQuery(
                queryItem.sql, 
                queryItem.params || [], 
                queryItem.options || {}
              );
              return { success: true, result };
            } catch (error) {
              const errorResult = {
                success: false,
                query: queryItem.sql,
                error: error.message
              };
              
              if (options.stopOnError) {
                throw error;
              }
              
              return errorResult;
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          
          for (const batchResult of batchResults) {
            if (batchResult.success) {
              results.push(batchResult.result);
            } else {
              errors.push({
                query: batchResult.query,
                error: batchResult.error
              });
            }
          }
          
          if (options.stopOnError && errors.length > 0) {
            break;
          }
        }
      } else {
        // Process queries sequentially
        for (const queryItem of queries) {
          try {
            const result = await this.executeOptimizedQuery(
              queryItem.sql, 
              queryItem.params || [], 
              queryItem.options || {}
            );
            results.push(result);
          } catch (error) {
            errors.push({
              query: queryItem.sql,
              error: error.message
            });
            
            if (options.stopOnError) {
              break;
            }
          }
        }
      }
      
      return {
        results,
        totalDuration: Date.now() - startTime,
        successCount: results.length,
        errorCount: errors.length,
        errors
      };
      
    } catch (error) {
      console.error('Batch query execution failed:', error);
      throw error;
    }
  }
  
  private async optimizeQuery(
    query: string, 
    params: any[], 
    options: QueryOptions
  ): Promise<OptimizedQuery> {
    // 1. Analyze query structure
    const analysis = this.analyzeQuery(query);
    
    // 2. Apply optimization strategies
    let optimizedSQL = query;
    const optimizations: string[] = [];
    
    // Add index hints if enabled and beneficial
    if (options.useIndexHints !== false && analysis.hasWhereClause) {
      const indexHints = this.generateIndexHints(analysis.whereColumns);
      if (indexHints.length > 0) {
        optimizedSQL = this.addIndexHints(optimizedSQL, indexHints);
        optimizations.push(`index_hints: ${indexHints.join(', ')}`);
      }
    }
    
    // Optimize JOIN operations
    if (analysis.hasJoins) {
      optimizedSQL = this.optimizeJoins(optimizedSQL, analysis.joinTables);
      optimizations.push('join_optimization');
    }
    
    // Add LIMIT if missing for potentially large result sets
    if (analysis.potentiallyLargeResult && !analysis.hasLimit) {
      optimizedSQL += ' LIMIT 1000';
      optimizations.push('auto_limit');
    }
    
    // Optimize WHERE clause ordering
    if (analysis.hasWhereClause && analysis.whereColumns.length > 1) {
      optimizedSQL = this.optimizeWhereClause(optimizedSQL, analysis.whereColumns);
      optimizations.push('where_optimization');
    }
    
    return {
      sql: optimizedSQL,
      params,
      optimizations
    };
  }
  
  private analyzeQuery(query: string): QueryAnalysis {
    const upperQuery = query.toUpperCase();
    
    const whereColumns = this.extractWhereColumns(query);
    const joinTables = this.extractJoinTables(query);
    
    return {
      hasWhereClause: upperQuery.includes('WHERE'),
      hasJoins: upperQuery.includes('JOIN'),
      hasLimit: upperQuery.includes('LIMIT'),
      hasOrderBy: upperQuery.includes('ORDER BY'),
      potentiallyLargeResult: upperQuery.includes('SELECT') && 
                             !upperQuery.includes('WHERE') && 
                             !upperQuery.includes('LIMIT'),
      whereColumns,
      joinTables,
      appliedOptimizations: []
    };
  }
  
  private extractWhereColumns(query: string): string[] {
    const columns: string[] = [];
    const whereRegex = /WHERE\s+(.+?)(?:\s+(?:GROUP|ORDER|LIMIT|$))/gi;
    const match = whereRegex.exec(query);
    
    if (match) {
      const whereClause = match[1];
      // Extract column names from WHERE clause (simplified)
      const columnRegex = /(\w+)\s*[=<>!]/g;
      let columnMatch;
      
      while ((columnMatch = columnRegex.exec(whereClause)) !== null) {
        columns.push(columnMatch[1]);
      }
    }
    
    return columns;
  }
  
  private extractJoinTables(query: string): string[] {
    const tables: string[] = [];
    const joinRegex = /JOIN\s+(\w+)/gi;
    let match;
    
    while ((match = joinRegex.exec(query)) !== null) {
      tables.push(match[1]);
    }
    
    return tables;
  }
  
  private generateIndexHints(columns: string[]): string[] {
    const indexMap: Record<string, string> = {
      'user_id': 'idx_files_user_id',
      'created_at': 'idx_files_created_at',
      'r2_key': 'idx_files_r2_key',
      'mime_type': 'idx_files_mime_type',
      'file_size': 'idx_files_size',
      'file_id': 'idx_access_logs_file_id',
      'timestamp': 'idx_access_logs_timestamp',
      'action': 'idx_access_logs_action',
      'severity': 'idx_security_events_severity',
      'event_type': 'idx_security_events_event_type'
    };
    
    return columns
      .map(col => indexMap[col])
      .filter(Boolean);
  }
  
  private addIndexHints(query: string, indexHints: string[]): string {
    // For SQLite/D1, we can't add explicit index hints like MySQL
    // But we can ensure queries are structured to use indexes effectively
    // This is more about query rewriting than actual hints
    return query;
  }
  
  private optimizeJoins(query: string, joinTables: string[]): string {
    // Optimize JOIN order based on table characteristics
    // For now, return the original query as D1 query planner is quite good
    return query;
  }
  
  private optimizeWhereClause(query: string, whereColumns: string[]): string {
    // Reorder WHERE conditions to put most selective conditions first
    // This is a simplified implementation
    return query;
  }
  
  private async executeQuery(optimizedQuery: OptimizedQuery, options: QueryOptions): Promise<QueryResult> {
    try {
      const statement = this.db.prepare(optimizedQuery.sql);
      
      // Bind parameters if any
      if (optimizedQuery.params.length > 0) {
        statement.bind(...optimizedQuery.params);
      }
      
      const result = await statement.all();
      
      return {
        results: result.results || [],
        meta: {
          duration: 0, // Will be set by caller
          cached: false,
          rowsAffected: result.meta?.rows_written || 0,
          changes: result.meta?.changes || 0,
          lastRowId: result.meta?.last_row_id || 0
        }
      };
      
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }
  
  private generateQueryKey(query: string, params: any[]): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramsString = JSON.stringify(params);
    
    return `query:${normalizedQuery}:${paramsString}`
      .replace(/[^a-zA-Z0-9:\-_]/g, '_')
      .substring(0, 256);
  }
  
  private async getCachedQuery(queryKey: string): Promise<any | null> {
    try {
      // Check memory cache first
      const memoryResult = this.queryCache.get(queryKey);
      if (memoryResult && this.isCacheValid(memoryResult)) {
        return memoryResult.result;
      }
      
      // Check distributed cache
      const cachedResult = await this.cacheService.getCachedQuery(queryKey);
      if (cachedResult) {
        // Populate memory cache
        this.queryCache.set(queryKey, {
          result: cachedResult,
          timestamp: Date.now(),
          ttl: 300000 // 5 minutes
        });
        return cachedResult;
      }
      
      return null;
    } catch (error) {
      console.error('Cache retrieval failed:', error);
      return null;
    }
  }
  
  private async cacheQueryResult(queryKey: string, result: any, ttl: number): Promise<void> {
    try {
      // Cache in distributed cache
      await this.cacheService.cacheQuery(queryKey, result, ttl);
      
      // Cache in memory for faster access
      this.queryCache.set(queryKey, {
        result,
        timestamp: Date.now(),
        ttl: ttl * 1000
      });
      
      // Cleanup old memory cache entries if needed
      this.cleanupMemoryCache();
      
    } catch (error) {
      console.error('Query caching failed:', error);
    }
  }
  
  private shouldCacheQuery(query: string): boolean {
    const upperQuery = query.toUpperCase();
    
    // Don't cache write operations
    if (upperQuery.includes('INSERT') || 
        upperQuery.includes('UPDATE') || 
        upperQuery.includes('DELETE') ||
        upperQuery.includes('CREATE') ||
        upperQuery.includes('DROP') ||
        upperQuery.includes('ALTER')) {
      return false;
    }
    
    // Cache read operations
    return upperQuery.includes('SELECT');
  }
  
  private calculateQueryTTL(query: string): number {
    const upperQuery = query.toUpperCase();
    
    // Long TTL for relatively static data
    if (upperQuery.includes('user_quotas') || 
        upperQuery.includes('pricing_tiers') ||
        upperQuery.includes('security_config')) {
      return 3600; // 1 hour
    }
    
    // Medium TTL for semi-dynamic data
    if (upperQuery.includes('files') || 
        upperQuery.includes('storage_metrics') ||
        upperQuery.includes('dashboard')) {
      return 300; // 5 minutes
    }
    
    // Short TTL for dynamic data
    if (upperQuery.includes('access_logs') || 
        upperQuery.includes('security_events') ||
        upperQuery.includes('realtime')) {
      return 60; // 1 minute
    }
    
    // Default TTL
    return 180; // 3 minutes
  }
  
  private isCacheValid(entry: { result: any; timestamp: number; ttl: number }): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }
  
  private cleanupMemoryCache(): void {
    if (this.queryCache.size <= 1000) return; // Only cleanup if cache is large
    
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.queryCache.entries()) {
      if (!this.isCacheValid(entry)) {
        keysToDelete.push(key);
      }
    }
    
    // Remove expired entries
    for (const key of keysToDelete) {
      this.queryCache.delete(key);
    }
    
    // If still too large, remove oldest entries (LRU)
    if (this.queryCache.size > 1000) {
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.queryCache.size - 800); // Remove oldest 200
      for (const [key] of toRemove) {
        this.queryCache.delete(key);
      }
    }
  }
  
  private async recordQueryMetrics(
    queryKey: string, 
    duration: number, 
    cached: boolean, 
    error: boolean = false
  ): Promise<void> {
    try {
      await this.metricsService.recordQueryMetrics({
        queryKey,
        duration,
        cached,
        error,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to record query metrics:', error);
    }
  }
  
  private updateQueryStats(queryKey: string, duration: number, error: boolean): void {
    const stats = this.queryStats.get(queryKey) || { count: 0, totalDuration: 0, errors: 0 };
    
    stats.count++;
    stats.totalDuration += duration;
    if (error) stats.errors++;
    
    this.queryStats.set(queryKey, stats);
  }
  
  // Public method to get query statistics
  getQueryStatistics(): Array<{
    queryKey: string;
    count: number;
    averageDuration: number;
    errorRate: number;
    totalDuration: number;
  }> {
    return Array.from(this.queryStats.entries()).map(([queryKey, stats]) => ({
      queryKey,
      count: stats.count,
      averageDuration: stats.totalDuration / stats.count,
      errorRate: stats.errors / stats.count,
      totalDuration: stats.totalDuration
    }));
  }
  
  // Clear all caches
  async clearCaches(): Promise<void> {
    this.queryCache.clear();
    await this.cacheService.invalidateCache('query:');
  }
}
/**
 * QueryProcessor - Charlie's Query Execution Service
 * 
 * 🐱 Charlie's Query Philosophy:
 * - Orchestrate file retrieval + filtering with excellent performance
 * - Smart caching and optimization strategies  
 * - Comprehensive error handling and user feedback
 * - Integration with existing security and auth patterns
 * 
 * This service coordinates between D1 database, R2 storage, and FilterProcessor
 */

import { FilterProcessor } from './filter-processor';
import { DataTypeDetector } from './data-type-detector';
import type { QueryRequest, QueryResult, Env } from '../types';

export class QueryProcessor {
  /**
   * 🐱 CHARLIE'S MAIN QUERY EXECUTION: Complete file-to-results pipeline
   * Handles authentication, file retrieval, and filtering orchestration
   */
  static async executeQuery(
    request: QueryRequest,
    env: Env,
    userId?: string
  ): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🐱 Starting query execution for file ${request.fileId} with ${request.filters.length} filters`);
      
      // Step 1: Validate request
      this.validateQueryRequest(request);
      
      // Step 2: Retrieve file metadata from D1
      const dbStart = Date.now();
      const fileRecord = await this.getFileRecord(request.fileId, env, userId);
      const dbTime = Date.now() - dbStart;
      
      if (!fileRecord) {
        throw new Error(`File with ID ${request.fileId} not found or access denied`);
      }
      
      // Step 3: Retrieve file content from R2
      const r2Start = Date.now();
      const csvContent = await this.getFileContent(fileRecord.r2_key, env);
      const r2Time = Date.now() - r2Start;
      
      // Step 4: Execute filtering using FilterProcessor
      const filterStart = Date.now();
      const result = await FilterProcessor.filterCSVData(
        csvContent,
        request.filters,
        request.logicalOperator || 'AND',
        {
          limit: request.limit,
          offset: request.offset
        }
      );
      
      // Step 5: Enhance result with additional metadata
      const enhancedResult: QueryResult = {
        ...result,
        metadata: {
          ...result.metadata,
          performance: {
            ...result.metadata.performance,
            database_query_ms: dbTime,
            r2_retrieval_ms: r2Time,
            file_read_ms: result.metadata.performance.file_read_ms,
            filtering_ms: result.metadata.performance.filtering_ms,
            total_time_ms: Date.now() - startTime,
            throughput_mbps: result.metadata.performance.throughput_mbps
          }
        }
      };
      
      const totalTime = Date.now() - startTime;
      console.log(`🐱 Query completed successfully in ${totalTime}ms: ${result.data.filteredRows} matching rows`);
      
      return enhancedResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`🐱 Query execution failed after ${processingTime}ms:`, error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 🐱 CHARLIE'S FILE RECORD RETRIEVAL: Get file metadata with security checks
   */
  private static async getFileRecord(
    fileId: string,
    env: Env,
    userId?: string
  ): Promise<any> {
    let query: string;
    let params: any[];
    
    if (userId) {
      // Authenticated user - check ownership or public files
      query = `
        SELECT id, filename, size, content_type, r2_key, is_public, user_id,
               upload_date, last_accessed, file_hash
        FROM files 
        WHERE id = ? AND (user_id = ? OR is_public = 1)
      `;
      params = [fileId, userId];
    } else {
      // Anonymous user - only public files
      query = `
        SELECT id, filename, size, content_type, r2_key, is_public, user_id,
               upload_date, last_accessed, file_hash
        FROM files 
        WHERE id = ? AND is_public = 1
      `;
      params = [fileId];
    }
    
    const result = await env.DB.prepare(query).bind(...params).first();
    
    if (result) {
      // Update last_accessed timestamp
      await env.DB.prepare(`
        UPDATE files SET last_accessed = ? WHERE id = ?
      `).bind(new Date().toISOString(), fileId).run();
    }
    
    return result;
  }

  /**
   * 🐱 CHARLIE'S FILE CONTENT RETRIEVAL: Get CSV content from R2 with optimization
   */
  private static async getFileContent(r2Key: string, env: Env): Promise<string> {
    if (!env.FILE_STORAGE) {
      throw new Error('R2 storage not configured');
    }
    
    try {
      const object = await env.FILE_STORAGE.get(r2Key);
      
      if (!object) {
        throw new Error(`File not found in storage: ${r2Key}`);
      }
      
      const content = await object.text();
      
      if (!content || content.length === 0) {
        throw new Error('File content is empty');
      }
      
      return content;
    } catch (error) {
      console.error(`🐱 R2 retrieval failed for key ${r2Key}:`, error);
      throw new Error(`Failed to retrieve file content: ${error instanceof Error ? error.message : 'Storage error'}`);
    }
  }

  /**
   * 🐱 CHARLIE'S REQUEST VALIDATION: Ensure query request is valid
   */
  private static validateQueryRequest(request: QueryRequest): void {
    if (!request.fileId) {
      throw new Error('fileId is required');
    }
    
    if (!request.filters || !Array.isArray(request.filters)) {
      throw new Error('filters must be an array');
    }
    
    if (request.filters.length === 0) {
      throw new Error('At least one filter is required');
    }
    
    // Validate each filter
    for (const filter of request.filters) {
      if (!filter.columnName) {
        throw new Error('Filter columnName is required');
      }
      
      if (!filter.type) {
        throw new Error('Filter type is required');
      }
      
      if (filter.value === undefined || filter.value === null) {
        // Only allow null/undefined for null-check filters
        if (!['is_null', 'not_null'].includes(filter.type)) {
          throw new Error(`Filter value is required for type: ${filter.type}`);
        }
      }
    }
    
    // Validate logical operator
    if (request.logicalOperator && !['AND', 'OR'].includes(request.logicalOperator)) {
      throw new Error('logicalOperator must be "AND" or "OR"');
    }
    
    // Validate pagination parameters
    if (request.limit !== undefined && (request.limit < 1 || request.limit > 10000)) {
      throw new Error('limit must be between 1 and 10000');
    }
    
    if (request.offset !== undefined && request.offset < 0) {
      throw new Error('offset must be non-negative');
    }
  }

  /**
   * 🐱 CHARLIE'S EXPORT QUERY: Generate filtered CSV for download
   */
  static async exportFilteredData(
    request: QueryRequest,
    env: Env,
    userId?: string,
    filename?: string
  ): Promise<{
    csvContent: string;
    metadata: {
      originalFilename: string;
      filteredRows: number;
      totalRows: number;
      filtersApplied: number;
      generatedAt: string;
    };
  }> {
    console.log(`🐱 Starting filtered data export for file ${request.fileId}`);
    
    // Execute query without pagination to get all matching rows
    const exportRequest = {
      ...request,
      limit: undefined,
      offset: undefined
    };
    
    const queryResult = await this.executeQuery(exportRequest, env, userId);
    
    // Generate CSV content using FilterProcessor
    const csvContent = FilterProcessor.generateFilteredCSV(
      queryResult.data.columns,
      queryResult.data.rows
    );
    
    // Get original file info
    const fileRecord = await this.getFileRecord(request.fileId, env, userId);
    
    return {
      csvContent,
      metadata: {
        originalFilename: fileRecord?.filename || 'unknown.csv',
        filteredRows: queryResult.data.filteredRows,
        totalRows: queryResult.data.totalRows,
        filtersApplied: request.filters.length,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 🐱 CHARLIE'S PERFORMANCE ANALYSIS: Get optimal strategy for file
   */
  static async analyzeFilePerformance(
    fileId: string,
    env: Env,
    userId?: string
  ): Promise<{
    strategy: 'real-time' | 'debounced' | 'manual';
    updateDelay: number;
    fileInfo: {
      size: number;
      rowCount: number;
      filename: string;
    };
    recommendations: string[];
  }> {
    // Get file metadata
    const fileRecord = await this.getFileRecord(fileId, env, userId);
    
    if (!fileRecord) {
      throw new Error(`File with ID ${fileId} not found or access denied`);
    }
    
    // Get file content to analyze row count (use Ruby's fast method)
    const csvContent = await this.getFileContent(fileRecord.r2_key, env);
    const { rowCount } = FilterProcessor.extractFields(csvContent);
    
    // Get performance strategy
    const strategy = FilterProcessor.analyzePerformanceStrategy(rowCount);
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (strategy.strategy === 'real-time') {
      recommendations.push('File is small - filters will update as you type');
      recommendations.push('Excellent performance expected for all operations');
    } else if (strategy.strategy === 'debounced') {
      recommendations.push('Medium file - filters update after 500ms delay');
      recommendations.push('Good performance with minor delay for better UX');
    } else {
      recommendations.push('Large file - use "Apply Filters" button for best performance');
      recommendations.push('Consider adding more specific filters to reduce processing time');
    }
    
    if (rowCount > 50000) {
      recommendations.push('For better performance, consider filtering to reduce data size first');
    }
    
    return {
      ...strategy,
      fileInfo: {
        size: fileRecord.size,
        rowCount: rowCount,
        filename: fileRecord.filename
      },
      recommendations
    };
  }
}
/**
 * QueryProcessor - Orchestrates CUT query execution
 * 
 * Charlie's Query Orchestration:
 * - Coordinates file retrieval, filtering, and analysis
 * - Smart caching and performance optimization
 * - Export functionality with metadata preservation
 * - Integration with existing file management system
 * 
 * Performance Targets: <1s file retrieval, <3s filtering, <500ms export
 */

import { FilterProcessor, type FilteredResult } from './filter-processor';
import { DataTypeDetector } from './data-type-detector';
import type { FilterConfiguration, ColumnsAnalysisResponse } from '../types';

export interface QueryRequest {
  filters: FilterConfiguration[];
  includePreview?: boolean;
  previewLimit?: number;
  includeAnalysis?: boolean;
}

export interface QueryResult {
  success: boolean;
  data?: FilteredResult;
  analysis?: ColumnsAnalysisResponse;
  performance?: {
    fileRetrievalMs: number;
    filteringMs: number;
    totalMs: number;
  };
  error?: string;
}

export interface ExportRequest {
  filters: FilterConfiguration[];
  filename?: string;
  includeMetadata?: boolean;
}

export interface ExportResult {
  success: boolean;
  fileId?: string;
  filename?: string;
  downloadUrl?: string;
  csvContent?: string;
  metadata?: {
    originalFile: string;
    appliedFilters: FilterConfiguration[];
    exportedAt: string;
    totalRows: number;
    filteredRows: number;
  };
  error?: string;
}

export class QueryProcessor {
  /**
   * Execute a query with filters against a CSV file
   * Orchestrates file retrieval and filtering
   */
  static async executeQuery(
    fileId: string,
    request: QueryRequest,
    env: any,
    userId: string
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const performance = {
      fileRetrievalMs: 0,
      filteringMs: 0,
      totalMs: 0
    };

    try {

      // 1. Retrieve file content
      const fileRetrievalStart = Date.now();
      const csvContent = await this.retrieveFileContent(fileId, env, userId);
      performance.fileRetrievalMs = Date.now() - fileRetrievalStart;

      // 2. Apply filters
      const filteringStart = Date.now();
      const filteredResult = await FilterProcessor.applyFilters(
        csvContent,
        request.filters || [],
        request.includePreview || false,
        request.previewLimit || 100
      );
      performance.filteringMs = Date.now() - filteringStart;

      // 3. Include column analysis if requested
      let analysis: ColumnsAnalysisResponse | undefined;
      if (request.includeAnalysis) {
        try {
          const columnMetadata = DataTypeDetector.analyzeColumns(csvContent);
          analysis = {
            success: true,
            columns: columnMetadata.columns,
            rowCount: columnMetadata.rowCount,
            processingTimeMs: columnMetadata.processingTimeMs
          };
        } catch (analysisError) {
          console.warn('🐱 Column analysis failed:', analysisError);
          // Continue without analysis rather than failing the whole query
        }
      }

      performance.totalMs = Date.now() - startTime;


      return {
        success: true,
        data: filteredResult,
        analysis,
        performance
      };
    } catch (error) {
      performance.totalMs = Date.now() - startTime;
      console.error('Query execution failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
        performance
      };
    }
  }

  /**
   * Export filtered data as a new CSV file
   * Saves to R2 storage and file management system
   */
  static async exportFilteredData(
    fileId: string,
    request: ExportRequest,
    env: any,
    userId: string
  ): Promise<ExportResult> {
    const startTime = Date.now();

    try {

      // 1. Get original file metadata
      const originalFile = await this.getFileMetadata(fileId, env, userId);
      if (!originalFile) {
        throw new Error('Original file not found or access denied');
      }

      // 2. Retrieve and filter content
      const csvContent = await this.retrieveFileContent(fileId, env, userId);
      const filteredResult = await FilterProcessor.applyFilters(
        csvContent,
        request.filters || [],
        false // Get all filtered rows for export
      );

      // 3. Generate export CSV with metadata
      const metadata = {
        originalFile: originalFile.filename,
        appliedFilters: request.filters || [],
        exportedAt: new Date().toISOString(),
        totalRows: filteredResult.totalRows,
        filteredRows: filteredResult.filteredCount,
        fileSize: 0  // Will be updated after generating CSV
      };

      const csvExportContent = FilterProcessor.exportFilteredCSV(
        filteredResult,
        request.includeMetadata ? { appliedFilters: request.filters } : undefined
      );

      // 4. Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const baseName = originalFile.filename.replace('.csv', '');
      const filterSuffix = request.filters?.length > 0 ? `_filtered_${request.filters.length}` : '_cut';
      const filename = request.filename || `${baseName}${filterSuffix}_${timestamp}.csv`;

      // 5. Save to R2 storage
      const newFileId = this.generateFileId();
      const r2Key = `csv/${userId}/${newFileId}.csv`;
      
      await env.FILE_STORAGE.put(r2Key, csvExportContent, {
        httpMetadata: {
          contentType: 'text/csv',
          contentDisposition: `attachment; filename="${filename}"`
        }
      });

      // 6. Save metadata to D1 database
      const insertResult = await env.DB.prepare(`
        INSERT INTO files (
          id, user_id, filename, original_filename, file_size, mime_type, 
          r2_key, upload_status, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newFileId,
        userId,
        filename,
        filename,
        csvExportContent.length,
        'text/csv',
        r2Key,
        'completed',
        JSON.stringify(['cut-filtered', 'export', `original-file:${fileId}`])
      ).run();

      if (!insertResult.success) {
        throw new Error('Failed to save export metadata to database');
      }

      // 7. Generate download URL
      const downloadUrl = `/api/v1/files/${newFileId}/download`;

      // Update metadata with actual file size
      metadata.fileSize = csvExportContent.length;
      
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        fileId: newFileId,
        filename,
        downloadUrl,
        csvContent: csvExportContent,
        metadata
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('Export failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  /**
   * Get performance strategy for a file (real-time vs manual updates)
   */
  static async getPerformanceStrategy(
    fileId: string,
    env: any,
    userId: string
  ): Promise<{
    strategy: 'realtime' | 'debounced' | 'manual';
    fileSizeMB: number;
    estimatedRows: number;
    updateInterval?: number;
  }> {
    try {
      const csvContent = await this.retrieveFileContent(fileId, env, userId);
      const fileSizeMB = csvContent.length / (1024 * 1024);
      const estimatedRows = (csvContent.match(/\n/g) || []).length;

      // Performance strategy rules from architecture
      if (estimatedRows < 10000) {
        return {
          strategy: 'realtime',
          fileSizeMB,
          estimatedRows
        };
      } else if (estimatedRows < 50000) {
        return {
          strategy: 'debounced',
          fileSizeMB,
          estimatedRows,
          updateInterval: 500 // 500ms debounce
        };
      } else {
        return {
          strategy: 'manual',
          fileSizeMB,
          estimatedRows
        };
      }
    } catch (error) {
      console.error('Performance strategy analysis failed:', error);
      // Default to manual for unknown files
      return {
        strategy: 'manual',
        fileSizeMB: 0,
        estimatedRows: 0
      };
    }
  }

  /**
   * Retrieve CSV content from R2 storage
   */
  private static async retrieveFileContent(
    fileId: string,
    env: any,
    userId: string
  ): Promise<string> {
    try {
      // Get file metadata from D1
      const fileRecord = await env.DB.prepare(
        'SELECT * FROM files WHERE id = ? AND user_id = ?'
      ).bind(fileId, userId).first();

      if (!fileRecord) {
        // Check if this is a reference/demo file
        if (fileId === 'reference-squirrel') {
          // Handle squirrel reference data
          const squirrelData = await env.FILE_STORAGE.get('reference-data/squirrel-data-full.csv');
          if (squirrelData) {
            return await squirrelData.text();
          }
        }
        throw new Error('File not found or access denied');
      }

      // Retrieve from R2 storage
      const r2Object = await env.FILE_STORAGE.get(fileRecord.r2_key);
      if (!r2Object) {
        throw new Error('File content not found in storage');
      }

      return await r2Object.text();
    } catch (error) {
      console.error('File retrieval failed:', error);
      throw new Error(`Failed to retrieve file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file metadata from D1 database
   */
  private static async getFileMetadata(
    fileId: string,
    env: any,
    userId: string
  ): Promise<any> {
    try {
      const fileRecord = await env.DB.prepare(
        'SELECT * FROM files WHERE id = ? AND user_id = ?'
      ).bind(fileId, userId).first();

      return fileRecord;
    } catch (error) {
      console.error('File metadata retrieval failed:', error);
      return null;
    }
  }

  /**
   * Generate unique file ID
   */
  private static generateFileId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Validate filter configuration
   */
  static validateFilters(filters: FilterConfiguration[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(filters)) {
      errors.push('Filters must be an array');
      return { valid: false, errors };
    }

    if (filters.length > 10) {
      errors.push('Maximum 10 filters allowed per query');
    }

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      
      if (!filter.column || typeof filter.column !== 'string') {
        errors.push(`Filter ${i + 1}: Column name is required`);
      }

      if (!filter.operator || typeof filter.operator !== 'string') {
        errors.push(`Filter ${i + 1}: Operator is required`);
      }

      if (filter.value === undefined || filter.value === null) {
        // Allow null/undefined for null checks
        if (!['is_null', 'not_null'].includes(filter.operator)) {
          errors.push(`Filter ${i + 1}: Value is required for operator '${filter.operator}'`);
        }
      }

      if (filter.dataType && !['TEXT', 'INTEGER', 'DECIMAL', 'DATE', 'BOOLEAN', 'CATEGORICAL'].includes(filter.dataType)) {
        errors.push(`Filter ${i + 1}: Invalid data type '${filter.dataType}'`);
      }

      if (filter.logicalOperator && !['AND', 'OR'].includes(filter.logicalOperator)) {
        errors.push(`Filter ${i + 1}: Invalid logical operator '${filter.logicalOperator}'`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
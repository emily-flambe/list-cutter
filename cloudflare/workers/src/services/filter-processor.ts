/**
 * FilterProcessor - Charlie's High-Performance CSV Filtering Service
 * 
 * 🐱 Charlie's Filtering Philosophy:
 * - Extend Ruby's CrosstabProcessor for maximum performance
 * - Stream processing with minimal memory allocation
 * - Support ALL filter types with intelligent optimizations
 * - Performance-aware strategy based on file size
 * - Excellent error handling and user feedback
 * 
 * Performance Targets: <3s filtering for 50MB files, <500ms for small files
 */

import { CrosstabProcessor } from './crosstab-processor';
import { DataTypeDetector, DataType } from './data-type-detector';
import type { FilterOperator, FilterType, QueryResult } from '../types';

// Charlie's Performance Configuration - tuned for CUT filtering
const FILTER_CONFIG = {
  MAX_FILE_SIZE_MB: 50, // Max file size for filtering
  MAX_ROWS_PROCESSED: 100000, // Max rows to prevent timeout
  MAX_PROCESSING_TIME_MS: 25000, // Stay under 30s CPU limit
  BATCH_SIZE: 5000, // Process in batches for memory efficiency
  SMALL_FILE_THRESHOLD: 10000, // Rows - determines real-time vs batch
  MEDIUM_FILE_THRESHOLD: 50000, // Rows - determines update strategy
};

export class FilterProcessor extends CrosstabProcessor {
  /**
   * 🐱 CHARLIE'S MAIN FILTER METHOD: Apply filters to CSV data with streaming performance
   * Leverages all of Ruby's optimizations while adding intelligent filtering
   */
  static async filterCSVData(
    csvContent: string,
    filters: FilterOperator[],
    logicalOperator: 'AND' | 'OR' = 'AND',
    options: { limit?: number; offset?: number } = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      // Early validation using Ruby's patterns
      if (!csvContent || csvContent.length === 0) {
        throw new Error('CSV content is empty');
      }

      if (filters.length === 0) {
        throw new Error('At least one filter must be specified');
      }

      // Use Ruby's validation method
      this.validateProcessingLimits(csvContent, 'filtering');

      const fileReadStart = Date.now();
      
      // Apply Ruby's CSV cleaning pipeline
      const hasBOM = csvContent.charCodeAt(0) === 0xFEFF;
      let cleanContent = hasBOM ? csvContent.substring(1) : csvContent;
      cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimStart();
      
      // Apply Unicode normalization from Ruby's processor
      cleanContent = this.normalizeUnicodeCharacters(cleanContent);
      
      // Skip empty lines at beginning
      let contentStartIndex = 0;
      while (contentStartIndex < cleanContent.length && 
             (cleanContent.charAt(contentStartIndex) === '\n' || 
              cleanContent.charAt(contentStartIndex) === '\r')) {
        contentStartIndex++;
      }
      
      if (contentStartIndex >= cleanContent.length) {
        throw new Error('CSV file is empty after cleaning');
      }
      
      cleanContent = cleanContent.substring(contentStartIndex);

      // Parse header using Ruby's method
      const firstNewlineIndex = cleanContent.indexOf('\n');
      if (firstNewlineIndex === -1) {
        throw new Error('CSV must contain at least a header row and one data row');
      }

      const headerLine = cleanContent.substring(0, firstNewlineIndex).trim();
      const headers = this.parseCSVLine(headerLine);
      
      const fileReadTime = Date.now() - fileReadStart;
      const filteringStart = Date.now();
      
      // Validate filter columns exist
      this.validateFilters(filters, headers);

      // Get column indices for filters (O(1) lookup during processing)
      const filterColumnMap = new Map<string, number>();
      filters.forEach(filter => {
        const index = headers.findIndex(h => h.trim() === filter.columnName);
        filterColumnMap.set(filter.columnName, index);
      });

      // Charlie's streaming filtering with Ruby's performance patterns
      const filteredRows: Record<string, any>[] = [];
      let processedRows = 0;
      let matchedRows = 0;
      let rowIndex = firstNewlineIndex + 1;
      
      const { limit = Infinity, offset = 0 } = options;
      let currentOffset = 0;

      // Stream processing with batch efficiency
      while (rowIndex < cleanContent.length && 
             processedRows < FILTER_CONFIG.MAX_ROWS_PROCESSED &&
             filteredRows.length < limit) {
        
        // Timeout protection (Ruby's pattern)
        if (processedRows % 5000 === 0 && Date.now() - startTime > FILTER_CONFIG.MAX_PROCESSING_TIME_MS) {
          throw new Error(`Filtering timeout after ${processedRows} rows. Consider using smaller files or fewer filters.`);
        }

        // Find next line efficiently (Ruby's pattern)
        const nextNewlineIndex = cleanContent.indexOf('\n', rowIndex);
        const lineEnd = nextNewlineIndex === -1 ? cleanContent.length : nextNewlineIndex;
        
        if (rowIndex >= lineEnd) break;
        
        const line = cleanContent.substring(rowIndex, lineEnd).trim();
        rowIndex = lineEnd + 1;
        
        if (!line) continue; // Skip empty lines

        try {
          // Parse line using Ruby's CSV parser
          const values = this.parseCSVLine(line);
          
          // Apply filters using Charlie's optimized logic
          const passesFilters = this.evaluateFilters(values, filters, filterColumnMap, logicalOperator);
          
          if (passesFilters) {
            matchedRows++;
            
            // Handle offset/limit for pagination
            if (currentOffset >= offset) {
              // Build row object
              const row: Record<string, any> = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              filteredRows.push(row);
            }
            currentOffset++;
          }
          
          processedRows++;
        } catch (rowError) {
          console.warn(`🐱 Skipping malformed row ${processedRows + 1}:`, rowError);
        }
      }

      const filteringTime = Date.now() - filteringStart;
      const totalTime = Date.now() - startTime;
      const throughputMBps = (csvContent.length / (1024 * 1024)) / (totalTime / 1000);

      console.log(`🐱 Filtering completed: ${filteredRows.length}/${matchedRows} rows match filters, processed ${processedRows} total in ${totalTime}ms`);

      return {
        success: true,
        data: {
          rows: filteredRows,
          totalRows: processedRows,
          filteredRows: matchedRows,
          columns: headers
        },
        metadata: {
          processingTimeMs: totalTime,
          filtersApplied: filters.length,
          performance: {
            file_read_ms: fileReadTime,
            filtering_ms: filteringTime,
            total_time_ms: totalTime,
            throughput_mbps: throughputMBps
          }
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`🐱 Filtering failed after ${processingTime}ms:`, error);
      throw new Error(`Failed to filter CSV data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 🐱 CHARLIE'S FILTER EVALUATION: Optimized filter logic with type-aware comparisons
   * Supports all filter types with excellent performance
   */
  private static evaluateFilters(
    values: string[],
    filters: FilterOperator[],
    columnMap: Map<string, number>,
    logicalOperator: 'AND' | 'OR'
  ): boolean {
    if (filters.length === 0) return true;

    const results = filters.map(filter => {
      const columnIndex = columnMap.get(filter.columnName);
      if (columnIndex === undefined || columnIndex === -1) {
        console.warn(`🐱 Filter column "${filter.columnName}" not found, skipping`);
        return false;
      }

      const cellValue = (values[columnIndex] || '').trim();
      const result = this.evaluateSingleFilter(cellValue, filter);
      
      // Handle negation
      return filter.negated ? !result : result;
    });

    // Apply logical operator
    return logicalOperator === 'AND' 
      ? results.every(result => result)
      : results.some(result => result);
  }

  /**
   * 🐱 CHARLIE'S SINGLE FILTER EVALUATION: Type-aware filtering with performance optimizations
   */
  private static evaluateSingleFilter(cellValue: string, filter: FilterOperator): boolean {
    const { type, value } = filter;
    
    // Handle null/empty checks first
    if (type === 'is_null') {
      return !cellValue || cellValue === '(empty)';
    }
    
    if (type === 'not_null') {
      return cellValue && cellValue !== '(empty)';
    }

    // Early return for empty values (except null checks)
    if (!cellValue || cellValue === '(empty)') {
      return false;
    }

    // Text filters - case insensitive by default for better UX
    if (type === 'contains') {
      return cellValue.toLowerCase().includes(String(value).toLowerCase());
    }
    
    if (type === 'equals') {
      return cellValue.toLowerCase() === String(value).toLowerCase();
    }
    
    if (type === 'not_equals') {
      return cellValue.toLowerCase() !== String(value).toLowerCase();
    }
    
    if (type === 'starts_with') {
      return cellValue.toLowerCase().startsWith(String(value).toLowerCase());
    }
    
    if (type === 'ends_with') {
      return cellValue.toLowerCase().endsWith(String(value).toLowerCase());
    }
    
    if (type === 'regex') {
      try {
        const regex = new RegExp(String(value), 'i'); // Case insensitive
        return regex.test(cellValue);
      } catch {
        console.warn(`🐱 Invalid regex pattern: ${value}`);
        return false;
      }
    }
    
    if (type === 'in_list') {
      const list = Array.isArray(value) ? value : String(value).split(',');
      return list.some(item => cellValue.toLowerCase() === String(item).trim().toLowerCase());
    }

    // Number filters - attempt numeric conversion
    if (['greater_than', 'less_than', 'between'].includes(type)) {
      const numValue = parseFloat(cellValue.replace(/[,$]/g, '')); // Handle currency/commas
      if (isNaN(numValue)) return false;
      
      if (type === 'greater_than') {
        return numValue > parseFloat(String(value));
      }
      
      if (type === 'less_than') {
        return numValue < parseFloat(String(value));
      }
      
      if (type === 'between') {
        const [min, max] = Array.isArray(value) ? value : String(value).split(',');
        return numValue >= parseFloat(String(min)) && numValue <= parseFloat(String(max));
      }
    }

    // Date filters - flexible date parsing
    if (['before', 'after', 'date_range', 'last_n_days', 'this_month', 'this_year'].includes(type)) {
      const dateValue = this.parseFlexibleDate(cellValue);
      if (!dateValue) return false;
      
      if (type === 'before') {
        const compareDate = new Date(String(value));
        return dateValue < compareDate;
      }
      
      if (type === 'after') {
        const compareDate = new Date(String(value));
        return dateValue > compareDate;
      }
      
      if (type === 'date_range') {
        const [startDate, endDate] = Array.isArray(value) ? value : String(value).split(',');
        return dateValue >= new Date(String(startDate)) && dateValue <= new Date(String(endDate));
      }
      
      if (type === 'last_n_days') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(String(value)));
        return dateValue >= daysAgo;
      }
      
      if (type === 'this_month') {
        const now = new Date();
        return dateValue.getMonth() === now.getMonth() && dateValue.getFullYear() === now.getFullYear();
      }
      
      if (type === 'this_year') {
        const now = new Date();
        return dateValue.getFullYear() === now.getFullYear();
      }
    }

    // Boolean filters
    if (type === 'is_true') {
      return ['true', '1', 'yes', 'y', 'on'].includes(cellValue.toLowerCase());
    }
    
    if (type === 'is_false') {
      return ['false', '0', 'no', 'n', 'off'].includes(cellValue.toLowerCase());
    }

    console.warn(`🐱 Unsupported filter type: ${type}`);
    return false;
  }

  /**
   * 🐱 CHARLIE'S FLEXIBLE DATE PARSER: Handle various date formats
   */
  private static parseFlexibleDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Try direct parsing first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
    
    // Try common date patterns
    const patterns = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // MM-DD-YYYY
      /^(\d{2})\/(\d{2})\/(\d{2})$/, // MM/DD/YY
    ];
    
    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        try {
          date = new Date(dateStr);
          if (!isNaN(date.getTime())) return date;
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }

  /**
   * 🐱 CHARLIE'S FILTER VALIDATION: Ensure filters reference valid columns
   */
  private static validateFilters(filters: FilterOperator[], headers: string[]): void {
    const headerSet = new Set(headers.map(h => h.trim()));
    
    for (const filter of filters) {
      if (!headerSet.has(filter.columnName)) {
        throw new Error(`Filter column "${filter.columnName}" not found in CSV. Available columns: ${headers.join(', ')}`);
      }
      
      // Validate filter type
      const validTypes = Object.values(FilterType);
      if (!validTypes.includes(filter.type as FilterType)) {
        throw new Error(`Invalid filter type "${filter.type}". Valid types: ${validTypes.join(', ')}`);
      }
    }
  }

  /**
   * 🐱 CHARLIE'S PERFORMANCE ANALYZER: Determine optimal processing strategy
   */
  static analyzePerformanceStrategy(rowCount: number): {
    strategy: 'real-time' | 'debounced' | 'manual';
    updateDelay: number;
    batchSize: number;
  } {
    if (rowCount <= FILTER_CONFIG.SMALL_FILE_THRESHOLD) {
      return {
        strategy: 'real-time',
        updateDelay: 100, // 100ms debounce
        batchSize: rowCount
      };
    }
    
    if (rowCount <= FILTER_CONFIG.MEDIUM_FILE_THRESHOLD) {
      return {
        strategy: 'debounced',
        updateDelay: 500, // 500ms debounce
        batchSize: FILTER_CONFIG.BATCH_SIZE
      };
    }
    
    return {
      strategy: 'manual',
      updateDelay: 0, // No automatic updates
      batchSize: FILTER_CONFIG.BATCH_SIZE
    };
  }

  /**
   * 🐱 CHARLIE'S CSV EXPORT: Generate filtered CSV for download
   * Uses Ruby's optimized export patterns
   */
  static generateFilteredCSV(
    headers: string[],
    filteredRows: Record<string, any>[]
  ): string {
    if (filteredRows.length === 0) {
      return headers.map(h => this.escapeCSVCell(h)).join(',') + '\n';
    }

    // Use Ruby's StringBuilder pattern for performance
    const csvParts: string[] = [];
    
    // Header row
    csvParts.push(headers.map(h => this.escapeCSVCell(h)).join(','));
    
    // Data rows - batch processing for efficiency
    for (const row of filteredRows) {
      const rowCells = headers.map(header => this.escapeCSVCell(row[header] || ''));
      csvParts.push(rowCells.join(','));
    }
    
    return csvParts.join('\n');
  }
}
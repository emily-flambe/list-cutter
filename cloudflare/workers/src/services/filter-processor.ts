/**
 * FilterProcessor - High-performance CSV filtering service
 * 
 * Charlie's Smart Filtering Implementation:
 * - Extends CrosstabProcessor for proven performance patterns
 * - Streaming filter application with minimal memory allocation
 * - Support for all data types: text, number, date, boolean
 * - Logical operators: AND/OR combinations with proper precedence
 * - Early termination and batch processing for Cloudflare Workers
 * 
 * Performance Targets: <3s filtering for 50MB files
 */

import { CrosstabProcessor } from './crosstab-processor';
import type { FilterConfiguration } from '../types';

// Performance configuration matching CrosstabProcessor
const FILTER_CONFIG = {
  MAX_FILE_SIZE_MB: 50,
  MAX_ROWS_PROCESSED: 100000,
  MAX_PROCESSING_TIME_MS: 25000,
  BATCH_SIZE: 5000,
  PREVIEW_LIMIT: 100
};

export interface FilteredResult {
  filteredRows: string[][];
  totalRows: number;
  filteredCount: number;
  processingTimeMs: number;
  headers: string[];
}

export class FilterProcessor {
  /**
   * Apply filters to CSV content using streaming processing
   * Reuses CrosstabProcessor's optimized CSV parsing logic
   */
  static async applyFilters(
    csvContent: string,
    filters: FilterConfiguration[],
    includePreview: boolean = false,
    previewLimit: number = FILTER_CONFIG.PREVIEW_LIMIT
  ): Promise<FilteredResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!csvContent || csvContent.trim().length === 0) {
        throw new Error('CSV content is empty');
      }

      if (!filters || filters.length === 0) {
        // No filters - return all data with optional preview
        const { headers, allRows } = this.parseCSVContent(csvContent);
        const resultRows = includePreview ? allRows.slice(0, previewLimit) : allRows;
        
        return {
          filteredRows: resultRows,
          totalRows: allRows.length,
          filteredCount: allRows.length, // All rows match when no filters
          processingTimeMs: Date.now() - startTime,
          headers
        };
      }

      // Use CrosstabProcessor's cleaning and parsing logic
      const fileSizeMB = csvContent.length / (1024 * 1024);
      if (fileSizeMB > FILTER_CONFIG.MAX_FILE_SIZE_MB) {
        throw new Error(`File too large (${fileSizeMB.toFixed(1)}MB). Maximum supported: ${FILTER_CONFIG.MAX_FILE_SIZE_MB}MB`);
      }

      // Apply same cleaning as CrosstabProcessor
      const hasBOM = csvContent.charCodeAt(0) === 0xFEFF;
      let cleanContent = hasBOM ? csvContent.substring(1) : csvContent;
      cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimStart();
      cleanContent = CrosstabProcessor.normalizeUnicodeCharacters(cleanContent);
      
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

      // Parse header
      const firstNewlineIndex = cleanContent.indexOf('\n');
      if (firstNewlineIndex === -1) {
        throw new Error('CSV must contain at least a header row and one data row');
      }

      const headerLine = cleanContent.substring(0, firstNewlineIndex).trim();
      const headers = this.parseCSVLine(headerLine);
      
      // Validate filter columns exist
      for (const filter of filters) {
        const columnIndex = headers.findIndex(h => h.trim() === filter.column);
        if (columnIndex === -1) {
          throw new Error(`Filter column "${filter.column}" not found in CSV headers`);
        }
      }

      // Process rows with filtering
      const filteredRows: string[][] = [];
      let totalRows = 0;
      let filteredCount = 0; // Track actual filtered count separately from preview
      let processedRows = 0;
      let rowIndex = firstNewlineIndex + 1;
      
      // Stream through rows and apply filters
      while (rowIndex < cleanContent.length && processedRows < FILTER_CONFIG.MAX_ROWS_PROCESSED) {
        // Check timeout periodically
        if (processedRows % 10000 === 0 && Date.now() - startTime > FILTER_CONFIG.MAX_PROCESSING_TIME_MS) {
          throw new Error(`Processing timeout after ${processedRows} rows. Consider using smaller files.`);
        }

        // Find next line efficiently
        const nextNewlineIndex = cleanContent.indexOf('\n', rowIndex);
        const lineEnd = nextNewlineIndex === -1 ? cleanContent.length : nextNewlineIndex;
        
        if (rowIndex >= lineEnd) break;
        
        const line = cleanContent.substring(rowIndex, lineEnd).trim();
        rowIndex = lineEnd + 1;
        
        if (!line) continue; // Skip empty lines

        try {
          const values = this.parseCSVLine(line);
          totalRows++;
          
          // Apply all filters to this row
          const passesAllFilters = this.evaluateRowFilters(values, headers, filters);
          
          if (passesAllFilters) {
            filteredCount++; // Always increment the actual filtered count
            
            // Include this row in results (with preview limit if needed)
            if (!includePreview || filteredRows.length < previewLimit) {
              filteredRows.push(values);
            }
          }
          
          processedRows++;
        } catch (rowError) {
          console.warn(`🐱 Skipping malformed row ${processedRows + 1}:`, rowError);
          // Continue processing other rows
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        filteredRows,
        totalRows,
        filteredCount, // Now returns the actual count of filtered rows, not just preview length
        processingTimeMs: processingTime,
        headers
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`Filter processing failed after ${processingTime}ms:`, error);
      throw new Error(`Failed to apply filters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Evaluate whether a row passes all filters
   * Supports AND/OR logic with proper precedence
   */
  private static evaluateRowFilters(
    values: string[], 
    headers: string[], 
    filters: FilterConfiguration[]
  ): boolean {
    if (filters.length === 0) return true;

    // Group filters by logical operator for proper evaluation
    // Default to AND if no operator specified
    const andFilters: FilterConfiguration[] = [];
    const orFilters: FilterConfiguration[] = [];

    for (const filter of filters) {
      if (filter.logicalOperator === 'OR') {
        orFilters.push(filter);
      } else {
        andFilters.push(filter);
      }
    }

    // Evaluate AND filters - all must pass
    for (const filter of andFilters) {
      if (!this.evaluateSingleFilter(values, headers, filter)) {
        return false;
      }
    }

    // Evaluate OR filters - at least one must pass (if any OR filters exist)
    if (orFilters.length > 0) {
      let orPassed = false;
      for (const filter of orFilters) {
        if (this.evaluateSingleFilter(values, headers, filter)) {
          orPassed = true;
          break;
        }
      }
      if (!orPassed) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single filter against a row
   * Supports all data types and operators
   */
  private static evaluateSingleFilter(
    values: string[], 
    headers: string[], 
    filter: FilterConfiguration
  ): boolean {
    const columnIndex = headers.findIndex(h => h.trim() === filter.column);
    if (columnIndex === -1) return false;
    
    const cellValue = (values[columnIndex] || '').trim();
    const filterValue = String(filter.value || '').trim();
    
    // Handle null/empty checks first
    if (filter.operator === 'is_null' || filter.operator === 'is_empty') {
      return cellValue === '' || cellValue.toLowerCase() === 'null';
    }
    if (filter.operator === 'not_null' || filter.operator === 'is_not_empty') {
      return cellValue !== '' && cellValue.toLowerCase() !== 'null';
    }

    // For "not_contains", "not_equals" operators, empty cells should be evaluated normally
    // (an empty cell doesn't contain any string, so it passes "not_contains" filters)
    if (cellValue === '' && 
        filter.operator !== 'equals' && 
        filter.operator !== 'not_equals' && 
        filter.operator !== 'not_contains') {
      return false;
    }

    try {
      switch (filter.dataType) {
        case 'TEXT':
        case 'CATEGORICAL':
          return this.evaluateTextFilter(cellValue, filterValue, filter.operator);
        
        case 'INTEGER':
        case 'DECIMAL':
          return this.evaluateNumberFilter(cellValue, filterValue, filter.operator);
        
        case 'DATE':
          return this.evaluateDateFilter(cellValue, filterValue, filter.operator);
        
        case 'BOOLEAN':
          return this.evaluateBooleanFilter(cellValue, filterValue, filter.operator);
        
        default:
          // Default to text comparison for unknown types
          return this.evaluateTextFilter(cellValue, filterValue, filter.operator);
      }
    } catch (error) {
      console.warn(`🐱 Filter evaluation error for ${filter.column}:`, error);
      return false;
    }
  }

  /**
   * Evaluate text filters
   */
  private static evaluateTextFilter(cellValue: string, filterValue: string, operator: string): boolean {
    const lowerCell = cellValue.toLowerCase();
    const lowerFilter = filterValue.toLowerCase();

    switch (operator) {
      case 'contains':
        return lowerCell.includes(lowerFilter);
      case 'not_contains':
        return !lowerCell.includes(lowerFilter);
      case 'equals':
        return lowerCell === lowerFilter;
      case 'not_equals':
        return lowerCell !== lowerFilter;
      case 'starts_with':
        return lowerCell.startsWith(lowerFilter);
      case 'ends_with':
        return lowerCell.endsWith(lowerFilter);
      case 'is_empty':
        return cellValue.trim() === '';
      case 'is_not_empty':
        return cellValue.trim() !== '';
      case 'regex':
        try {
          const regex = new RegExp(filterValue, 'i');
          return regex.test(cellValue);
        } catch {
          return false;
        }
      case 'in_list':
        const listItems = filterValue.split(',').map(item => item.trim().toLowerCase());
        return listItems.includes(lowerCell);
      default:
        return lowerCell.includes(lowerFilter);
    }
  }

  /**
   * Evaluate number filters
   */
  private static evaluateNumberFilter(cellValue: string, filterValue: string, operator: string): boolean {
    const cellNum = parseFloat(cellValue);
    const filterNum = parseFloat(filterValue);
    
    if (isNaN(cellNum) || isNaN(filterNum)) {
      // Handle is_empty and is_not_empty for numeric columns
      if (operator === 'is_empty') {
        return cellValue.trim() === '';
      }
      if (operator === 'is_not_empty') {
        return cellValue.trim() !== '';
      }
      return false;
    }

    switch (operator) {
      case 'equals':
        return cellNum === filterNum;
      case 'not_equals':
        return cellNum !== filterNum;
      case 'greater_than':
        return cellNum > filterNum;
      case 'less_than':
        return cellNum < filterNum;
      case 'greater_equal':
        return cellNum >= filterNum;
      case 'less_equal':
        return cellNum <= filterNum;
      case 'between':
        // Expect filterValue like "10,20"
        const [min, max] = filterValue.split(',').map(v => parseFloat(v.trim()));
        if (isNaN(min) || isNaN(max)) return false;
        return cellNum >= min && cellNum <= max;
      case 'is_empty':
        return cellValue.trim() === '';
      case 'is_not_empty':
        return cellValue.trim() !== '';
      default:
        return cellNum === filterNum;
    }
  }

  /**
   * Evaluate date filters
   */
  private static evaluateDateFilter(cellValue: string, filterValue: string, operator: string): boolean {
    const cellDate = this.parseDate(cellValue);
    if (!cellDate) return false;

    switch (operator) {
      case 'before':
        const beforeDate = this.parseDate(filterValue);
        return beforeDate ? cellDate < beforeDate : false;
      
      case 'after':
        const afterDate = this.parseDate(filterValue);
        return afterDate ? cellDate > afterDate : false;
      
      case 'date_range':
        // Expect filterValue like "2023-01-01,2023-12-31"
        const [startStr, endStr] = filterValue.split(',').map(v => v.trim());
        const startDate = this.parseDate(startStr);
        const endDate = this.parseDate(endStr);
        if (!startDate || !endDate) return false;
        return cellDate >= startDate && cellDate <= endDate;
      
      case 'last_n_days':
        const days = parseInt(filterValue);
        if (isNaN(days)) return false;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return cellDate >= cutoffDate;
      
      case 'this_month':
        const now = new Date();
        return cellDate.getFullYear() === now.getFullYear() && 
               cellDate.getMonth() === now.getMonth();
      
      case 'this_year':
        const currentYear = new Date().getFullYear();
        return cellDate.getFullYear() === currentYear;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate boolean filters
   */
  private static evaluateBooleanFilter(cellValue: string, filterValue: string, operator: string): boolean {
    const lowerCell = cellValue.toLowerCase();
    
    switch (operator) {
      case 'is_true':
        return lowerCell === 'true' || lowerCell === 'yes' || lowerCell === '1';
      case 'is_false':
        return lowerCell === 'false' || lowerCell === 'no' || lowerCell === '0';
      default:
        return false;
    }
  }

  /**
   * Parse date from string - supports multiple formats
   */
  private static parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.trim() === '') return null;
    
    const date = new Date(dateStr.trim());
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Parse CSV content into headers and rows
   * Reuses CrosstabProcessor parsing logic for consistency
   */
  private static parseCSVContent(csvContent: string): { headers: string[], allRows: string[][] } {
    // Apply same cleaning as CrosstabProcessor
    const hasBOM = csvContent.charCodeAt(0) === 0xFEFF;
    let cleanContent = hasBOM ? csvContent.substring(1) : csvContent;
    cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimStart();
    cleanContent = CrosstabProcessor.normalizeUnicodeCharacters(cleanContent);
    
    const lines = cleanContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must contain at least header and one data row');
    }

    const headers = this.parseCSVLine(lines[0]);
    const allRows = lines.slice(1).map(line => this.parseCSVLine(line));
    
    return { headers, allRows };
  }

  /**
   * Parse a single CSV line handling quoted fields and embedded commas
   * Reuses CrosstabProcessor logic for consistency
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Export filtered data as CSV string
   */
  static exportFilteredCSV(result: FilteredResult, metadata?: { appliedFilters?: FilterConfiguration[] }): string {
    const csvParts: string[] = [];
    
    // Add metadata as comments if provided
    if (metadata?.appliedFilters?.length) {
      csvParts.push(`# Filtered CSV Export - ${new Date().toISOString()}`);
      csvParts.push(`# Applied Filters: ${metadata.appliedFilters.length}`);
      csvParts.push(`# Total Rows: ${result.totalRows}, Filtered Rows: ${result.filteredCount}`);
      csvParts.push('');
    }
    
    // Header row
    csvParts.push(result.headers.map(h => this.escapeCSVCell(h)).join(','));
    
    // Data rows
    for (const row of result.filteredRows) {
      csvParts.push(row.map(cell => this.escapeCSVCell(cell)).join(','));
    }
    
    return csvParts.join('\n');
  }

  /**
   * Escape CSV cell for safe export
   */
  private static escapeCSVCell(cell: string): string {
    const str = String(cell);
    
    // Fast check - if no special chars, return as-is
    let needsEscaping = false;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === ',' || char === '"' || char === '\n' || char === '\r') {
        needsEscaping = true;
        break;
      }
    }
    
    if (!needsEscaping) {
      return str;
    }
    
    return '"' + str.replace(/"/g, '""') + '"';
  }
}
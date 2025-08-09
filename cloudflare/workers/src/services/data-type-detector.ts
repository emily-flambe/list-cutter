/**
 * DataTypeDetector - Ruby's Lightning-Fast Column Type Detection
 * 
 * Ruby's RADICAL SIMPLICITY Philosophy:
 * - Reuse existing CrosstabProcessor.extractFields() and parseCSVLine() methods
 * - Simple regex patterns for data type detection (no ML complexity)
 * - Analyze only first 1000 rows for performance
 * - Early termination and minimal memory allocation
 * - Build on existing Unicode normalization and error handling
 * 
 * Performance Targets: <500ms type detection for 50MB files
 */

import { CrosstabProcessor } from './crosstab-processor';

// Ruby's Performance Configuration - tuned for Cloudflare Workers
const DATA_TYPE_CONFIG = {
  SAMPLE_SIZE: 1000, // Only analyze first 1000 rows for speed
  MAX_PROCESSING_TIME_MS: 15000, // Stay under 30s CPU limit
  CONFIDENCE_THRESHOLD: 0.7, // 70% of samples must match to confirm type
  MAX_UNIQUE_VALUES_FOR_CATEGORICAL: 20 // If >20 unique values, likely not categorical
};

// Ruby's Simple Data Type Enum
export enum DataType {
  INTEGER = 'integer',
  DECIMAL = 'decimal', 
  DATE = 'date',
  BOOLEAN = 'boolean',
  CATEGORICAL = 'categorical',
  TEXT = 'text' // catch-all
}

export interface ColumnMetadata {
  name: string;
  dataType: DataType;
  confidence: number;
  sampleValues: string[];
  uniqueValueCount: number;
  nullCount: number;
  totalSamples: number;
}

export interface DataTypeAnalysis {
  columns: ColumnMetadata[];
  processingTimeMs: number;
  rowsAnalyzed: number;
  fileInfo: {
    totalRows: number;
    totalColumns: number;
  };
}

export class DataTypeDetector {
  /**
   * RUBY OPTIMIZED: Lightning-fast data type detection using existing patterns
   * Leverages CrosstabProcessor for CSV parsing and Unicode handling
   */
  static async analyzeColumnTypes(csvContent: string): Promise<DataTypeAnalysis> {
    const startTime = Date.now();
    
    try {
      if (!csvContent || csvContent.length === 0) {
        return {
          columns: [],
          processingTimeMs: Date.now() - startTime,
          rowsAnalyzed: 0,
          fileInfo: { totalRows: 0, totalColumns: 0 }
        };
      }

      // REUSE: Leverage existing CrosstabProcessor field extraction
      const { fields, rowCount } = CrosstabProcessor.extractFields(csvContent);
      
      if (fields.length === 0) {
        return {
          columns: [],
          processingTimeMs: Date.now() - startTime,
          rowsAnalyzed: 0,
          fileInfo: { totalRows: rowCount, totalColumns: 0 }
        };
      }

      // REUSE: Apply same cleaning as CrosstabProcessor
      const hasBOM = csvContent.charCodeAt(0) === 0xFEFF;
      let cleanContent = hasBOM ? csvContent.substring(1) : csvContent;
      cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimStart();
      
      // REUSE: Apply Unicode normalization from CrosstabProcessor
      cleanContent = CrosstabProcessor.normalizeUnicodeCharacters(cleanContent);
      
      // Skip empty lines at the beginning (same logic as CrosstabProcessor)
      let contentStartIndex = 0;
      while (contentStartIndex < cleanContent.length && 
             (cleanContent.charAt(contentStartIndex) === '\n' || 
              cleanContent.charAt(contentStartIndex) === '\r')) {
        contentStartIndex++;
      }
      
      if (contentStartIndex >= cleanContent.length) {
        return {
          columns: [],
          processingTimeMs: Date.now() - startTime,
          rowsAnalyzed: 0,
          fileInfo: { totalRows: rowCount, totalColumns: 0 }
        };
      }
      
      cleanContent = cleanContent.substring(contentStartIndex);

      // Find header row (reuse CrosstabProcessor logic)
      const firstNewlineIndex = cleanContent.indexOf('\n');
      if (firstNewlineIndex === -1) {
        return {
          columns: [],
          processingTimeMs: Date.now() - startTime,
          rowsAnalyzed: 0,
          fileInfo: { totalRows: rowCount, totalColumns: fields.length }
        };
      }

      // Initialize column metadata
      const columnMetadata: ColumnMetadata[] = fields.map(field => ({
        name: field,
        dataType: DataType.TEXT,
        confidence: 0,
        sampleValues: [],
        uniqueValueCount: 0,
        nullCount: 0,
        totalSamples: 0
      }));

      // Track unique values for categorical detection
      const uniqueValueSets = fields.map(() => new Set<string>());
      
      let rowIndex = firstNewlineIndex + 1;
      let processedRows = 0;
      const maxRows = Math.min(DATA_TYPE_CONFIG.SAMPLE_SIZE, rowCount - 1);

      // RUBY OPTIMIZATION: Stream processing with early termination
      while (rowIndex < cleanContent.length && processedRows < maxRows) {
        // Timeout protection
        if (processedRows % 100 === 0 && Date.now() - startTime > DATA_TYPE_CONFIG.MAX_PROCESSING_TIME_MS) {
          console.warn(`🐰 Type detection timeout after ${processedRows} rows`);
          break;
        }

        // Find next line efficiently (reuse CrosstabProcessor pattern)
        const nextNewlineIndex = cleanContent.indexOf('\n', rowIndex);
        const lineEnd = nextNewlineIndex === -1 ? cleanContent.length : nextNewlineIndex;
        
        if (rowIndex >= lineEnd) break;
        
        const line = cleanContent.substring(rowIndex, lineEnd).trim();
        rowIndex = lineEnd + 1;
        
        if (!line) continue; // Skip empty lines

        try {
          // REUSE: CrosstabProcessor's parseCSVLine method
          const values = CrosstabProcessor.parseCSVLine(line);
          
          // Process each column value
          fields.forEach((field, colIndex) => {
            const rawValue = (values[colIndex] || '').trim();
            const metadata = columnMetadata[colIndex];
            
            metadata.totalSamples++;
            
            // Track null/empty values
            if (!rawValue || rawValue === '(empty)') {
              metadata.nullCount++;
              return;
            }
            
            // Add to unique values set (for categorical detection)
            uniqueValueSets[colIndex].add(rawValue);
            
            // Store sample values (first 10 for reference)
            if (metadata.sampleValues.length < 10) {
              metadata.sampleValues.push(rawValue);
            }
          });
          
          processedRows++;
        } catch (rowError) {
          console.warn(`🐰 Skipping malformed row ${processedRows + 1}:`, rowError);
        }
      }

      // RUBY OPTIMIZATION: Fast type detection with simple patterns
      columnMetadata.forEach((metadata, colIndex) => {
        const uniqueValues = Array.from(uniqueValueSets[colIndex]);
        metadata.uniqueValueCount = uniqueValues.length;
        
        // Determine data type using Ruby's simple heuristics
        const typeScore = this.detectDataType(uniqueValues, metadata.totalSamples);
        metadata.dataType = typeScore.type;
        metadata.confidence = typeScore.confidence;
      });

      const processingTime = Date.now() - startTime;
      console.log(`🐰 Type detection completed: ${fields.length} columns, ${processedRows} rows analyzed in ${processingTime}ms`);

      return {
        columns: columnMetadata,
        processingTimeMs: processingTime,
        rowsAnalyzed: processedRows,
        fileInfo: {
          totalRows: rowCount,
          totalColumns: fields.length
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`🐰 Type detection failed after ${processingTime}ms:`, error);
      throw new Error(`Data type detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * RUBY'S SIMPLE TYPE DETECTION: Fast regex-based pattern matching
   * No ML complexity - just proven heuristics
   */
  private static detectDataType(uniqueValues: string[], totalSamples: number): { type: DataType; confidence: number } {
    if (uniqueValues.length === 0) {
      return { type: DataType.TEXT, confidence: 0 };
    }

    // Count matches for each type
    let integerMatches = 0;
    let decimalMatches = 0;
    let dateMatches = 0;
    let booleanMatches = 0;

    // Ruby's optimized regex patterns
    const integerPattern = /^-?\d+$/;
    const decimalPattern = /^-?\d*\.\d+$/;
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY or M/D/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
      /^\d{2}\/\d{2}\/\d{2}$/, // MM/DD/YY
    ];
    const booleanPattern = /^(true|false|yes|no|y|n|1|0)$/i;

    for (const value of uniqueValues) {
      const cleanValue = value.trim().toLowerCase();
      
      if (integerPattern.test(value)) integerMatches++;
      else if (decimalPattern.test(value)) decimalMatches++;
      else if (datePatterns.some(pattern => pattern.test(value))) dateMatches++;
      else if (booleanPattern.test(cleanValue)) booleanMatches++;
    }

    const totalValues = uniqueValues.length;
    
    // Calculate confidence scores
    const integerConfidence = integerMatches / totalValues;
    const decimalConfidence = decimalMatches / totalValues;
    const dateConfidence = dateMatches / totalValues;
    const booleanConfidence = booleanMatches / totalValues;

    // Ruby's decision logic - highest confidence wins
    const confidenceThreshold = DATA_TYPE_CONFIG.CONFIDENCE_THRESHOLD;
    
    if (integerConfidence >= confidenceThreshold) {
      return { type: DataType.INTEGER, confidence: integerConfidence };
    }
    
    if (decimalConfidence >= confidenceThreshold) {
      return { type: DataType.DECIMAL, confidence: decimalConfidence };
    }
    
    if (dateConfidence >= confidenceThreshold) {
      return { type: DataType.DATE, confidence: dateConfidence };
    }
    
    if (booleanConfidence >= confidenceThreshold) {
      return { type: DataType.BOOLEAN, confidence: booleanConfidence };
    }
    
    // Check for categorical data (limited unique values)
    if (totalValues <= DATA_TYPE_CONFIG.MAX_UNIQUE_VALUES_FOR_CATEGORICAL && 
        totalSamples > totalValues * 2) { // Must have some repetition
      return { type: DataType.CATEGORICAL, confidence: 0.8 };
    }
    
    // Default to text
    return { type: DataType.TEXT, confidence: 0.5 };
  }

  /**
   * RUBY OPTIMIZED: Get filter suggestions based on data types
   * Returns appropriate filter types for each column
   */
  static getFilterSuggestions(columnMetadata: ColumnMetadata[]): Record<string, string[]> {
    const suggestions: Record<string, string[]> = {};
    
    columnMetadata.forEach(column => {
      const filterTypes: string[] = [];
      
      switch (column.dataType) {
        case DataType.INTEGER:
        case DataType.DECIMAL:
          filterTypes.push('range', 'greater_than', 'less_than', 'equals');
          break;
          
        case DataType.DATE:
          filterTypes.push('date_range', 'before', 'after', 'equals');
          break;
          
        case DataType.BOOLEAN:
          filterTypes.push('equals', 'is_true', 'is_false');
          break;
          
        case DataType.CATEGORICAL:
          filterTypes.push('equals', 'in_list', 'not_equals');
          break;
          
        case DataType.TEXT:
        default:
          filterTypes.push('contains', 'starts_with', 'ends_with', 'equals', 'not_equals');
          break;
      }
      
      suggestions[column.name] = filterTypes;
    });
    
    return suggestions;
  }
}
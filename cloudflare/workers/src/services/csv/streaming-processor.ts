import type { CloudflareEnv } from '../../types/env';
import { R2StorageService } from '../storage/r2-service';

export interface CSVProcessingOptions {
  selectedColumns?: string[];
  whereFilters?: Record<string, string>;
  limit?: number;
  offset?: number;
  outputFormat?: 'csv' | 'json';
}

export interface CSVMetadata {
  totalRows: number;
  columns: string[];
  estimatedSize: number;
  sampleData?: string[][];
}

export interface StreamingProcessorResult {
  metadata: CSVMetadata;
  stream: ReadableStream<Uint8Array>;
}

/**
 * Streaming CSV processor for handling large CSV files efficiently
 * Processes files directly from R2 without loading entire files into memory
 */
export class StreamingCSVProcessor {
  private r2Service: R2StorageService;
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  constructor(r2Service: R2StorageService) {
    this.r2Service = r2Service;
  }

  /**
   * Process a CSV file with streaming to handle large files efficiently
   */
  async processCSVFile(
    fileId: string,
    userId: string,
    options: CSVProcessingOptions = {}
  ): Promise<StreamingProcessorResult> {
    const {
      selectedColumns,
      whereFilters = {},
      limit,
      offset = 0,
      outputFormat = 'csv'
    } = options;

    // Get file object from R2
    const fileObject = await this.r2Service.downloadFile(fileId, userId);
    if (!fileObject) {
      throw new Error('File not found');
    }

    // First pass: analyze CSV structure and get metadata
    const metadata = await this.analyzeCSVStructure(fileObject.body);

    // Determine which columns to include
    const columnsToInclude = selectedColumns || metadata.columns;
    const columnIndexes = this.getColumnIndexes(metadata.columns, columnsToInclude);

    // Create processing stream
    const processingStream = this.createProcessingStream(
      fileObject.body,
      columnIndexes,
      whereFilters,
      limit,
      offset,
      outputFormat,
      metadata.columns
    );

    return {
      metadata: {
        ...metadata,
        columns: columnsToInclude
      },
      stream: processingStream
    };
  }

  /**
   * Analyze CSV structure without loading entire file into memory
   */
  private async analyzeCSVStructure(
    stream: ReadableStream<Uint8Array>
  ): Promise<CSVMetadata> {
    const reader = stream.getReader();
    let buffer = '';
    let lineCount = 0;
    let columns: string[] = [];
    let estimatedSize = 0;
    const sampleData: string[][] = [];
    const maxSampleRows = 10;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        estimatedSize += value.byteLength;
        buffer += this.textDecoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            lineCount++;

            if (lineCount === 1) {
              // Parse header row
              columns = this.parseCSVLine(line);
            } else if (sampleData.length < maxSampleRows) {
              // Collect sample data
              sampleData.push(this.parseCSVLine(line));
            }

            // Early termination for analysis - we don't need to read the entire file
            if (lineCount >= 1000 && sampleData.length >= maxSampleRows) {
              break;
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        lineCount++;
        if (lineCount === 1) {
          columns = this.parseCSVLine(buffer);
        } else if (sampleData.length < maxSampleRows) {
          sampleData.push(this.parseCSVLine(buffer));
        }
      }

      return {
        totalRows: lineCount - 1, // Subtract header row
        columns,
        estimatedSize,
        sampleData
      };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Create a processing stream for CSV transformation
   */
  private createProcessingStream(
    sourceStream: ReadableStream<Uint8Array>,
    columnIndexes: number[],
    whereFilters: Record<string, string>,
    limit?: number,
    offset = 0,
    outputFormat: 'csv' | 'json' = 'csv',
    originalColumns: string[] = []
  ): ReadableStream<Uint8Array> {
    let lineCount = 0;
    let processedCount = 0;
    let buffer = '';
    let headerSent = false;

    return new ReadableStream({
      start(controller) {
        if (outputFormat === 'csv' && columnIndexes.length > 0) {
          // Send CSV header
          const headerColumns = columnIndexes.map(idx => originalColumns[idx] || `column_${idx}`);
          const headerLine = this.formatCSVLine(headerColumns) + '\n';
          controller.enqueue(this.textEncoder.encode(headerLine));
          headerSent = true;
        } else if (outputFormat === 'json') {
          // Start JSON array
          controller.enqueue(this.textEncoder.encode('['));
          headerSent = true;
        }
      },

      async pull(controller) {
        const reader = sourceStream.getReader();
        let shouldContinue = true;

        try {
          while (shouldContinue) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Process remaining buffer
              if (buffer.trim()) {
                const processedLine = this.processLine(
                  buffer,
                  lineCount,
                  columnIndexes,
                  whereFilters,
                  offset,
                  limit,
                  processedCount,
                  outputFormat,
                  originalColumns
                );

                if (processedLine) {
                  controller.enqueue(this.textEncoder.encode(processedLine));
                  processedCount++;
                }
              }

              // Close JSON array if needed
              if (outputFormat === 'json') {
                controller.enqueue(this.textEncoder.encode(']'));
              }

              controller.close();
              break;
            }

            buffer += this.textDecoder.decode(value, { stream: true });

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                lineCount++;

                // Skip header row for processing
                if (lineCount === 1) continue;

                const processedLine = this.processLine(
                  line,
                  lineCount,
                  columnIndexes,
                  whereFilters,
                  offset,
                  limit,
                  processedCount,
                  outputFormat,
                  originalColumns
                );

                if (processedLine) {
                  controller.enqueue(this.textEncoder.encode(processedLine));
                  processedCount++;

                  // Check if we've reached the limit
                  if (limit && processedCount >= limit) {
                    shouldContinue = false;
                    break;
                  }
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    });
  }

  /**
   * Process a single line based on filtering criteria
   */
  private processLine(
    line: string,
    lineNumber: number,
    columnIndexes: number[],
    whereFilters: Record<string, string>,
    offset: number,
    limit: number | undefined,
    processedCount: number,
    outputFormat: 'csv' | 'json',
    originalColumns: string[]
  ): string | null {
    const values = this.parseCSVLine(line);

    // Apply WHERE filters
    if (!this.applyFilters(values, whereFilters, originalColumns)) {
      return null;
    }

    // Apply offset
    if (processedCount < offset) {
      return null;
    }

    // Apply limit
    if (limit && processedCount >= limit) {
      return null;
    }

    // Extract selected columns
    const selectedValues = columnIndexes.map(idx => values[idx] || '');

    // Format output
    if (outputFormat === 'csv') {
      return this.formatCSVLine(selectedValues) + '\n';
    } else {
      // JSON format
      const jsonObject: Record<string, string> = {};
      columnIndexes.forEach((idx, i) => {
        const columnName = originalColumns[idx] || `column_${idx}`;
        jsonObject[columnName] = selectedValues[i];
      });

      const jsonLine = JSON.stringify(jsonObject);
      return processedCount > 0 ? ',' + jsonLine : jsonLine;
    }
  }

  /**
   * Apply WHERE filters to a row
   */
  private applyFilters(
    values: string[],
    filters: Record<string, string>,
    columns: string[]
  ): boolean {
    for (const [columnName, filterValue] of Object.entries(filters)) {
      const columnIndex = columns.indexOf(columnName);
      if (columnIndex === -1) continue;

      const cellValue = values[columnIndex] || '';
      
      if (!this.evaluateFilter(cellValue, filterValue)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single filter condition
   */
  private evaluateFilter(value: string, filter: string): boolean {
    if (!filter) return true;

    // Handle different filter operators
    if (filter.startsWith('=')) {
      return value === filter.substring(1);
    } else if (filter.startsWith('!=')) {
      return value !== filter.substring(2);
    } else if (filter.startsWith('>=')) {
      return parseFloat(value) >= parseFloat(filter.substring(2));
    } else if (filter.startsWith('<=')) {
      return parseFloat(value) <= parseFloat(filter.substring(2));
    } else if (filter.startsWith('>')) {
      return parseFloat(value) > parseFloat(filter.substring(1));
    } else if (filter.startsWith('<')) {
      return parseFloat(value) < parseFloat(filter.substring(1));
    } else if (filter.startsWith('~')) {
      // Regex match
      try {
        const regex = new RegExp(filter.substring(1), 'i');
        return regex.test(value);
      } catch {
        return false;
      }
    } else if (filter.includes('*')) {
      // Wildcard match
      const regex = new RegExp(filter.replace(/\*/g, '.*'), 'i');
      return regex.test(value);
    } else {
      // Default: contains (case-insensitive)
      return value.toLowerCase().includes(filter.toLowerCase());
    }
  }

  /**
   * Parse a CSV line handling quoted values and escapes
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        values.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    values.push(current.trim());
    return values;
  }

  /**
   * Format values as CSV line with proper escaping
   */
  private formatCSVLine(values: string[]): string {
    return values.map(value => {
      // Escape values that contain commas, quotes, or newlines
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    }).join(',');
  }

  /**
   * Get column indexes for selected columns
   */
  private getColumnIndexes(allColumns: string[], selectedColumns: string[]): number[] {
    return selectedColumns.map(col => {
      const index = allColumns.indexOf(col);
      return index >= 0 ? index : -1;
    }).filter(index => index >= 0);
  }

  /**
   * Generate CSV preview without full processing
   */
  async generatePreview(
    fileId: string,
    userId: string,
    maxRows = 10
  ): Promise<{ columns: string[]; rows: string[][]; totalRows: number }> {
    const fileObject = await this.r2Service.downloadFile(fileId, userId);
    if (!fileObject) {
      throw new Error('File not found');
    }

    const reader = fileObject.body.getReader();
    let buffer = '';
    let lineCount = 0;
    let columns: string[] = [];
    const rows: string[][] = [];

    try {
      while (lineCount <= maxRows) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += this.textDecoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            lineCount++;

            if (lineCount === 1) {
              columns = this.parseCSVLine(line);
            } else if (rows.length < maxRows) {
              rows.push(this.parseCSVLine(line));
            }

            if (lineCount > maxRows) break;
          }
        }
      }

      // Get total row count by analyzing the file
      const metadata = await this.analyzeCSVStructure(fileObject.body);

      return {
        columns,
        rows,
        totalRows: metadata.totalRows
      };
    } finally {
      reader.releaseLock();
    }
  }
}
/**
 * CrosstabProcessor - Core CSV processing logic for crosstab analysis
 * 
 * Handles CSV parsing, field extraction, and crosstab generation following
 * Cutty's established patterns for efficient data processing within
 * Cloudflare Workers constraints.
 */

import type { CrosstabData, FieldsResponse } from '../types';

export class CrosstabProcessor {
  /**
   * Extract field names from CSV content
   */
  static extractFields(csvContent: string): { fields: string[]; rowCount: number } {
    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length === 0) {
        return { fields: [], rowCount: 0 };
      }

      // Parse header row - handle quoted fields and commas within quotes
      const headerLine = lines[0];
      const fields = this.parseCSVLine(headerLine);
      
      return {
        fields: fields.map(field => field.trim()),
        rowCount: lines.length - 1 // Subtract header row
      };
    } catch (error) {
      throw new Error(`Failed to extract fields: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate crosstab analysis from CSV content
   */
  static async generateCrosstab(
    csvContent: string,
    rowVariable: string,
    columnVariable: string
  ): Promise<CrosstabData> {
    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must contain at least a header row and one data row');
      }

      // Parse header to get field positions
      const headers = this.parseCSVLine(lines[0]);
      const rowVariableIndex = headers.findIndex(h => h.trim() === rowVariable);
      const columnVariableIndex = headers.findIndex(h => h.trim() === columnVariable);

      if (rowVariableIndex === -1) {
        throw new Error(`Row variable "${rowVariable}" not found in CSV headers`);
      }
      if (columnVariableIndex === -1) {
        throw new Error(`Column variable "${columnVariable}" not found in CSV headers`);
      }
      if (rowVariableIndex === columnVariableIndex) {
        throw new Error('Row and column variables must be different');
      }

      // Initialize crosstab structure
      const crosstab: Record<string, Record<string, number>> = {};
      const rowTotals: Record<string, number> = {};
      const columnTotals: Record<string, number> = {};
      let grandTotal = 0;
      let processedRows = 0;

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        try {
          const values = this.parseCSVLine(line);
          
          // Get row and column values, handle missing data
          const rowValue = (values[rowVariableIndex] || '').trim() || '(empty)';
          const columnValue = (values[columnVariableIndex] || '').trim() || '(empty)';

          // Initialize nested structure if needed
          if (!crosstab[rowValue]) {
            crosstab[rowValue] = {};
            rowTotals[rowValue] = 0;
          }
          if (!crosstab[rowValue][columnValue]) {
            crosstab[rowValue][columnValue] = 0;
          }
          if (!columnTotals[columnValue]) {
            columnTotals[columnValue] = 0;
          }

          // Increment counts
          crosstab[rowValue][columnValue]++;
          rowTotals[rowValue]++;
          columnTotals[columnValue]++;
          grandTotal++;
          processedRows++;
        } catch (rowError) {
          console.warn(`Skipping malformed row ${i + 1}:`, rowError);
          // Continue processing other rows
        }
      }

      // Ensure all row/column combinations exist in the crosstab (fill with 0)
      const uniqueRowValues = Object.keys(crosstab);
      const uniqueColumnValues = Object.keys(columnTotals);

      for (const rowValue of uniqueRowValues) {
        for (const columnValue of uniqueColumnValues) {
          if (!crosstab[rowValue][columnValue]) {
            crosstab[rowValue][columnValue] = 0;
          }
        }
      }

      return {
        crosstab,
        rowTotals,
        columnTotals,
        grandTotal,
        rowVariable,
        columnVariable
      };
    } catch (error) {
      throw new Error(`Failed to generate crosstab: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate CSV export format from crosstab data
   */
  static generateExportCSV(data: CrosstabData): string {
    const { crosstab, rowTotals, columnTotals, grandTotal, rowVariable, columnVariable } = data;

    const uniqueRowValues = Object.keys(crosstab).sort();
    const uniqueColumnValues = Object.keys(columnTotals).sort();

    // Build CSV content
    const lines: string[] = [];

    // Header row
    const headerRow = [`${rowVariable}/${columnVariable}`, ...uniqueColumnValues, 'Total'];
    lines.push(headerRow.map(cell => this.escapeCSVCell(cell)).join(','));

    // Data rows
    for (const rowValue of uniqueRowValues) {
      const dataRow = [
        rowValue,
        ...uniqueColumnValues.map(colValue => crosstab[rowValue][colValue]?.toString() || '0'),
        rowTotals[rowValue]?.toString() || '0'
      ];
      lines.push(dataRow.map(cell => this.escapeCSVCell(cell)).join(','));
    }

    // Total row
    const totalRow = [
      'Total',
      ...uniqueColumnValues.map(colValue => columnTotals[colValue]?.toString() || '0'),
      grandTotal.toString()
    ];
    lines.push(totalRow.map(cell => this.escapeCSVCell(cell)).join(','));

    return lines.join('\n');
  }

  /**
   * Parse a single CSV line handling quoted fields and embedded commas
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
          // Escaped quote - add single quote to current field
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator - add current field to result
        result.push(current);
        current = '';
        i++;
      } else {
        // Regular character
        current += char;
        i++;
      }
    }

    // Add final field
    result.push(current);

    return result;
  }

  /**
   * Escape CSV cell content for export
   */
  private static escapeCSVCell(cell: string): string {
    // Convert to string if not already
    const str = String(cell);
    
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    
    return str;
  }
}
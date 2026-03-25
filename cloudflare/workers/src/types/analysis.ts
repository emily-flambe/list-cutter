/**
 * Cuttytabs Analysis Types (crosstab, fields, export)
 */

export interface CrosstabRequest {
  rowVariable: string;
  columnVariable?: string;
  includePercentages?: boolean;
}

export interface CrosstabData {
  crosstab: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  columnTotals: Record<string, number>;
  grandTotal: number;
  rowVariable: string;
  columnVariable: string;
  rowPercentages: Record<string, Record<string, number>>;
  columnPercentages: Record<string, Record<string, number>>;
  totalPercentages: Record<string, Record<string, number>>;
}

export interface CrosstabResponse {
  success: boolean;
  data: CrosstabData;
  metadata: {
    processedRows: number;
    uniqueRowValues: number;
    uniqueColumnValues: number;
  };
}

export interface FieldsResponse {
  success: boolean;
  fields: string[];
  rowCount: number;
  fileInfo: {
    id: string;
    filename: string;
    size: number;
  };
}

export interface CrosstabExportRequest {
  rowVariable: string;
  columnVariable?: string;
  filename?: string;
}

export interface CrosstabExportResponse {
  success: boolean;
  downloadUrl: string;
  savedFile: {
    id: string;
    filename: string;
    size: number;
    createdAt: string;
  };
  message: string;
}

export interface ExportedCrosstabMetadata {
  source: 'analysis-crosstab';
  originalFileId: string;
  originalFilename: string;
  analysisType: 'crosstab';
  rowVariable: string;
  columnVariable: string;
  generatedAt: string;
  rowCount: number;
  columnCount: number;
}

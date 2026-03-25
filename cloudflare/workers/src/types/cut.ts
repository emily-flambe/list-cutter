/**
 * CUT (Cutty Ultimate Tool) types - column analysis, filters, and queries
 */

// CUT Phase 1 Foundation Types
export interface ColumnMetadata {
  name: string;
  dataType: 'integer' | 'decimal' | 'date' | 'boolean' | 'categorical' | 'text';
  confidence: number;
  sampleValues: string[];
  uniqueValueCount: number;
  nullCount: number;
  totalSamples: number;
}

export interface ColumnsAnalysisResponse {
  success: boolean;
  columns: ColumnMetadata[];
  filterSuggestions: Record<string, string[]>;
  fileInfo: {
    id: string;
    filename: string;
    size: number;
    totalRows: number;
    totalColumns: number;
  };
  metadata: {
    rowsAnalyzed: number;
    processingTimeMs: number;
    performance: {
      database_query_ms: number;
      r2_retrieval_ms: number;
      file_read_ms: number;
      analysis_processing_ms: number;
      total_time_ms: number;
      throughput_mbps: number;
    };
  };
}

export interface FilterConfiguration {
  id: string;
  fileId: string;
  userId: string;
  columnName: string;
  dataType: string;
  filterType: string;
  filterValue: string; // JSON-encoded parameters
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// CUT Phase 2: Enhanced Filter Types
export enum FilterType {
  // Text filters
  CONTAINS = 'contains',
  EQUALS = 'equals',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  REGEX = 'regex',
  IN_LIST = 'in_list',
  NOT_EQUALS = 'not_equals',

  // Number filters
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  BETWEEN = 'between',
  NOT_NULL = 'not_null',
  IS_NULL = 'is_null',

  // Date filters
  DATE_RANGE = 'date_range',
  BEFORE = 'before',
  AFTER = 'after',
  LAST_N_DAYS = 'last_n_days',
  THIS_MONTH = 'this_month',
  THIS_YEAR = 'this_year',

  // Boolean filters
  IS_TRUE = 'is_true',
  IS_FALSE = 'is_false',
}

export interface FilterOperator {
  type: FilterType;
  columnName: string;
  value: any;
  negated?: boolean;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  filters: (FilterOperator | FilterGroup)[];
}

export interface QueryRequest {
  fileId: string;
  filters: FilterOperator[];
  logicalOperator?: 'AND' | 'OR';
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  success: boolean;
  data: {
    rows: Record<string, any>[];
    totalRows: number;
    filteredRows: number;
    columns: string[];
  };
  metadata: {
    processingTimeMs: number;
    filtersApplied: number;
    performance: {
      file_read_ms: number;
      filtering_ms: number;
      total_time_ms: number;
      throughput_mbps: number;
    };
  };
}

export interface FilterRequest {
  columnName: string;
  filterType: string;
  value: any; // Will be JSON encoded
}

export interface CutFilterRequest {
  fileId: string;
  filters: FilterRequest[];
}

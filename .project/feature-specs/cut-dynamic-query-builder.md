# CUT (Cutty Ultimate Tool) - Feature Specification

## Overview
CUT is a dynamic query builder that transforms Cutty from a simple CSV processor into a powerful data analysis platform. It enables users to interactively filter, analyze, and export CSV data through an intuitive column-based interface.

## Core Components

### 1. Dynamic Filter Builder
**Purpose**: Enable column-by-column query construction with intelligent data type detection

**Expected Behaviors**:
- Automatically detect and display column data types (text, number, date, boolean)
- Provide context-appropriate filter operators per data type
- Support complex queries with AND/OR logical operators
- Maintain filter state across component re-renders

**Integration Points**:
- Leverages existing `CrosstabProcessor` service
- Uses Material-UI components matching existing design patterns
- Integrates with current file management system

### 2. Real-time vs Manual Updates
**Purpose**: Balance performance with user experience based on dataset size

**Behavior Thresholds**:
- **< 10,000 rows**: Real-time filter updates on every change
- **10,000-50,000 rows**: Debounced updates (500ms delay)
- **> 50,000 rows**: Manual "Recalculate" button required

**Performance Requirements**:
- Query response < 2s for datasets under 50,000 rows
- Progress indicators for operations > 500ms
- Query result caching for repeated filter applications

### 3. Analysis Viewer
**Purpose**: Display filtered data insights through crosstabs and statistics

**Expected Behaviors**:
- Generate frequency tables with row/column percentages
- Display summary statistics (count, unique values, nulls)
- Integrate with existing `CuttytabsTable` component
- Update analysis when filters change (respecting update strategy)

**Testing Criteria**:
- Crosstab calculations match expected statistical outputs
- Null values handled correctly in frequency counts
- Performance acceptable for datasets up to 100,000 rows

### 4. Export Manager
**Purpose**: Save filtered results as new CSV files with metadata preservation

**Expected Behaviors**:
- "CUT IT" button exports currently filtered dataset
- Preserve original column structure and data types
- Include filter metadata in file description
- Add exported file to user's file list automatically

**Integration Requirements**:
- Use existing file storage (Cloudflare R2)
- Maintain compatibility with current file management UI
- Generate unique filenames with timestamp

## API Endpoints

### Core Endpoints (All under `/api/v1/`)
```
GET  /files/:fileId/columns     - Column metadata with data types
POST /files/:fileId/query       - Execute filter query
POST /files/:fileId/analyze     - Generate analysis results
POST /files/:fileId/export-filtered - Export filtered data
```

### Filter Management
```
POST /filters/save              - Save filter configuration
GET  /filters                   - List saved filters
POST /filters/:filterId/apply   - Apply saved filter to file
```

## Data Type Filter Operators

### Text
- Contains, Equals, Starts With, Ends With
- Regex matching (advanced users)
- In List (comma-separated values)

### Number
- Equals, Greater Than, Less Than, Between
- In Range (min-max)
- Null/Not Null

### Date
- Date Range (start-end)
- Before/After specific date
- Relative dates (Last 30 days, This month, This year)

### Boolean
- True, False, Null

## State Management

### Component State Structure
```typescript
interface CUTState {
  selectedFile: FileMetadata | null;
  columns: ColumnMetadata[];
  filters: FilterConfiguration[];
  previewData: PreviewData | null;
  analysisConfig: AnalysisConfiguration;
  updateStrategy: 'realtime' | 'manual' | 'debounced';
  isLoading: boolean;
  error: string | null;
}
```

### Filter Configuration
```typescript
interface FilterConfiguration {
  id: string;
  columnName: string;
  dataType: DataType;
  operator: FilterOperator;
  value: FilterValue;
  logicalOperator?: 'AND' | 'OR';
}
```

## Error Handling

### User-Facing Error Categories
1. **Validation Errors**: Clear messages about invalid filter values
2. **Performance Warnings**: File size limitations, timeout notifications
3. **Data Issues**: Malformed CSV, missing columns, encoding problems
4. **System Errors**: Storage failures, authentication issues

### Recovery Strategies
- Auto-save filter state to localStorage
- Retry failed API calls with exponential backoff
- Provide manual refresh option for stuck operations
- Clear error messages with actionable solutions

## Database Schema Extensions

### Required Tables
```sql
-- Saved filter configurations
filter_configurations (id, user_id, name, filters, created_at)

-- Query result cache
query_cache (file_id, filters_hash, result_data, expires_at)

-- Column metadata cache
column_metadata (file_id, column_name, data_type, metadata)
```

## Testing Requirements

### Unit Tests
- Data type detection accuracy
- Filter operator logic for each data type
- Query result validation
- Export metadata preservation

### Integration Tests
- End-to-end filter application workflow
- File size threshold behaviors
- Saved filter compatibility checks
- Export and file management integration

### Performance Tests
- Query execution time vs dataset size
- Memory usage for large datasets
- Concurrent user query handling
- Cache effectiveness metrics

## Security Considerations
- Validate all filter inputs to prevent injection attacks
- Enforce file access permissions in query operations
- Rate limit analysis endpoints to prevent DoS
- Sanitize regex patterns in text filters
- Audit log filter operations for compliance

## Debugging Checklist

### Common Issues
1. **Filters not applying**: Check filter configuration structure, validate column names match exactly
2. **Performance degradation**: Verify query cache is working, check for N+1 query patterns
3. **Export failures**: Validate R2 storage permissions, check file size limits
4. **Type detection errors**: Review sample size for type inference, handle mixed-type columns
5. **UI not updating**: Confirm update strategy matches file size, check React component keys

### Debug Data Points
- Current filter configuration JSON
- File metadata (size, row count, column count)
- Update strategy in use
- API response times
- Cache hit/miss ratios

## Migration Path
1. Deploy backend services with feature flag disabled
2. Test with subset of beta users
3. Gradually enable for all users
4. Monitor performance metrics and error rates
5. Optimize based on usage patterns

---
*Version: 1.0.0 | Feature: CUT Dynamic Query Builder | Status: In Development*
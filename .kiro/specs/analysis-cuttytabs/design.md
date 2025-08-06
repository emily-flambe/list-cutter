# Design Document

## Overview

The Analysis section with Cuttytabs (Crosstabs) feature introduces statistical analysis capabilities to Cutty's CSV processing platform. This feature allows users to create two-dimensional frequency tables (crosstabs) from their uploaded CSV files, providing insights into the relationship between two categorical variables. The design follows Cutty's existing architectural patterns using React with Material-UI on the frontend and Hono.js with Cloudflare Workers on the backend.

## Architecture

### Frontend Architecture

The Analysis section will be implemented as a new React component following Cutty's existing patterns:

- **Analysis.jsx** - Main analysis component with navigation to different analysis tools
- **Cuttytabs.jsx** - Crosstab-specific component handling file selection, field selection, and results display
- **CuttytabsTable.jsx** - Reusable component for displaying crosstab results in a formatted table

### Backend Architecture

The backend will extend the existing files API with new analysis endpoints:

- **GET /api/v1/files/:fileId/fields** - Extract field names from a CSV file
- **POST /api/v1/files/:fileId/analyze/crosstab** - Generate crosstab analysis
- **POST /api/v1/files/:fileId/export/crosstab** - Export crosstab results as CSV (downloads and saves to user's files)

### Data Flow

1. User navigates to Analysis section
2. Frontend fetches user's uploaded files from existing `/api/v1/files` endpoint
3. User selects a file, frontend calls `/api/v1/files/:fileId/fields` to get available columns
4. User selects two fields, frontend calls `/api/v1/files/:fileId/analyze/crosstab` with parameters
5. Backend processes CSV data and returns crosstab results
6. Frontend displays results in formatted table with export option
7. When user exports, backend generates CSV file, saves it to user's file list, and provides download URL
8. Frontend triggers download and refreshes file list to show the new exported file

## Components and Interfaces

### Frontend Components

#### Analysis.jsx
```jsx
// Main analysis section component
const Analysis = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 4 }}>
        Analysis
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">Cuttytabs (Crosstabs)</Typography>
              <Typography variant="body2" color="text.secondary">
                Create cross-tabulation tables to analyze relationships between two variables
              </Typography>
              <Button component={Link} to="/analysis/cuttytabs" variant="contained" sx={{ mt: 2 }}>
                Open Cuttytabs
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
```

#### Cuttytabs.jsx
```jsx
// Main crosstab analysis component
const Cuttytabs = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [fields, setFields] = useState([]);
  const [rowVariable, setRowVariable] = useState('');
  const [columnVariable, setColumnVariable] = useState('');
  const [crosstabData, setCrosstabData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Component logic for file selection, field selection, and crosstab generation
};
```

#### CuttytabsTable.jsx
```jsx
// Reusable crosstab table display component
const CuttytabsTable = ({ data, rowVariable, columnVariable }) => {
  // Renders formatted crosstab table with totals
};
```

### Backend API Interfaces

#### GET /api/v1/files/:fileId/fields
```typescript
interface FieldsResponse {
  success: boolean;
  fields: string[];
  rowCount: number;
  fileInfo: {
    id: string;
    filename: string;
    size: number;
  };
}
```

#### POST /api/v1/files/:fileId/analyze/crosstab
```typescript
interface CrosstabRequest {
  rowVariable: string;
  columnVariable: string;
  includePercentages?: boolean;
}

interface CrosstabResponse {
  success: boolean;
  data: {
    crosstab: Record<string, Record<string, number>>;
    rowTotals: Record<string, number>;
    columnTotals: Record<string, number>;
    grandTotal: number;
    rowVariable: string;
    columnVariable: string;
  };
  metadata: {
    processedRows: number;
    uniqueRowValues: number;
    uniqueColumnValues: number;
  };
}
```

#### POST /api/v1/files/:fileId/export/crosstab
```typescript
interface CrosstabExportRequest {
  rowVariable: string;
  columnVariable: string;
  filename?: string; // Optional custom filename
}

interface CrosstabExportResponse {
  success: boolean;
  downloadUrl: string; // Temporary download URL
  savedFile: {
    id: string;
    filename: string;
    size: number;
    createdAt: string;
  };
  message: string;
}
```

### Navigation Integration

The Analysis section will be added to the existing navigation structure in Layout.jsx:

```jsx
// Add to menuItems array in Layout.jsx
...(token ? [{ text: 'Analysis', icon: <AnalyticsIcon />, path: '/analysis' }] : []),
```

### Routing Integration

New routes will be added to App.jsx:

```jsx
// Add to Routes in App.jsx
<Route path="/analysis" element={<Analysis />} />
<Route path="/analysis/cuttytabs" element={<Cuttytabs />} />
```

## Data Models

### Crosstab Data Structure

The crosstab analysis will use the following data structure:

```typescript
interface CrosstabData {
  crosstab: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  columnTotals: Record<string, number>;
  grandTotal: number;
  rowVariable: string;
  columnVariable: string;
}

// Example:
{
  crosstab: {
    "Male": { "Yes": 15, "No": 10 },
    "Female": { "Yes": 20, "No": 5 }
  },
  rowTotals: { "Male": 25, "Female": 25 },
  columnTotals: { "Yes": 35, "No": 15 },
  grandTotal: 50,
  rowVariable: "Gender",
  columnVariable: "Response"
}
```

### CSV Processing Logic

The backend will implement CSV parsing and crosstab generation:

```typescript
class CrosstabProcessor {
  static async generateCrosstab(
    csvContent: string, 
    rowVariable: string, 
    columnVariable: string
  ): Promise<CrosstabData> {
    // Parse CSV content
    // Extract specified columns
    // Generate frequency counts
    // Calculate totals
    // Return structured data
  }
}
```

## Error Handling

### Frontend Error Handling

- File selection errors (no files available, file access issues)
- Field selection validation (same field selected for both variables)
- API communication errors with user-friendly messages
- Crosstab generation failures with specific error details

### Backend Error Handling

- File not found or access denied (404)
- Invalid field names (400)
- CSV parsing errors (400)
- Processing failures (500)
- Authentication errors (401)

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  details?: any;
}
```

## Testing Strategy

### Frontend Testing

- **Unit Tests**: Component rendering, state management, user interactions
- **Integration Tests**: API communication, data flow between components
- **E2E Tests**: Complete user workflow from file selection to crosstab display

### Backend Testing

- **Unit Tests**: CSV parsing logic, crosstab calculation algorithms
- **Integration Tests**: API endpoints, database interactions, file access
- **Performance Tests**: Large file processing, memory usage optimization

### Test Data

- Sample CSV files with various data types and sizes
- Edge cases: empty files, single column files, files with missing values
- Performance test files: large datasets with many unique values

### Testing Framework Integration

Following Cutty's existing testing patterns:
- **Frontend**: Vitest for unit tests, React Testing Library for component tests
- **Backend**: Vitest for unit tests, custom test fixtures for integration tests
- **E2E**: Playwright for end-to-end testing

## Implementation Considerations

### Performance Optimization

- **Streaming CSV Processing**: Process large files without loading entire content into memory
- **Caching**: Cache field extraction results for recently accessed files
- **Pagination**: Limit crosstab display for very large result sets
- **Background Processing**: Consider worker threads for CPU-intensive calculations

### Security Considerations

- **File Access Control**: Ensure users can only analyze their own files
- **Input Validation**: Sanitize field names and parameters
- **Rate Limiting**: Prevent abuse of analysis endpoints
- **Memory Limits**: Prevent memory exhaustion from large file processing

### Scalability Considerations

- **Cloudflare Workers Limits**: Respect CPU time and memory constraints
- **Database Efficiency**: Optimize file metadata queries
- **R2 Storage**: Efficient file streaming from object storage
- **Caching Strategy**: Use Cloudflare KV for frequently accessed analysis results

### Export Functionality

The enhanced export feature provides dual functionality:

#### Download and Save Process
1. **User Initiates Export**: User clicks export button from crosstab results
2. **Backend Processing**: 
   - Generates CSV file with crosstab data including row/column totals
   - Creates unique filename (e.g., "crosstab_Gender_Response_2025-01-08.csv")
   - Saves file to user's R2 storage with appropriate metadata
   - Adds file record to database with source tag "analysis-crosstab"
   - Returns both download URL and saved file information
3. **Frontend Handling**:
   - Triggers immediate download for user
   - Shows success message indicating file was saved
   - Refreshes file list (if ManageFiles component is open)
   - Updates global file refresh function if available

#### File Metadata for Exported Crosstabs
```typescript
interface ExportedCrosstabMetadata {
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
```

#### CSV Export Format
The exported CSV will include:
- Header row with column variable values plus "Total"
- Data rows with row variable values and counts
- Final row with column totals
- Clear labeling for variables in first cell

Example exported CSV:
```csv
Gender/Response,Yes,No,Total
Male,15,10,25
Female,20,5,25
Total,35,15,50
```

### User Experience Enhancements

- **Progressive Disclosure**: Show analysis options based on file characteristics
- **Smart Defaults**: Suggest appropriate field combinations
- **Visual Feedback**: Clear indication of processing status and results
- **Responsive Design**: Ensure crosstab tables work well on mobile devices
- **Export Integration**: Seamless export experience with immediate download and automatic file saving
- **File Management Integration**: Exported files appear in user's file list with clear source identification

This design provides a solid foundation for implementing the Analysis section with Cuttytabs while maintaining consistency with Cutty's existing architecture and user experience patterns.
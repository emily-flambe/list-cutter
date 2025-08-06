# Implementation Plan

- [ ] 1. Set up Analysis section navigation and routing
  - Add Analysis navigation item to Layout.jsx with AnalyticsIcon
  - Add Analysis routes to App.jsx for /analysis and /analysis/cuttytabs
  - Create basic Analysis.jsx component with navigation to Cuttytabs
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Create backend API endpoints for crosstab analysis
  - [ ] 2.1 Implement GET /api/v1/files/:fileId/fields endpoint
    - Add route to extract and return CSV field names from uploaded files
    - Include file metadata (row count, file info) in response
    - Add proper error handling for file access and CSV parsing
    - _Requirements: 3.1, 3.2, 4.4_

  - [ ] 2.2 Implement POST /api/v1/files/:fileId/analyze/crosstab endpoint
    - Create CrosstabProcessor class for CSV parsing and analysis
    - Generate crosstab frequency tables with row/column totals
    - Return structured crosstab data with metadata
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 2.3 Implement POST /api/v1/files/:fileId/export/crosstab endpoint
    - Generate CSV file from crosstab data with proper formatting
    - Save exported file to user's R2 storage with analysis metadata
    - Add file record to database with "analysis-crosstab" source tag
    - Return both download URL and saved file information
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 3. Create Cuttytabs frontend component
  - [ ] 3.1 Implement file selection interface
    - Create dropdown showing user's uploaded CSV files
    - Handle empty file list with link to Files section
    - Add file selection state management and validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.2 Implement field selection interface
    - Create two dropdowns for Row Variable and Column Variable selection
    - Fetch and populate field names when file is selected
    - Add validation warning for same field selection (but allow it)
    - Enable Generate Crosstab button when both fields selected
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.3 Implement crosstab results display
    - Create CuttytabsTable component for formatted table display
    - Display crosstab data with row headers, column headers, and counts
    - Include row totals, column totals, and grand total
    - Handle zero values and empty cells appropriately
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 4. Implement export functionality
  - [ ] 4.1 Add export button and download handling
    - Create export button that appears after successful crosstab generation
    - Implement API call to export endpoint with current analysis parameters
    - Handle file download trigger and success messaging
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 4.2 Integrate with file management system
    - Update global file refresh function after successful export
    - Show success message indicating file was saved to user's files
    - Handle export errors with appropriate user feedback
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5. Implement responsive design and theming
  - [ ] 5.1 Apply Cutty's theme and styling consistency
    - Use existing Material-UI theme configuration
    - Apply consistent fonts, colors, and component styling
    - Ensure theme switching works properly in Analysis section
    - _Requirements: 5.1, 5.4_

  - [ ] 5.2 Make crosstab table responsive
    - Implement horizontal scrolling for wide tables
    - Keep headers visible during scrolling
    - Optimize display for different screen sizes
    - _Requirements: 5.2, 5.3_

- [ ] 6. Add comprehensive error handling
  - [ ] 6.1 Implement frontend error handling
    - Handle file selection errors with user-friendly messages
    - Validate field selections and show appropriate warnings
    - Display API communication errors clearly
    - Handle crosstab generation failures with specific error details
    - _Requirements: 2.4, 3.4, 4.5, 6.4_

  - [ ] 6.2 Implement backend error handling
    - Add proper HTTP status codes for different error types
    - Return structured error responses with helpful messages
    - Handle file access, parsing, and processing errors
    - Implement authentication and authorization checks
    - _Requirements: 2.4, 3.4, 4.5, 6.4_

- [ ] 7. Write comprehensive tests
  - [ ] 7.1 Create frontend component tests
    - Test file selection dropdown functionality
    - Test field selection and validation logic
    - Test crosstab table rendering with various data sets
    - Test export functionality and error handling
    - _Requirements: All requirements_

  - [ ] 7.2 Create backend API tests
    - Test field extraction endpoint with various CSV formats
    - Test crosstab analysis with different data combinations
    - Test export functionality including file saving
    - Test error handling for invalid inputs and edge cases
    - _Requirements: All requirements_

- [ ] 8. Integration and end-to-end testing
  - Create complete user workflow tests from file selection to export
  - Test integration with existing file management system
  - Verify exported files appear correctly in user's file list
  - Test responsive behavior across different devices
  - _Requirements: All requirements_
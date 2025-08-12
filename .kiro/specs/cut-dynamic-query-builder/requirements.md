# Requirements Document

## Introduction

The CUT (Cutty Ultimate Tool) is a dynamic query builder that enables users to interactively filter, analyze, and export CSV data. The tool provides an intuitive interface for building complex data queries through column-by-column selection, intelligent filtering based on data types, manual-controlled analysis with crosstabs, and seamless data export functionality. This feature transforms Cutty from a simple CSV processor into a powerful data analysis platform.

## Requirements

### Requirement 1

**User Story:** As a data analyst, I want to select and filter CSV data columns dynamically, so that I can build custom queries without writing code.

#### Acceptance Criteria

1. WHEN a user uploads or selects a CSV file THEN the system SHALL display all available columns with their detected data types
2. WHEN a user clicks on a column THEN the system SHALL add it to the active filter builder
3. WHEN a column is added to the filter builder THEN the system SHALL display appropriate filter options based on the column's data type (text, number, date, boolean)
4. WHEN a user creates filters THEN the system SHALL require manual "Apply Filters" action for all file sizes
5. WHEN a user clicks "Apply Filters" THEN the system SHALL update the data preview with loading indicators
6. WHEN a user removes a filter THEN the system SHALL require manual "Apply Filters" action to update results

### Requirement 2

**User Story:** As a business user, I want intelligent filter options based on data types, so that I can easily create meaningful queries without technical knowledge.

#### Acceptance Criteria

1. WHEN a text column is selected THEN the system SHALL provide options for contains, equals, starts with, ends with, and regex matching
2. WHEN a numeric column is selected THEN the system SHALL provide options for equals, greater than, less than, between, and null/not null
3. WHEN a date column is selected THEN the system SHALL provide options for date ranges, before/after, and relative dates (last 30 days, this month, etc.)
4. WHEN a boolean column is selected THEN the system SHALL provide true/false/null options
5. WHEN multiple filters are applied THEN the system SHALL support AND/OR logic combinations

### Requirement 3

**User Story:** As a data analyst, I want to see analysis of filtered data through crosstabs and other visualizations after applying filters, so that I can understand data patterns before exporting.

#### Acceptance Criteria

1. WHEN filters are applied THEN the system SHALL display a crosstab analysis section below the filters
2. WHEN the user selects row and column variables for crosstabs THEN the system SHALL generate frequency tables with counts and percentages
3. WHEN the user clicks "recalculate" THEN the system SHALL update all analysis views with current filter results regardless of file size
4. WHEN data is filtered THEN the system SHALL show summary statistics (count, unique values, nulls) for each column
5. WHEN analysis is complete THEN the system SHALL display the total number of rows that match the current filters

### Requirement 4

**User Story:** As a data processor, I want to export filtered and analyzed data as a new CSV file, so that I can save my work and share results with others.

#### Acceptance Criteria

1. WHEN the user clicks "CUT IT" THEN the system SHALL export the currently filtered data as a new CSV file
2. WHEN exporting THEN the system SHALL preserve the original column structure and data types
3. WHEN a file is exported THEN the system SHALL save it to the user's file management system with a descriptive name
4. WHEN export is complete THEN the system SHALL provide a download link and add the file to the user's file list
5. WHEN exporting THEN the system SHALL include metadata about the filters applied in the file description

### Requirement 5

**User Story:** As a power user, I want to save and load filter configurations, so that I can reuse complex queries across different datasets.

#### Acceptance Criteria

1. WHEN a user creates a complex filter set THEN the system SHALL provide an option to save the filter configuration
2. WHEN saving filters THEN the system SHALL allow the user to name and describe the filter set
3. WHEN loading a saved filter THEN the system SHALL apply all previously configured filters to the current dataset
4. WHEN a saved filter is incompatible with the current dataset THEN the system SHALL show clear error messages
5. WHEN managing saved filters THEN the system SHALL allow users to edit, delete, and organize their filter collections


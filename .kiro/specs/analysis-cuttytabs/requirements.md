# Requirements Document

## Introduction

The Analysis section introduces advanced data analysis capabilities to Cutty, starting with Cuttytabs - an interactive crosstab (cross-tabulation) feature. This feature allows users to perform statistical analysis on their uploaded CSV files by creating two-dimensional frequency tables that show the relationship between two categorical variables. Users can select any uploaded file from their existing file collection and choose two field names to generate a crosstab that displays the count of records for each combination of values.

## Requirements

### Requirement 1

**User Story:** As a data analyst, I want to access an Analysis section in the main navigation, so that I can perform statistical analysis on my uploaded CSV files.

#### Acceptance Criteria

1. WHEN the user navigates to the application THEN the system SHALL display an "Analysis" option in the main navigation menu
2. WHEN the user clicks on the "Analysis" navigation item THEN the system SHALL display the Analysis section with available analysis tools
3. WHEN the Analysis section loads THEN the system SHALL show Cuttytabs as the first available analysis feature

### Requirement 2

**User Story:** As a user, I want to select a CSV file from my uploaded files for analysis, so that I can perform crosstab analysis on data I've already uploaded.

#### Acceptance Criteria

1. WHEN the user accesses the Cuttytabs feature THEN the system SHALL display a dropdown or selection interface showing all CSV files the user has previously uploaded
2. WHEN the user has no uploaded files THEN the system SHALL display a message indicating no files are available and provide a link to the Files section
3. WHEN the user selects a file THEN the system SHALL load and parse the file to extract available field names
4. IF the selected file cannot be accessed or parsed THEN the system SHALL display an appropriate error message

### Requirement 3

**User Story:** As a data analyst, I want to select two field names from my chosen CSV file, so that I can create a crosstab showing the relationship between these two variables.

#### Acceptance Criteria

1. WHEN a file is selected THEN the system SHALL display two dropdown menus for field selection labeled "Row Variable" and "Column Variable"
2. WHEN the field dropdowns are displayed THEN the system SHALL populate them with all available column headers from the selected CSV file
3. WHEN the user selects the same field for both variables THEN the system SHALL display a warning message but still allow the analysis to proceed
4. WHEN both fields are selected THEN the system SHALL enable a "Generate Crosstab" button or automatically generate the analysis

### Requirement 4

**User Story:** As a user, I want to view a crosstab table showing the count of records for each combination of my selected variables, so that I can understand the distribution and relationship between the two fields.

#### Acceptance Criteria

1. WHEN the user generates a crosstab THEN the system SHALL display a two-dimensional table with row headers from the first selected field and column headers from the second selected field
2. WHEN the crosstab is displayed THEN each cell SHALL show the count of records that match both the row and column criteria
3. WHEN a cell has zero records THEN the system SHALL display "0" or leave the cell empty with clear visual indication
4. WHEN the crosstab is generated THEN the system SHALL include row totals, column totals, and a grand total
5. IF the analysis fails due to data processing errors THEN the system SHALL display a clear error message explaining the issue

### Requirement 5

**User Story:** As a user, I want the crosstab interface to be responsive and visually consistent with the rest of Cutty, so that I have a seamless experience across the application.

#### Acceptance Criteria

1. WHEN the Analysis section loads THEN the system SHALL use the same theme, fonts, and styling as the rest of the Cutty application
2. WHEN the crosstab table is displayed THEN the system SHALL ensure it is responsive and readable on different screen sizes
3. WHEN the table is too wide for the screen THEN the system SHALL provide horizontal scrolling while keeping headers visible
4. WHEN the user switches themes THEN the Analysis section SHALL update to match the selected theme

### Requirement 6

**User Story:** As a user, I want to be able to export or save my crosstab results, so that I can use the analysis results in other applications or share them with colleagues.

#### Acceptance Criteria

1. WHEN a crosstab is successfully generated THEN the system SHALL provide an "Export" or "Download" button
2. WHEN the user clicks the export button THEN the system SHALL offer to download the crosstab as a CSV file
3. WHEN the export is initiated THEN the system SHALL generate a properly formatted CSV file with the crosstab data including totals
4. IF the export fails THEN the system SHALL display an appropriate error message


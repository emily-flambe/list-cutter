---
title: CSV Cutting Overview
category: Features
subcategory: CSV Cutting
keywords: csv cutting, data extraction, column selection, row filtering, data processing
difficulty: beginner
---

# CSV Cutting Overview

## What is CSV Cutting?

CSV cutting is the core feature of Cutty that allows you to extract specific data from your CSV files. Think of it as a smart pair of scissors that can precisely cut out exactly the data you need from larger datasets.

## Why Use CSV Cutting?

### Reduce File Size
Working with large CSV files can be slow and cumbersome. CSV cutting helps you:
- Extract only the columns you need
- Filter to specific rows that meet your criteria
- Create smaller, focused datasets
- Improve performance and reduce storage

### Focus on What Matters
Often you only need a subset of your data:
- Remove personal information from datasets
- Extract specific time periods
- Focus on particular categories or regions
- Create targeted reports

### Prepare Data for Analysis
CSV cutting prepares your data for:
- Import into other tools
- Analysis in spreadsheet applications
- Data visualization software
- Machine learning pipelines
- Database import processes

## Core Cutting Operations

### Column Selection
Choose exactly which columns to include in your output:
- Select by column name or position
- Reorder columns in your output
- Rename columns during export
- Hide sensitive or unnecessary data

### Row Filtering
Filter rows based on specific conditions:
- Text matching and pattern matching
- Numeric comparisons (greater than, less than, equals)
- Date range filtering
- Multiple condition combinations
- Include or exclude specific values

### Data Transformation
Basic transformations during cutting:
- Format standardization
- Case conversion (uppercase/lowercase)
- Date format normalization
- Numeric format adjustment

## How CSV Cutting Works

### Step 1: Upload Your File
Upload your CSV file to Cutty (up to 50MB). The system automatically detects column headers and data types.

### Step 2: Preview Your Data
Review your data in the preview table to understand the structure and content before cutting.

### Step 3: Select Columns
Choose which columns to include in your output. You can:
- Check/uncheck columns
- Reorder by dragging
- Rename during selection

### Step 4: Apply Filters
Add filters to include only the rows you need:
- Use the visual query builder
- Combine multiple conditions
- Preview filter results

### Step 5: Export Your Cut
Download your customized dataset as a new CSV file with only your selected data.

## Cutting Strategies

### Performance Cutting
For large files, consider:
- Selecting fewer columns first
- Applying broad filters early
- Using indexed columns for filtering
- Working with samples during development

### Quality Cutting
Ensure data integrity by:
- Previewing results before export
- Validating filter logic
- Checking column selections
- Testing with small samples first

### Security Cutting
Protect sensitive information:
- Remove PII columns
- Filter out confidential rows
- Mask sensitive data
- Create sanitized datasets

## Common Use Cases

### Data Analysis Preparation
- Extract specific time periods for trend analysis
- Remove unnecessary columns for cleaner analysis
- Filter to specific categories or segments
- Create training datasets for machine learning

### Reporting and Dashboards
- Generate focused reports for stakeholders
- Create department-specific views
- Extract KPI-relevant data
- Prepare data for visualization tools

### Data Migration
- Extract specific data for system migrations
- Create import-ready datasets
- Remove deprecated fields
- Format data for target systems

### Testing and Development
- Create test datasets from production data
- Generate sample data for development
- Remove sensitive information for testing
- Create focused datasets for debugging

## Cutting Limitations

### File Size Limits
- Maximum input file: 50MB
- Recommended size: Under 5MB for best performance
- Large files may require splitting before cutting

### Data Type Support
- Text and numeric data fully supported
- Binary data (images, files) not supported
- Complex nested structures need flattening
- Special characters may need encoding consideration

### Performance Considerations
- Complex filters on large files may be slow
- Multiple simultaneous operations may queue
- Very wide tables (500+ columns) may have reduced performance
- Memory limitations for extremely large datasets

## Best Practices

### Planning Your Cut
1. **Understand Your Data**: Review the full dataset before cutting
2. **Define Requirements**: Know exactly what data you need
3. **Start Small**: Test with samples before processing large files
4. **Document Process**: Keep notes on your cutting decisions

### Efficient Cutting
1. **Column First**: Select columns before applying row filters
2. **Broad to Specific**: Apply general filters before specific ones
3. **Index Friendly**: Use indexed columns for faster filtering
4. **Batch Operations**: Process multiple cuts together when possible

### Quality Assurance
1. **Preview Results**: Always preview before final export
2. **Validate Counts**: Check row and column counts make sense
3. **Test Logic**: Verify filter conditions work as expected
4. **Sample Verification**: Manually check a few records

## Getting Started

Ready to start cutting your CSV files? Here's your next steps:

1. **Upload a File**: Start with a small test file
2. **Try Column Selection**: Practice selecting and reordering columns
3. **Experiment with Filters**: Apply simple filters to understand the process
4. **Export and Verify**: Download your cut file and verify the results

## Related Features

CSV cutting works seamlessly with other Cutty features:
- **Query Builder**: Create complex filters visually
- **SQL Preview**: See the queries behind your cuts
- **File Management**: Organize and track your cut files
- **Lineage Tracking**: Understand how files were created

## Need Help?

- Check the [Column Selection Guide](column-selection.md) for detailed column operations
- Read the [Row Filtering Guide](row-filtering.md) for advanced filtering techniques
- Review [Export Options](export-options.md) for output customization
- Use the help chat for specific questions about your data
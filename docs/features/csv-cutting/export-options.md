---
title: Export Options Guide
category: Features
subcategory: CSV Cutting
keywords: export options, csv export, file download, output format, export settings
difficulty: beginner
---

# Export Options Guide

## Complete Guide to Export Configurations

Once you've selected your columns and applied filters, exporting your data is the final step in the CSV cutting process. This guide covers all available export options and configurations to ensure you get exactly the output format you need.

## Understanding Export Options

### What are Export Options?
Export options control how your selected and filtered data is formatted and delivered. You can customize:
- File format and structure
- Column headers and naming
- Data formatting and encoding
- File delivery method
- Metadata inclusion

### Why Customize Exports?
- **Format Compatibility**: Match requirements of target systems
- **Data Integrity**: Ensure proper encoding and formatting
- **File Organization**: Create consistent naming and structure
- **System Integration**: Prepare files for automated processing
- **Quality Control**: Include metadata and validation information

## Basic Export Settings

### File Format Options

#### CSV (Comma-Separated Values)
The standard output format:
- **Delimiter**: Comma (,) by default
- **Encoding**: UTF-8 (recommended)
- **Line Endings**: Cross-platform compatible
- **Quote Character**: Double quotes (") for text containing commas

#### Custom Delimited
Alternative delimiter options:
- **Tab-Separated (TSV)**: Tab character delimiter
- **Pipe-Separated**: Pipe (|) character delimiter
- **Semicolon-Separated**: Semicolon (;) delimiter
- **Custom Character**: Specify any single character

#### Excel-Compatible CSV
Optimized for Microsoft Excel:
- **Encoding**: UTF-8 with BOM
- **Delimiter**: Comma or semicolon (based on locale)
- **Date Format**: Excel-friendly date formatting
- **Number Format**: Decimal notation compatible with Excel

### Basic Configuration

#### Include Headers
Control column header inclusion:
- **Include Headers**: First row contains column names (default)
- **No Headers**: Data only, no header row
- **Custom Headers**: Use renamed column headers

#### Quote Settings
Control when text is quoted:
- **Quote All**: Every field wrapped in quotes
- **Quote Text Only**: Only text fields quoted
- **Quote When Needed**: Quote only fields containing delimiters
- **No Quotes**: Never use quotes (may cause parsing issues)

#### Line Endings
Choose appropriate line ending style:
- **Auto-Detect**: Best option for cross-platform compatibility
- **Windows (CRLF)**: Windows systems
- **Unix/Linux (LF)**: Unix, Linux, and modern systems
- **Mac Classic (CR)**: Legacy Mac systems (rarely needed)

## Advanced Export Configuration

### Data Formatting Options

#### Number Formatting
Control how numbers appear:
- **Decimal Places**: Fixed number of decimal places
- **Thousands Separator**: Include commas in large numbers
- **Negative Numbers**: How to display negative values
- **Scientific Notation**: For very large or small numbers

Examples:
```
Original: 1234.567
Fixed 2 decimals: 1234.57
With thousands: 1,234.57
Scientific: 1.23E+3
```

#### Date Formatting
Standardize date output:
- **ISO 8601**: 2024-12-31 (recommended for systems)
- **US Format**: 12/31/2024
- **European Format**: 31/12/2024
- **Long Format**: December 31, 2024
- **Custom Format**: Specify your own pattern

#### Text Formatting
Control text output:
- **Case Conversion**: Upper, lower, or title case
- **Trim Whitespace**: Remove leading/trailing spaces
- **Replace Characters**: Substitute problematic characters
- **Encoding Options**: Handle special characters properly

### Column Customization

#### Column Ordering
Final column arrangement:
- **Selection Order**: Columns in the order they were selected
- **Original Order**: Maintain original CSV column order
- **Alphabetical**: Sort columns alphabetically
- **Custom Order**: Drag and drop to arrange

#### Column Renaming
Customize output column names:
- **Original Names**: Keep original column headers
- **Renamed Headers**: Use custom names from selection
- **System Names**: Use system-friendly names (no spaces/special chars)
- **Uppercase/Lowercase**: Force specific case

#### Column Metadata
Include additional column information:
- **Data Types**: Add type information to headers
- **Source Columns**: Reference original column names
- **Statistics**: Include basic stats (count, nulls, etc.)

### File Naming and Organization

#### Automatic Naming
Cutty can generate filenames automatically:
- **Source Name**: Based on original filename
- **Timestamp**: Include current date/time
- **Filter Description**: Summarize applied filters
- **Column Count**: Include number of columns

Examples:
```
Original file: customers.csv
Auto-generated: customers_filtered_2024-03-15_10cols.csv
With timestamp: customers_2024-03-15_143052.csv
With filters: customers_active_highvalue_2024-03-15.csv
```

#### Custom Naming
Specify your own filename:
- **Custom Name**: Enter desired filename
- **Template Variables**: Use placeholders for dynamic naming
- **Naming Convention**: Follow organizational standards
- **File Extension**: Automatically added based on format

#### Template Variables
Use dynamic placeholders in filenames:
- **{source}**: Original filename (without extension)
- **{date}**: Current date (YYYY-MM-DD)
- **{time}**: Current time (HHMMSS)
- **{rows}**: Number of rows in output
- **{cols}**: Number of columns in output
- **{user}**: Current username

Example template:
```
Template: {source}_export_{date}_{rows}rows
Result: sales_data_export_2024-03-15_1247rows.csv
```

## Quality and Validation Options

### Data Validation
Ensure export quality:
- **Check Empty Rows**: Warn about completely empty rows
- **Validate Data Types**: Verify data matches expected types
- **Missing Data Report**: Count and report null values
- **Duplicate Detection**: Identify potential duplicate rows

### Export Summary
Include processing summary:
- **Row Count**: Total rows exported
- **Column Count**: Total columns included
- **Filter Summary**: Applied filters description
- **Processing Time**: Export duration
- **File Size**: Final file size

### Metadata Inclusion
Add processing information:
- **Header Comments**: Include export details in file
- **Separate Metadata File**: Create companion .meta file
- **Export Log**: Detailed processing log
- **Source Information**: Original file details

## Performance and Size Management

### Large File Handling

#### Streaming Export
For large datasets:
- **Stream Processing**: Process data in chunks
- **Memory Efficient**: Handle files larger than available RAM
- **Progress Tracking**: Show export progress
- **Cancelable**: Ability to stop long-running exports

#### Compression Options
Reduce file size:
- **ZIP Compression**: Compress exported file
- **GZIP**: Unix-standard compression
- **No Compression**: Faster export, larger file
- **Compression Level**: Balance between size and speed

#### Chunked Export
Split large exports:
- **Maximum Rows**: Split files at row threshold
- **Maximum Size**: Split files at size threshold
- **Sequential Naming**: Automatic part numbering
- **Index File**: Summary of all parts

### Performance Optimization

#### Export Strategies
Choose based on file size:
- **Small Files (<1MB)**: Standard export
- **Medium Files (1-50MB)**: Use compression
- **Large Files (>50MB)**: Consider chunking or streaming

#### Background Processing
For time-consuming exports:
- **Queue Export**: Add to processing queue
- **Email Notification**: Notify when complete
- **Download Link**: Secure link to completed file
- **Expiration**: Automatic cleanup of old exports

## Delivery Methods

### Direct Download
Immediate file download:
- **Browser Download**: Standard file download
- **Secure Link**: Temporary download URL
- **Multiple Formats**: Download same data in different formats
- **Download History**: Track recent downloads

### Cloud Storage
Export to cloud platforms:
- **Google Drive**: Direct export to Drive folder
- **Dropbox**: Save to Dropbox account
- **OneDrive**: Microsoft OneDrive integration
- **S3 Bucket**: Export to Amazon S3

### API Integration
Programmatic export access:
- **API Endpoint**: Direct export via API
- **Webhook Notification**: Notify external systems
- **Custom Headers**: Include authentication tokens
- **Batch Processing**: Process multiple exports

## Export Templates and Presets

### Template Creation
Save export configurations:
1. Configure all export settings
2. Click **Save as Template**
3. Name your template
4. Add description and tags
5. Set access permissions

### Preset Templates
Common configuration presets:

#### Excel Import Ready
Optimized for Excel import:
```
Format: CSV
Encoding: UTF-8 with BOM
Delimiter: Comma
Headers: Included
Date Format: MM/DD/YYYY
Numbers: With thousands separators
```

#### Database Import
Prepared for database loading:
```
Format: CSV
Encoding: UTF-8
Delimiter: Pipe (|)
Headers: System-friendly names
Date Format: ISO 8601
Numbers: No formatting
Quotes: When needed only
```

#### Analytics Ready
Configured for analysis tools:
```
Format: CSV
Encoding: UTF-8
Delimiter: Comma
Headers: Descriptive names
Date Format: ISO 8601
Numbers: Decimal notation
Missing Values: Empty strings
```

#### Compliance Export
For regulatory requirements:
```
Format: CSV
Encoding: UTF-8
Headers: Original names
Metadata: Full export log
Validation: Complete data checks
Compression: None (for audit trail)
```

## Troubleshooting Export Issues

### Common Export Problems

#### File Doesn't Open Correctly
**Causes**: Encoding or delimiter mismatch
**Solutions**:
1. Try UTF-8 with BOM encoding
2. Use Excel-compatible settings
3. Check delimiter choice
4. Verify quote settings

#### Missing Characters
**Causes**: Encoding issues with special characters
**Solutions**:
1. Use UTF-8 encoding
2. Include BOM for Excel compatibility
3. Check source data encoding
4. Use Unicode-safe characters only

#### Numbers Display Wrong
**Causes**: Locale or formatting issues
**Solutions**:
1. Use system locale settings
2. Choose appropriate number format
3. Avoid scientific notation for IDs
4. Check decimal separator

#### File Too Large
**Causes**: Export exceeds size limits
**Solutions**:
1. Apply more restrictive filters
2. Select fewer columns
3. Use compression
4. Split into multiple files

### Export Validation

#### Pre-Export Checks
Before exporting, verify:
- Column selection is correct
- Filters produce expected results
- Row count seems reasonable
- No unexpected empty columns

#### Post-Export Verification
After export, confirm:
- File opens in target application
- Data appears correctly formatted
- Row/column counts match expectations
- No data corruption occurred

## API Export Examples

### Basic Export API Call
```javascript
const exportConfig = {
  fileId: 'your-file-id',
  columns: ['name', 'email', 'created_date'],
  filters: [
    {
      column: 'status',
      operator: 'equals',
      value: 'active'
    }
  ],
  format: {
    delimiter: ',',
    encoding: 'utf-8',
    headers: true,
    dateFormat: 'iso'
  }
};

const response = await fetch('/api/v1/export/csv', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(exportConfig)
});
```

### Advanced Export Configuration
```javascript
const advancedConfig = {
  fileId: 'your-file-id',
  format: {
    type: 'csv',
    delimiter: ',',
    encoding: 'utf-8-bom',
    lineEndings: 'crlf',
    quoteStyle: 'minimal'
  },
  naming: {
    template: '{source}_filtered_{date}',
    includeMetadata: true
  },
  delivery: {
    method: 'download',
    compression: 'zip',
    notification: true
  },
  validation: {
    checkEmpty: true,
    validateTypes: true,
    includeSummary: true
  }
};
```

## Best Practices

### Export Planning
1. **Test with Samples**: Verify settings with small exports first
2. **Document Configurations**: Save successful export templates
3. **Validate Results**: Always check exported files
4. **Consider Target System**: Match requirements of destination

### File Management
1. **Consistent Naming**: Use clear, descriptive filenames
2. **Version Control**: Include dates or version numbers
3. **Organization**: Group related exports together
4. **Cleanup**: Remove old exports regularly

### Performance Optimization
1. **Right-Size Exports**: Export only needed data
2. **Use Compression**: For large files or slow connections
3. **Batch Processing**: Group related exports
4. **Off-Peak Timing**: Export during low-usage periods

## Related Features

Export options work with:
- **Column Selection**: Export only selected columns
- **Row Filtering**: Export only filtered rows
- **File Management**: Organize exported files
- **Lineage Tracking**: Track export history

## Next Steps

- Learn about the [Query Builder](../query-builder/overview.md) for visual export configuration
- Explore [File Management](../file-management/overview.md) for organizing exports
- Check [Lineage Tracking](../file-management/lineage-tracking.md) to understand export history
- Review the [API Documentation](/api-reference/endpoints/export.md) for programmatic exports
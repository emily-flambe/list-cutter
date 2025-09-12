---
title: CSV Parsing Configuration Options
category: Features
subcategory: CSV Processing
keywords: CSV parsing, delimiters, quote characters, escape characters, configuration
difficulty: intermediate
---

# CSV Parsing Configuration Options

## Complete Guide to CSV Parser Settings

Understanding CSV parsing options helps you handle complex data formats and ensure accurate data import in Cutty.

## Automatic Detection

### Smart Parsing
Cutty automatically detects most CSV characteristics:
- **Delimiter type**: Comma, tab, semicolon, pipe, or custom
- **Quote character**: Single or double quotes
- **Header presence**: First row analysis
- **Character encoding**: UTF-8, UTF-16, ISO-8859-1, Windows-1252

### Detection Algorithm
The parser analyzes your file using:
1. **Statistical analysis**: Character frequency analysis
2. **Pattern recognition**: Common CSV patterns
3. **Structural consistency**: Validates across multiple rows
4. **Encoding signatures**: Byte order marks and character patterns

## Core Parsing Options

### Delimiter Configuration

#### Standard Delimiters
**Comma (,)** - Default
```csv
Name,Age,City
John,25,New York
```

**Tab (\t)** - Tab-separated
```tsv
Name	Age	City
John	25	New York
```

**Semicolon (;)** - European standard
```csv
Name;Age;City
John;25;New York
```

**Pipe (|)** - Database exports
```csv
Name|Age|City
John|25|New York
```

#### Custom Delimiters
You can specify any single character:
- **Colon (:)**: `Name:Age:City`
- **Tilde (~)**: `Name~Age~City`
- **Caret (^)**: `Name^Age^City`
- **Space ( )**: Use with caution - may conflict with data

### Quote Character Options

#### Double Quotes (Default)
```csv
Name,Age,"City, State"
John,25,"New York, NY"
Jane,30,"Los Angeles, CA"
```

#### Single Quotes
```csv
Name,Age,'City, State'
John,25,'New York, NY'
Jane,30,'Los Angeles, CA'
```

#### No Quotes
```csv
Name,Age,City
John,25,New York
Jane,30,Los Angeles
```

### Quote Behavior

#### Fields Requiring Quotes
- **Contains delimiter**: "Smith, John" when using comma delimiter
- **Contains newlines**: Multi-line text fields
- **Contains quote characters**: Escaped with double quotes
- **Leading/trailing spaces**: Preserves exact spacing

#### Quote Escaping Rules
**Double quote escaping** (RFC 4180 standard):
```csv
Name,Quote
John,"He said ""Hello"" to me"
```

**Backslash escaping** (Alternative):
```csv
Name,Quote
John,"He said \"Hello\" to me"
```

## Advanced Parsing Options

### Header Configuration

#### Has Headers (Default: Yes)
**Enabled**: First row contains column names
```csv
Product,Price,Category  ← Headers
Widget A,19.99,Electronics
Widget B,29.99,Electronics
```

**Disabled**: All rows are data, generic column names assigned
```csv
Widget A,19.99,Electronics  ← Data row 1
Widget B,29.99,Electronics  ← Data row 2
```
Results in columns: Column1, Column2, Column3

#### Custom Header Row
**Skip Rows**: Ignore first N rows before headers
```csv
Company Export Report     ← Skip row 1
Generated: 2024-01-15     ← Skip row 2
Product,Price,Category    ← Header row (row 3)
Widget A,19.99,Electronics ← Data starts here
```

### Character Encoding Options

#### Automatic Detection (Recommended)
- Analyzes file byte patterns
- Detects BOM (Byte Order Mark)
- Fallback to UTF-8 if uncertain

#### Manual Override
**When to use**: Automatic detection fails
**Common issues**: 
- Mixed encoding files
- Legacy systems
- Regional character sets

**Encoding Options**:
- UTF-8 (Universal)
- UTF-16 (Microsoft Office)
- ISO-8859-1 (Latin-1)
- Windows-1252 (Windows default)
- ASCII (English only)

### Escape Character Configuration

#### Backslash Escaping
```csv
Name,Description
Product1,"Size: 5\" x 3\""
Product2,"Path: C:\\Program Files\\"
```

#### Double Quote Escaping (RFC 4180)
```csv
Name,Description
Product1,"Size: 5"" x 3"""
Product2,"Quote: ""Hello World"""
```

#### No Escaping
```csv
Name,Description
Product1,Size: 5 x 3
Product2,Simple description
```

## Error Handling Options

### Malformed Row Handling

#### Skip Malformed Rows (Default)
- **Behavior**: Continues processing, logs warnings
- **Best for**: Large files with occasional errors
- **Result**: Clean data with potential row loss

#### Strict Mode
- **Behavior**: Stops processing on first error
- **Best for**: Critical data accuracy requirements
- **Result**: Either all data or clear error message

#### Fix Attempts
- **Behavior**: Attempts to repair common issues
- **Repairs**: Missing quotes, extra delimiters, encoding issues
- **Best for**: Files from legacy systems

### Column Count Variations

#### Flexible Column Count
- **Behavior**: Handles rows with different column counts
- **Missing values**: Filled with empty strings
- **Extra values**: Additional columns created dynamically

#### Fixed Column Count
- **Behavior**: Requires consistent column count
- **Validation**: Rejects files with inconsistent rows
- **Best for**: Strict data format requirements

## Configuration Examples

### Example 1: European CSV Format
```yaml
Configuration:
  delimiter: ";"
  quote_character: "\""
  decimal_separator: ","
  has_headers: true
  encoding: "UTF-8"
```

Sample data:
```csv
Name;Price;Date
Product A;19,99;15/01/2024
Product B;29,99;16/01/2024
```

### Example 2: Database Export
```yaml
Configuration:
  delimiter: "|"
  quote_character: none
  escape_character: "\\"
  has_headers: true
  encoding: "UTF-8"
```

Sample data:
```csv
ID|Name|Description
1|Product A|Standard widget
2|Product B|Premium widget with "quotes"
```

### Example 3: Legacy System Export
```yaml
Configuration:
  delimiter: ","
  quote_character: "'"
  encoding: "Windows-1252"
  skip_rows: 2
  has_headers: true
```

Sample data:
```csv
Legacy System Export
Generated: 01/15/2024
'Product Name','Price','Notes'
'Widget A','$19.99','Standard item'
'Widget B','$29.99','Premium item'
```

## Parser Performance Settings

### Processing Limits
- **Maximum file size**: 50MB
- **Maximum rows**: 100,000 rows
- **Maximum columns**: 500 columns
- **Processing timeout**: 30 seconds

### Performance Optimization
**Batch Processing**: Large files processed in chunks
**Memory Management**: Streaming parser for large files
**Unicode Normalization**: Automatic character standardization
**Error Recovery**: Continues processing despite individual row errors

### Performance Monitoring
```json
{
  "processingTime": "2.5s",
  "rowsProcessed": 15750,
  "errorsSkipped": 3,
  "throughput": "6300 rows/second",
  "memoryUsage": "45MB"
}
```

## Common Parsing Scenarios

### Scenario 1: Excel Export with Quoted Numbers
**Problem**: Numbers exported as text with quotes
```csv
Name,Price,Quantity
"Product A","19.99","5"
```

**Solution**: Enable quote removal for numeric fields
```yaml
Configuration:
  remove_quotes_from_numbers: true
  data_type_detection: true
```

### Scenario 2: Mixed Delimiters in Data
**Problem**: Data contains multiple delimiter types
```csv
Name,Description
"Product A","Size: 5x3, Weight: 2lbs"
"Product B","Dimensions: 10|5|3"
```

**Solution**: Use quote characters to protect delimiters
```yaml
Configuration:
  delimiter: ","
  quote_character: "\""
  respect_quotes: true
```

### Scenario 3: Multi-line Fields
**Problem**: Cell data spans multiple lines
```csv
Name,Description
"Product A","Line 1
Line 2
Line 3"
```

**Solution**: Enable multi-line parsing
```yaml
Configuration:
  allow_multiline: true
  quote_character: "\""
```

### Scenario 4: European Number Format
**Problem**: European decimal notation (comma as decimal)
```csv
Product,Price
Widget A,"19,99"
Widget B,"29,50"
```

**Solution**: Configure locale-aware parsing
```yaml
Configuration:
  locale: "eu"
  decimal_separator: ","
  thousands_separator: "."
```

## Validation and Debugging

### Parse Preview
Before processing your entire file:
1. **Sample rows**: Preview first 10 rows with current settings
2. **Column detection**: Verify header recognition
3. **Data type inference**: Check automatic type detection
4. **Error preview**: See potential parsing issues

### Common Validation Checks
- **Column count consistency**: All rows have same number of fields
- **Quote balance**: Opening and closing quotes match
- **Encoding validation**: All characters display correctly
- **Data type consistency**: Values match expected types

### Debug Mode
Enable detailed logging to troubleshoot parsing issues:
```json
{
  "debug_mode": true,
  "log_level": "verbose",
  "output_sample_errors": 10,
  "validate_each_row": true
}
```

## Best Practices

### File Preparation
1. **Consistent formatting**: Use same delimiter throughout
2. **Proper quoting**: Quote fields containing delimiters
3. **Clean headers**: Use descriptive, unique column names
4. **Test with sample**: Validate settings with subset first

### Configuration Strategy
1. **Start with auto-detection**: Let Cutty detect settings first
2. **Verify preview**: Check sample output before full processing
3. **Document settings**: Save configurations for repeated use
4. **Test edge cases**: Verify handling of special characters

### Error Prevention
1. **Validate source data**: Check for consistency before export
2. **Use standard formats**: Stick to RFC 4180 when possible
3. **Handle special characters**: Properly escape or quote
4. **Monitor processing**: Check results for data quality

## API Configuration

### Programmatic Settings
For API uploads, specify parsing options:

```javascript
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('delimiter', ',');
formData.append('quote_char', '"');
formData.append('has_headers', 'true');
formData.append('encoding', 'UTF-8');

const response = await fetch('/api/v1/files/upload', {
  method: 'POST',
  body: formData
});
```

### Batch Configuration
For multiple files with same format:
```javascript
const config = {
  delimiter: ';',
  quote_char: '"',
  encoding: 'UTF-8',
  has_headers: true,
  skip_rows: 0
};

// Apply to multiple uploads
files.forEach(file => uploadWithConfig(file, config));
```

## Related Topics

- [Supported File Formats](file-formats.md)
- [Uploading CSV Files](uploading-files.md)
- [Troubleshooting Upload Issues](troubleshooting.md)
- [Data Type Detection](/docs/features/data-analysis/type-detection.md)

## Need More Help?

If you're having parsing issues:
1. Check our [troubleshooting guide](troubleshooting.md)
2. Use the parse preview feature to test settings
3. Contact support with sample data for custom configuration
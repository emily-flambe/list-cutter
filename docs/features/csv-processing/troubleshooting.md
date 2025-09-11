---
title: Troubleshooting CSV Upload Issues
category: Features
subcategory: CSV Processing
keywords: troubleshooting, upload issues, CSV problems, error messages, solutions
difficulty: intermediate
---

# Troubleshooting CSV Upload Issues

## Complete Problem-Solving Guide

This guide helps you diagnose and fix common CSV upload and processing issues in Cutty.

## Quick Diagnostic Checklist

Before diving into specific problems, check these common issues:

- [ ] File size under 50MB
- [ ] File has .csv, .tsv, or .txt extension
- [ ] File contains valid CSV data
- [ ] Internet connection is stable
- [ ] Browser supports file uploads

## Upload Failures

### Issue: "File Too Large" Error

**Error Message**: `File size exceeds maximum allowed size (50MB)`

**Cause**: File exceeds the 50MB upload limit

**Solutions**:
1. **Split the file**:
   - Use Excel: Data → Text to Columns → Save as separate files
   - Use text editor: Cut file into smaller sections
   - Use command line: `split -l 10000 largefile.csv smallfile_`

2. **Compress data**:
   - Remove unnecessary columns
   - Reduce decimal precision
   - Remove empty rows and columns
   - Shorten text fields where possible

3. **Optimize format**:
   - Use shorter column headers
   - Remove formatting and special characters
   - Convert to tab-delimited (often smaller)

**Prevention**: Regularly export data in smaller chunks

### Issue: "File Validation Failed" Error

**Error Message**: `File validation failed - File type 'application/octet-stream' is not allowed`

**Cause**: File type not recognized as CSV

**Solutions**:
1. **Check file extension**:
   - Ensure file ends with .csv, .tsv, or .txt
   - Rename file if necessary: `data.xlsx` → `data.csv`

2. **Re-export from source**:
   - Excel: File → Save As → CSV (Comma delimited)
   - Google Sheets: File → Download → CSV
   - Database: Use CSV export option

3. **Verify file content**:
   - Open in text editor to confirm CSV format
   - Check for binary data or corrupted content

**Prevention**: Always use proper CSV export options

### Issue: Upload Hangs or Times Out

**Symptoms**: Upload progress bar stops, browser shows "waiting for response"

**Causes**:
- Network connectivity issues
- Server overload
- Large file processing timeout
- Browser limitations

**Solutions**:
1. **Check network**:
   - Test internet speed
   - Try different network connection
   - Disable VPN if active

2. **Retry with smaller file**:
   - Split large files into chunks
   - Upload during off-peak hours
   - Use wired connection instead of WiFi

3. **Browser troubleshooting**:
   - Clear browser cache and cookies
   - Disable browser extensions
   - Try different browser (Chrome, Firefox, Safari)
   - Update browser to latest version

**Prevention**: Upload files under 5MB for best reliability

## Parsing and Processing Issues

### Issue: Data Appears in Wrong Columns

**Symptoms**: All data shows in first column, or columns are misaligned

**Cause**: Incorrect delimiter detection

**Solutions**:
1. **Manual delimiter selection**:
   - Use upload preview to specify delimiter
   - Try comma, tab, semicolon, or pipe
   - Check file in text editor to identify delimiter

2. **Fix source data**:
   - Ensure consistent delimiter throughout file
   - Quote fields containing delimiters
   - Remove extra delimiters in data

3. **Check for hidden characters**:
   - Copy-paste data to clean text editor
   - Save with UTF-8 encoding
   - Remove non-printable characters

**Example Fix**:
```csv
# Wrong - inconsistent delimiters
Name,Age;City
John,25,New York

# Right - consistent delimiters  
Name,Age,City
John,25,"New York"
```

### Issue: Special Characters Display as ���

**Symptoms**: Accented letters, symbols, or foreign characters show as question marks or boxes

**Cause**: Character encoding mismatch

**Solutions**:
1. **Re-save with UTF-8 encoding**:
   - Open file in text editor
   - Save As → Select UTF-8 encoding
   - Re-upload to Cutty

2. **Check original source**:
   - Export from source system with UTF-8
   - Avoid copy-pasting from web browsers
   - Use database export with UTF-8 option

3. **Manual encoding selection**:
   - Try different encoding options during upload
   - Common alternatives: Windows-1252, ISO-8859-1
   - Test with small sample first

**Example Encodings**:
- **UTF-8**: café, naïve, résumé ✓
- **ASCII**: caf?, na?ve, r?sum? ✗
- **Windows-1252**: café, naïve, résumé ✓

### Issue: Numbers Treated as Text

**Symptoms**: Numeric columns show as text type, math operations don't work

**Cause**: Numbers formatted as text or contain non-numeric characters

**Solutions**:
1. **Clean numeric data**:
   - Remove currency symbols: $100 → 100
   - Remove commas: 1,000 → 1000
   - Fix decimal separators: 19,99 → 19.99

2. **Check for hidden characters**:
   - Leading/trailing spaces
   - Non-breaking spaces (Alt+160)
   - Unicode characters that look like numbers

3. **Source system fixes**:
   - Export numbers without formatting
   - Use number format instead of text format
   - Avoid formulas in export cells

**Example Cleaning**:
```csv
# Before - text format
Price,Quantity
"$19.99","5 units"
"$29.99","10 units"

# After - numeric format
Price,Quantity
19.99,5
29.99,10
```

### Issue: Date Columns Not Recognized

**Symptoms**: Dates show as text, can't use date operations

**Cause**: Non-standard date formats or locale differences

**Solutions**:
1. **Standardize date format**:
   - Use ISO format: YYYY-MM-DD
   - Or US format: MM/DD/YYYY
   - Avoid text months: "Jan 15, 2024"

2. **Check locale settings**:
   - US: MM/DD/YYYY
   - Europe: DD/MM/YYYY
   - ISO: YYYY-MM-DD

3. **Source data fixes**:
   - Export dates in consistent format
   - Use date data type in source system
   - Avoid time zones if not needed

**Example Formats**:
```csv
# Good - consistent ISO format
Date,Event
2024-01-15,Launch
2024-01-16,Meeting

# Problematic - mixed formats
Date,Event
Jan 15 2024,Launch
1/16/24,Meeting
```

## Data Quality Issues

### Issue: Missing or Empty Rows

**Symptoms**: Some rows appear completely empty or have missing values

**Cause**: Source data inconsistencies or export issues

**Solutions**:
1. **Check source data**:
   - Verify data exists in original system
   - Check for filters hiding data
   - Ensure complete export range selected

2. **Handle empty cells**:
   - Use quotes for intentionally empty fields: `Name,,City`
   - Replace nulls with placeholder text
   - Document expected empty values

3. **File format issues**:
   - Check for extra commas creating empty columns
   - Verify line endings are consistent
   - Remove completely empty rows from file

### Issue: Duplicate Headers or Rows

**Symptoms**: Column names repeated, or data rows appear multiple times

**Cause**: Multiple files concatenated or export errors

**Solutions**:
1. **Clean headers**:
   - Remove duplicate header rows
   - Ensure only first row contains headers
   - Check for header rows in middle of data

2. **Remove duplicates**:
   - Use Excel Remove Duplicates feature
   - Sort data to identify duplicates visually
   - Use database DISTINCT if exporting from DB

3. **Source export fixes**:
   - Export single dataset without headers
   - Avoid appending multiple files
   - Check export query for duplicates

### Issue: Inconsistent Data Types in Columns

**Symptoms**: Mixed text and numbers in same column, type detection fails

**Cause**: Inconsistent data entry or export formatting

**Solutions**:
1. **Standardize data types**:
   - Convert all numbers to numeric format
   - Use consistent date formats
   - Remove formatting from exported data

2. **Clean mixed content**:
   - Separate text and numeric data into different columns
   - Use consistent units (all dollars, all percentages)
   - Handle null values consistently

3. **Source data quality**:
   - Implement data validation rules
   - Use proper data types in source system
   - Clean data before export

## Performance Issues

### Issue: Slow Upload or Processing

**Symptoms**: Upload takes very long time, processing times out

**Causes**:
- Large file size
- Complex data structure
- Network issues
- Server load

**Solutions**:
1. **Optimize file size**:
   - Remove unnecessary columns
   - Split into smaller files
   - Compress repetitive data

2. **Simplify structure**:
   - Use simpler delimiters (comma instead of complex)
   - Remove special formatting
   - Flatten nested data structures

3. **Upload optimization**:
   - Use faster internet connection
   - Upload during off-peak hours
   - Try different geographic location if using VPN

**Performance Targets**:
- < 1MB: Instant processing
- 1-5MB: Under 10 seconds
- 5-50MB: Under 60 seconds

### Issue: Memory or Browser Crashes

**Symptoms**: Browser becomes unresponsive, crash errors, out of memory warnings

**Cause**: File too large for browser processing

**Solutions**:
1. **Reduce file size**:
   - Split file into smaller chunks
   - Remove unnecessary data
   - Use server-side processing instead

2. **Browser optimization**:
   - Close other browser tabs
   - Restart browser before upload
   - Try different browser with better memory handling

3. **Alternative approaches**:
   - Use API upload instead of web interface
   - Upload multiple smaller files
   - Consider desktop tools for large files

## API Upload Issues

### Issue: Authentication Errors

**Error Message**: `401 Unauthorized` or `Invalid token`

**Solutions**:
1. **Check API key**:
   - Verify key is correct and active
   - Check for extra spaces or characters
   - Regenerate key if necessary

2. **Header format**:
   ```javascript
   headers: {
     'Authorization': 'Bearer YOUR_API_KEY'
   }
   ```

3. **Permission verification**:
   - Ensure key has upload permissions
   - Check account status
   - Verify endpoint URL is correct

### Issue: Malformed Request Errors

**Error Message**: `400 Bad Request` or `Malformed request`

**Solutions**:
1. **Check request format**:
   ```javascript
   const formData = new FormData();
   formData.append('file', fileBlob, 'filename.csv');
   ```

2. **Verify content type**:
   - Don't set Content-Type header manually
   - Let browser set multipart/form-data automatically

3. **File validation**:
   - Ensure file is valid CSV
   - Check file is not corrupted
   - Verify file size under limits

## Browser-Specific Issues

### Chrome Issues
- **Large file uploads**: Enable "Parallel downloading" in chrome://flags
- **Memory issues**: Increase memory limit with --max-old-space-size flag
- **CORS errors**: Check security settings, disable extensions

### Firefox Issues
- **Upload timeouts**: Increase network.http.response.timeout in about:config
- **Memory crashes**: Restart browser, disable hardware acceleration
- **File type detection**: Ensure proper MIME type settings

### Safari Issues
- **Upload failures**: Enable developer tools, check console errors
- **File size limits**: Safari may have stricter limits than other browsers
- **Cache issues**: Clear Safari cache and try again

## Prevention Strategies

### Data Source Preparation
1. **Standardize exports**:
   - Use consistent export templates
   - Document export procedures
   - Train users on proper CSV creation

2. **Quality checks**:
   - Implement data validation at source
   - Regular data cleaning procedures
   - Monitor data quality metrics

### File Management
1. **Naming conventions**:
   - Use descriptive filenames
   - Include dates: `sales_2024-01-15.csv`
   - Avoid special characters in names

2. **Version control**:
   - Keep original files as backup
   - Document any data transformations
   - Track file processing history

### Upload Workflows
1. **Test procedures**:
   - Always test with small sample first
   - Validate data after upload
   - Document successful configuration

2. **Monitoring**:
   - Check upload success notifications
   - Verify row/column counts match expectations
   - Review data types and formats

## Getting Additional Help

### Self-Service Resources
1. **Check existing documentation**:
   - [File Formats Guide](file-formats.md)
   - [Parsing Options](parsing-options.md)
   - [Upload Instructions](uploading-files.md)

2. **Use built-in tools**:
   - Upload preview feature
   - Parse configuration options
   - Error messages and suggestions

### Contact Support
When contacting support, include:
- **Error message**: Exact text of any error
- **File details**: Size, format, source system
- **Browser information**: Type, version, operating system
- **Sample data**: Small representative sample (remove sensitive data)
- **Steps taken**: What you've already tried

### Community Resources
- User forums for common issues
- Community-contributed solutions
- Best practices documentation

## Related Topics

- [Supported File Formats](file-formats.md)
- [CSV Parsing Options](parsing-options.md)
- [File Upload Guide](uploading-files.md)
- [Data Quality Best Practices](/docs/best-practices/data-quality.md)

Remember: Most CSV issues can be resolved by ensuring proper file format, consistent delimiters, and UTF-8 encoding. When in doubt, try with a small sample file first to test your configuration.
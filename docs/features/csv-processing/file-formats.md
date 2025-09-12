---
title: Supported File Formats and Limits
category: Features
subcategory: CSV Processing
keywords: file formats, size limits, encoding, CSV, TSV, file types
difficulty: beginner
---

# Supported File Formats and Limits

## Complete Guide to File Requirements

Understanding the supported file formats and technical limits helps ensure smooth uploads and optimal performance in Cutty.

## Supported File Formats

### Primary Formats

#### CSV (Comma-Separated Values)
- **File extension**: .csv
- **MIME type**: text/csv, application/vnd.ms-excel
- **Description**: Standard comma-delimited format
- **Best for**: Most common use case, excellent compatibility

Example:
```csv
Name,Age,City
John,25,New York
Jane,30,Los Angeles
```

#### TSV (Tab-Separated Values)
- **File extension**: .tsv
- **MIME type**: text/tab-separated-values, text/plain
- **Description**: Tab-delimited format
- **Best for**: Data containing commas in values

Example:
```tsv
Name	Age	City
John	25	New York
Jane	30	Los Angeles
```

#### TXT (Delimited Text Files)
- **File extension**: .txt
- **MIME type**: text/plain
- **Description**: Custom delimited text files
- **Best for**: Non-standard delimiters (pipe, semicolon)

### Custom Delimiters

Cutty supports files with custom delimiters:

#### Pipe-Delimited
```
Name|Age|City
John|25|New York
Jane|30|Los Angeles
```

#### Semicolon-Delimited
```
Name;Age;City
John;25;New York
Jane;30;Los Angeles
```

#### Custom Characters
- Any single character can serve as a delimiter
- Common alternatives: colon (:), tilde (~), caret (^)
- Avoid using characters that appear in your data

## File Size Limits

### Maximum File Size
- **Upload limit**: 50MB per file
- **Recommended size**: Under 5MB for optimal performance
- **Processing time**: Larger files take proportionally longer

### Performance Guidelines
| File Size | Expected Upload Time | Processing Time |
|-----------|---------------------|-----------------|
| < 100KB   | Instant            | < 1 second      |
| 100KB - 1MB | 1-3 seconds       | 1-2 seconds     |
| 1MB - 5MB | 3-10 seconds        | 3-5 seconds     |
| 5MB - 50MB | 15-60 seconds      | 10-30 seconds    |

### Data Volume Limits

#### Row Limits
- **Maximum rows**: Approximately 100,000 rows
- **Actual limit**: Depends on number of columns
- **Performance impact**: More rows = longer processing time

#### Column Limits
- **Maximum columns**: Up to 500 columns
- **Recommended**: Under 100 columns for best performance
- **Memory consideration**: Wide tables require more processing resources

#### Cell Content Limits
- **Maximum cell size**: 1,000 characters per cell
- **Recommended**: Keep cell content concise
- **Large text**: Consider splitting into multiple columns

## Character Encoding Support

### Recommended Encoding
- **UTF-8**: Best choice for universal compatibility
- **Automatic detection**: Cutty automatically detects UTF-8
- **Special characters**: Full Unicode support

### Supported Encodings

#### UTF Family
- **UTF-8**: Universal standard (recommended)
- **UTF-16**: Microsoft Office compatibility
- **UTF-16 LE/BE**: Little/Big Endian variants

#### Legacy Encodings
- **ISO-8859-1** (Latin-1): Western European characters
- **Windows-1252**: Windows standard encoding
- **ASCII**: Basic English characters only

#### Regional Encodings
- **CP1252**: Windows Western European
- **ISO-8859-15**: Euro symbol support
- **MacRoman**: Classic Mac encoding

### Encoding Detection
Cutty automatically detects encoding using:
1. Byte Order Mark (BOM) detection
2. Character pattern analysis
3. Common encoding signatures
4. Statistical analysis of byte patterns

### Encoding Issues and Solutions

#### Problem: Special Characters Display as ���
**Cause**: Incorrect encoding detection
**Solution**: 
- Re-save file as UTF-8 in your text editor
- Or manually specify encoding during upload

#### Problem: Accented Characters Missing
**Cause**: ASCII encoding used for non-English text
**Solution**: Use UTF-8 encoding

#### Problem: Chinese/Japanese Characters Show as Boxes
**Cause**: Latin encoding applied to Asian text
**Solution**: Ensure UTF-8 or UTF-16 encoding

## File Structure Requirements

### Header Requirements
- **First row**: Must contain column headers
- **Unique names**: Each column needs a unique header
- **Valid characters**: Letters, numbers, spaces, hyphens, underscores
- **Length limit**: Headers under 100 characters

### Data Consistency
- **Delimiter consistency**: Same delimiter throughout file
- **Quote handling**: Consistent quote usage for fields containing delimiters
- **Line endings**: Any format (CRLF, LF, CR) automatically normalized

### Invalid File Characteristics

#### Avoid These Formats
- **Excel files**: .xlsx, .xls (save as CSV instead)
- **PDF files**: Cannot parse tabular data from PDFs
- **Image files**: No OCR capability
- **Compressed files**: .zip, .gz, .rar not supported

#### Problematic Content
- **Merged cells**: Not supported in CSV format
- **Multiple sheets**: Only single sheet files
- **Embedded objects**: Images, charts, formulas not supported
- **Password protection**: Remove before upload

## File Validation Process

### Automatic Validation
When you upload a file, Cutty performs:

1. **File size check**: Ensures under 50MB limit
2. **Format validation**: Confirms supported file type
3. **Character encoding detection**: Identifies encoding automatically
4. **Structure analysis**: Validates CSV structure
5. **Content sampling**: Checks for parsing issues

### Security Validation
- **File signature verification**: Checks magic bytes
- **Content scanning**: Basic malicious content detection
- **Extension validation**: Ensures file extension matches content
- **Size limits**: Prevents resource exhaustion attacks

## Optimization Tips

### Before Upload
1. **Remove unnecessary columns**: Reduces file size and processing time
2. **Clean your data**: Remove empty rows and columns
3. **Consistent formatting**: Ensure uniform data formats
4. **UTF-8 encoding**: Save file with UTF-8 encoding

### File Preparation
1. **Test with subset**: Try with smaller sample first
2. **Check delimiters**: Ensure consistent delimiter usage
3. **Escape special characters**: Quote fields containing delimiters
4. **Remove formatting**: Strip Excel formatting if converting

### Performance Optimization
1. **Split large files**: Break files over 50MB into smaller chunks
2. **Reduce precision**: Round decimal places if appropriate
3. **Compress text**: Remove unnecessary spaces and characters
4. **Sort data**: Sometimes improves processing efficiency

## Common File Format Issues

### Issue: File Appears Corrupted
**Symptoms**: Garbled text, wrong character encoding
**Causes**: 
- Encoding mismatch
- File saved in wrong format
- Binary data in text file

**Solutions**:
- Re-save as UTF-8 CSV
- Check source application export settings
- Verify file contents in text editor

### Issue: Upload Rejected
**Symptoms**: "File validation failed" error
**Causes**:
- File too large (>50MB)
- Unsupported file format
- Corrupted file

**Solutions**:
- Check file size and compress if needed
- Ensure .csv, .tsv, or .txt extension
- Re-export from source application

### Issue: Columns Not Recognized
**Symptoms**: Data appears in single column
**Causes**:
- Wrong delimiter detection
- Unusual delimiter character
- Inconsistent delimiter usage

**Solutions**:
- Manually specify delimiter during upload
- Check file for delimiter consistency
- Use standard delimiters (comma, tab)

## Format Conversion Guidelines

### From Excel to CSV
1. Open Excel file
2. File → Save As
3. Choose "CSV (Comma delimited) (*.csv)"
4. Select UTF-8 encoding if available
5. Save and upload to Cutty

### From Google Sheets to CSV
1. Open Google Sheets
2. File → Download → Comma-separated values (.csv)
3. File automatically downloads as UTF-8
4. Upload to Cutty

### From Database Export
1. Use database export wizard
2. Select CSV format
3. Choose UTF-8 encoding
4. Include column headers
5. Use comma or tab delimiter

## Related Topics

- [Uploading CSV Files](uploading-files.md)
- [CSV Parsing Options](parsing-options.md)
- [Troubleshooting Upload Issues](troubleshooting.md)
- [File Processing Best Practices](/docs/best-practices/file-processing.md)

## Need More Help?

If you're experiencing file format issues:
1. Check our [troubleshooting guide](troubleshooting.md)
2. Use the help chat for specific questions
3. Contact support with sample files for diagnosis
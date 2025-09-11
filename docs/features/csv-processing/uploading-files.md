---
title: How to Upload CSV Files
category: Features
subcategory: CSV Processing
keywords: upload, csv, file upload, import data
difficulty: beginner
---

# How to Upload CSV Files

## Complete Guide to File Uploads

Uploading CSV files to Cutty is simple and flexible. This guide covers everything you need to know about getting your data into the system.

## Upload Methods

### Method 1: Click to Browse
1. Click the **Upload** button or **Choose File** area
2. Navigate to your file location
3. Select one or more CSV files
4. Click **Open** to begin upload

### Method 2: Drag and Drop
1. Open your file explorer/finder
2. Locate your CSV file
3. Drag the file onto the upload area
4. Release to start upload

### Method 3: API Upload
For programmatic uploads:
```bash
curl -X POST https://cutty.emilycogsdill.com/api/v1/files/upload \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@yourfile.csv"
```

## File Requirements

### Size Limits
- **Maximum file size**: 50MB per file
- **Recommended size**: Under 25MB for optimal performance
- **Row limit**: Approximately 500,000 rows (depending on columns)
- **Column limit**: Up to 500 columns

### Supported Formats
- **.csv**: Standard comma-separated values
- **.tsv**: Tab-separated values
- **.txt**: Delimited text files
- **Custom delimiters**: Pipe (|), semicolon (;), and others

### Encoding Support
- **UTF-8** (recommended)
- **UTF-16**
- **ISO-8859-1** (Latin-1)
- **Windows-1252**
- **ASCII**

## Pre-Upload Checklist

### Data Preparation
- ✓ Remove unnecessary columns to reduce file size
- ✓ Ensure first row contains column headers
- ✓ Check for consistent data formats
- ✓ Remove special formatting from cells
- ✓ Save as CSV (not Excel format)

### Common Issues to Check
- No embedded images or charts
- No merged cells
- No formulas (values only)
- No multiple sheets (first sheet only)
- No password protection

## Upload Process

### Step 1: Initiate Upload
1. Log into your Cutty account
2. Navigate to Dashboard or Upload page
3. Click **Upload** button

### Step 2: File Selection
1. Choose your file using preferred method
2. Multiple files can be selected (processed sequentially)
3. Total size of all files must not exceed limits

### Step 3: Parse Configuration
Cutty auto-detects settings, but you can adjust:

#### Delimiter Options
- **Auto-detect** (default)
- Comma (,)
- Tab (\t)
- Semicolon (;)
- Pipe (|)
- Custom character

#### Advanced Options
- **Has Headers**: Toggle if first row isn't column names
- **Quote Character**: For fields containing delimiters
- **Escape Character**: For special characters
- **Skip Rows**: Ignore first N rows
- **Encoding**: Override detected encoding

### Step 4: Preview & Confirm
1. Review the preview table
2. Check column headers are correct
3. Verify data types are recognized
4. Confirm or adjust settings
5. Click **Upload** to proceed

### Step 5: Processing
Processing time depends on file size:
- **< 100KB**: Instant
- **100KB - 1MB**: 1-2 seconds
- **1MB - 5MB**: 3-5 seconds
- **5MB - 50MB**: 10-30 seconds

## During Upload

### Progress Indicators
- Progress bar shows upload percentage
- File size and speed displayed
- Estimated time remaining
- Cancel option available

### What Happens
1. File is transmitted securely (HTTPS)
2. Server validates file format
3. Data is parsed and indexed
4. File is stored in your account
5. Processing completes

## After Upload

### Success Actions
- File appears in your file list
- Preview automatically opens
- Statistics displayed (rows, columns, size)
- Ready for processing

### Available Operations
- View full data
- Apply filters
- Select columns
- Export subsets
- Create queries
- Generate cross-tabs

## Troubleshooting Uploads

### Upload Fails Immediately
**Cause**: File too large or wrong format
**Solution**: Check file size and ensure it's a valid CSV

### Parse Errors
**Cause**: Inconsistent delimiters or encoding issues
**Solution**: 
1. Open file in text editor
2. Check for consistency
3. Re-save as UTF-8 CSV
4. Try manual delimiter selection

### Missing Data
**Cause**: Incorrect delimiter or quote settings
**Solution**: Adjust parse settings and re-upload

### Special Characters Display Wrong
**Cause**: Encoding mismatch
**Solution**: 
1. Select correct encoding
2. Or re-save file as UTF-8

### Timeout Errors
**Cause**: Network issues or very large file
**Solution**: 
1. Check internet connection
2. Try smaller file chunks
3. Use off-peak hours

## Best Practices

### File Naming
- Use descriptive names
- Include dates (YYYY-MM-DD format)
- Avoid special characters
- Keep names under 50 characters

### Organization
- Upload related files together
- Use consistent naming schemes
- Delete old versions
- Track file lineage

### Performance Tips
- Upload during off-peak hours
- Compress before uploading if needed
- Split very large files
- Remove unnecessary data before upload

## Security & Privacy

### Data Protection
- All uploads use HTTPS encryption
- Files stored securely in cloud storage
- Access restricted to your account
- No public file sharing by default

### Compliance
- GDPR compliant data handling
- SOC 2 Type II certified infrastructure
- Regular security audits
- Data retention policies

## API Upload Details

For automated uploads:

### Authentication
```javascript
const headers = {
  'Authorization': 'Bearer YOUR_API_KEY',
  'Content-Type': 'multipart/form-data'
};
```

### Upload Code Example
```javascript
const formData = new FormData();
formData.append('file', fileBlob, 'data.csv');
formData.append('hasHeaders', 'true');
formData.append('delimiter', ',');

const response = await fetch('/api/v1/files/upload', {
  method: 'POST',
  headers: headers,
  body: formData
});
```

## Related Topics

- [File Formats and Limits](file-formats.md)
- [Parsing Options](parsing-options.md)
- [Troubleshooting Upload Issues](troubleshooting.md)
- [API Documentation](/api-reference/endpoints/files.md)

## Need More Help?

If you're still having issues:
1. Check our [troubleshooting guide](troubleshooting.md)
2. Click the help button to ask me directly
3. Contact support with error details
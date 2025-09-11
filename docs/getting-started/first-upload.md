---
title: Upload Your First CSV
category: Getting Started
keywords: upload, first file, csv upload, getting started
difficulty: beginner
---

# Upload Your First CSV File

## Step-by-Step Upload Guide

This guide walks you through uploading your first CSV file to Cutty, from preparation to successful processing.

## Before You Upload

### Check Your File
- **Format**: Ensure your file is in CSV format (.csv extension)
- **Size**: Must be under 50MB (larger files need to be split)
- **Encoding**: UTF-8 is recommended, but Cutty handles most encodings
- **Headers**: First row should contain column names

### Supported Formats
- Standard CSV (comma-separated)
- TSV (tab-separated)
- Pipe-delimited (|)
- Semicolon-delimited (;)
- Custom delimiters

## How to Upload

### Step 1: Navigate to Upload
1. Log into Cutty
2. Click the **Upload** button in the top navigation
3. Or click the **+** icon on the dashboard

### Step 2: Select Your File
1. Click **Choose File** or drag and drop
2. Browse to your CSV file location
3. Select the file and click **Open**

### Step 3: Review Parse Settings
Cutty automatically detects:
- Delimiter type
- Quote character
- Escape character
- Encoding

If needed, you can adjust:
- **Delimiter**: Change if incorrectly detected
- **Has Headers**: Toggle if first row isn't headers
- **Encoding**: Select if characters appear incorrect

### Step 4: Confirm Upload
1. Preview the first few rows
2. Check column names are correct
3. Verify data looks as expected
4. Click **Upload** to proceed

### Step 5: Processing
- Small files (< 1MB): Instant processing
- Medium files (1-5MB): 2-5 seconds
- Large files (5-50MB): 10-30 seconds

## After Upload Success

Your file is now:
- Stored securely in your account
- Available in your file list
- Ready for processing and analysis
- Tracked with upload timestamp

## What Can Go Wrong?

### Common Upload Issues

#### File Too Large
**Problem**: File exceeds 50MB limit  
**Solution**: Split the file into smaller chunks using a text editor or command line tools

#### Invalid Format
**Problem**: File isn't recognized as CSV  
**Solution**: Ensure file has .csv extension and contains delimiter-separated values

#### Encoding Issues
**Problem**: Special characters appear as symbols  
**Solution**: Re-save the file as UTF-8 or select correct encoding during upload

#### Missing Headers
**Problem**: First row contains data, not column names  
**Solution**: Toggle "Has Headers" option to false, or add headers to your file

#### Corrupt File
**Problem**: File won't parse correctly  
**Solution**: Open in spreadsheet software, re-save as CSV

## Pro Tips

### Optimal File Preparation
1. Remove unnecessary columns before upload
2. Clean data of special formatting
3. Ensure consistent date formats
4. Remove trailing empty rows

### Batch Uploads
- Upload multiple files sequentially
- Use consistent naming conventions
- Group related files in sessions

### Performance Tips
- Compress large datasets before upload
- Upload during off-peak hours for faster processing
- Use API for automated uploads

## Sample Files

Want to practice? Try these sample formats:

### Basic CSV
```csv
Name,Age,City
John Doe,30,New York
Jane Smith,25,Los Angeles
Bob Johnson,35,Chicago
```

### With Special Characters
```csv
Product,Price,Description
Widget A,$19.99,"High-quality, durable"
Widget B,$29.99,"Premium edition, limited"
Widget C,$9.99,"Basic model, affordable"
```

## Next Steps

Now that your file is uploaded:
1. [Learn to filter data](../features/csv-cutting/row-filtering.md)
2. [Select specific columns](../features/csv-cutting/column-selection.md)
3. [Build visual queries](../features/query-builder/overview.md)
4. [Export your results](../features/csv-cutting/export-options.md)

## Getting Help

If upload fails:
1. Check the error message for specific issues
2. Review the troubleshooting section
3. Click the help button to ask for assistance
4. Contact support if problems persist

Remember: Cutty is here to make data processing easy. Don't hesitate to ask for help!
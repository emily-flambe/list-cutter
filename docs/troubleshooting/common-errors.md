---
title: Common Errors and Solutions
category: Troubleshooting
keywords: errors, troubleshooting, problems, fixes, solutions, debugging
difficulty: all
---

# Common Errors and Solutions

## Quick Solutions for Cutty Issues

Find immediate solutions to the most common problems users encounter when using Cutty.

## Upload Errors

### Error: "File too large"
**Problem**: Your CSV file exceeds the 50MB limit.

**Solutions**:
1. **Split the file**:
   - Open in Excel or text editor
   - Save in multiple parts (e.g., by date range)
   - Upload each part separately
   - Process individually or use Query Builder to combine

2. **Remove unnecessary columns**:
   - Open file in Excel
   - Delete columns you don't need
   - Save and try uploading again

3. **Filter before uploading**:
   - Apply filters in Excel
   - Export only needed rows
   - Upload filtered data

### Error: "Invalid file format"
**Problem**: File is not recognized as valid CSV.

**Solutions**:
1. **Check file extension**:
   - Must be .csv, .tsv, or .txt
   - Rename if needed (e.g., .xls to .csv won't work)
   - Export from Excel as CSV if currently .xlsx

2. **Verify CSV structure**:
   - Open in text editor
   - Check for comma/tab delimiters
   - Ensure consistent delimiter throughout

3. **Fix encoding**:
   - Save as UTF-8 encoding
   - In Excel: Save As → Tools → Web Options → Encoding → UTF-8
   - Remove special characters if present

### Error: "No data found in file"
**Problem**: File appears empty or unreadable.

**Solutions**:
1. **Check for hidden characters**:
   - Open in Notepad/TextEdit
   - Look for actual data content
   - Remove blank rows at start

2. **Verify file isn't corrupted**:
   - Try opening in Excel
   - If Excel can't open, file is corrupted
   - Request fresh export from source

3. **Check delimiter**:
   - Cutty auto-detects comma, tab, semicolon
   - Ensure consistent delimiter used
   - Convert to standard CSV if needed

## Processing Errors

### Error: "Failed to parse CSV"
**Problem**: CSV structure is malformed.

**Solutions**:
1. **Fix quote issues**:
   - Ensure quotes are properly closed
   - Use double quotes for text with commas
   - Escape quotes within quoted text

2. **Handle line breaks**:
   - Remove line breaks within cells
   - Or properly quote multi-line cells
   - Use Find/Replace in Excel

3. **Standardize delimiters**:
   - Don't mix commas and tabs
   - Choose one delimiter type
   - Use Find/Replace to standardize

### Error: "Column count mismatch"
**Problem**: Rows have different numbers of columns.

**Solutions**:
1. **Find problem rows**:
   - Open in Excel
   - Look for rows extending beyond normal columns
   - Check for extra delimiters

2. **Fix in Excel**:
   - Ensure all rows have same column count
   - Add empty cells where needed
   - Remove extra columns

3. **Clean trailing delimiters**:
   - Remove commas at end of lines
   - Use Find/Replace: ",\n" with "\n"

### Error: "Memory limit exceeded"
**Problem**: Browser ran out of memory processing large file.

**Solutions**:
1. **Reduce browser load**:
   - Close other tabs
   - Clear browser cache
   - Restart browser
   - Try Chrome (most memory-efficient)

2. **Process smaller batches**:
   - Upload smaller file chunks
   - Apply filters early to reduce data
   - Export results between operations

3. **Use different computer**:
   - Try device with more RAM
   - Use desktop instead of mobile
   - Process during off-peak hours

## Query Builder Errors

### Error: "Invalid filter value"
**Problem**: Filter contains invalid data for column type.

**Solutions**:
1. **Match data type**:
   - Use numbers for numeric columns
   - Use proper date format for dates
   - Quote text values if needed

2. **Check for typos**:
   - Verify spelling of filter values
   - Check case sensitivity
   - Use dropdown suggestions when available

3. **Handle NULL values**:
   - Use "IS NULL" for empty cells
   - Don't use = "" for NULL checks
   - Consider COALESCE for defaults

### Error: "No results found"
**Problem**: Filters are too restrictive.

**Solutions**:
1. **Loosen filters**:
   - Remove filters one by one
   - Check if ANY results exist
   - Use OR instead of AND logic

2. **Check filter logic**:
   - Verify AND/OR combinations
   - Look for conflicting conditions
   - Test each filter individually

3. **Verify data exists**:
   - Check raw file for expected values
   - Ensure case matches exactly
   - Look for extra spaces in data

## Cuttytabs Errors

### Error: "Too many unique values"
**Problem**: Selected field has too many distinct values for crosstab.

**Solutions**:
1. **Group values**:
   - Create categories/bins
   - Use date grouping (month instead of day)
   - Combine small categories into "Other"

2. **Filter first**:
   - Apply filters to reduce data
   - Focus on top N values
   - Exclude rare categories

3. **Choose different fields**:
   - Select fields with fewer unique values
   - Use categorical instead of continuous
   - Try different row/column combination

### Error: "Crosstab generation failed"
**Problem**: System couldn't create crosstab from data.

**Solutions**:
1. **Simplify request**:
   - Reduce number of rows/columns
   - Remove complex calculations
   - Try basic count first

2. **Check data quality**:
   - Ensure no corrupted values
   - Verify field types are correct
   - Remove special characters

3. **Try alternative approach**:
   - Export data and use Excel pivot
   - Use Query Builder for simple aggregation
   - Break into smaller crosstabs

## Export Errors

### Error: "Export failed"
**Problem**: Cannot generate export file.

**Solutions**:
1. **Reduce export size**:
   - Apply filters to reduce rows
   - Select fewer columns
   - Export in batches

2. **Check browser settings**:
   - Allow pop-ups from Cutty
   - Check download folder permissions
   - Clear download history

3. **Try different format**:
   - If CSV fails, try JSON
   - Export without headers
   - Use Query Builder SQL export

### Error: "Download blocked"
**Problem**: Browser blocks file download.

**Solutions**:
1. **Check browser security**:
   - Allow downloads from cutty.emilycogsdill.com
   - Disable aggressive ad blockers
   - Check antivirus settings

2. **Use different browser**:
   - Try Chrome, Firefox, or Edge
   - Disable extensions temporarily
   - Use incognito/private mode

3. **Alternative download**:
   - Right-click download link
   - Choose "Save Link As"
   - Copy download URL directly

## Authentication Errors

### Error: "Session expired"
**Problem**: Login token has expired.

**Solutions**:
1. **Re-login**:
   - Click Login button
   - Enter credentials again
   - Check "Remember me" for longer session

2. **Clear browser data**:
   - Clear cookies for Cutty
   - Clear local storage
   - Try incognito mode

3. **Check account status**:
   - Verify email if new account
   - Reset password if forgotten
   - Contact support if locked

### Error: "Google login failed"
**Problem**: Cannot authenticate with Google.

**Solutions**:
1. **Check Google account**:
   - Ensure Google account is active
   - Try logging into Google first
   - Check for 2FA issues

2. **Browser issues**:
   - Allow third-party cookies
   - Disable popup blockers
   - Clear Google cookies

3. **Try alternative**:
   - Use email/password login
   - Create new account with email
   - Try different Google account

## Performance Issues

### Slow Upload
**Solutions**:
1. Check internet connection speed
2. Upload during off-peak hours
3. Use wired instead of WiFi
4. Compress file before upload

### Slow Processing
**Solutions**:
1. Close other browser tabs
2. Use more powerful computer
3. Process smaller chunks
4. Simplify operations

### Browser Freezing
**Solutions**:
1. Refresh page
2. Clear browser cache
3. Update browser to latest version
4. Disable browser extensions

## Getting Help

### Still Having Issues?
1. **Check FAQ**: Review frequently asked questions
2. **Use Assistant**: Ask Cutty chatbot for help
3. **Review Docs**: Check feature documentation
4. **Contact Support**: Email support with error details

### Reporting Bugs
When reporting issues, include:
- Exact error message
- Steps to reproduce
- Browser and version
- File size and type
- Screenshot if possible
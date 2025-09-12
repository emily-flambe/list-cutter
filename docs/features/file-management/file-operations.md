---
title: File Operations Guide
category: Features
subcategory: File Management
keywords: file operations, rename, delete, download, copy, move, file management
difficulty: beginner
---

# File Operations Guide

## Complete Guide to File Operations

Cutty provides a comprehensive set of file operations to help you manage your data files effectively. This guide covers all available operations, from basic actions like rename and delete to advanced bulk operations.

## Basic File Operations

### File Selection
Before performing operations, you need to select files:

#### Single File Selection
- **Click to Select**: Click on any file to select it
- **Selection Indicator**: Selected files show visual highlight
- **Details Panel**: Selected file details appear in side panel
- **Operation Menu**: Right-click for context menu

#### Multiple File Selection
- **Ctrl+Click**: Add individual files to selection (Windows/Linux)
- **Cmd+Click**: Add individual files to selection (Mac)
- **Shift+Click**: Select range of files
- **Select All**: Choose all files in current view
- **Select None**: Clear current selection

#### Selection Tools
- **Select by Type**: Choose all CSV, Excel, or text files
- **Select by Date**: Choose files from specific date ranges
- **Select by Size**: Choose files within size ranges
- **Select by Tag**: Choose files with specific tags

### Rename Files
Change file names for better organization:

#### Single File Rename
1. **Select File**: Click on the file to rename
2. **Rename Action**: Click rename button or press F2
3. **Edit Name**: Type new filename in text field
4. **Confirm**: Press Enter or click Save
5. **Cancel**: Press Escape to cancel editing

#### Batch Rename
Rename multiple files at once:
1. **Select Files**: Choose multiple files to rename
2. **Batch Rename**: Click Batch Rename button
3. **Choose Pattern**: Select naming pattern
4. **Preview Changes**: Review proposed new names
5. **Apply**: Confirm batch rename operation

#### Rename Patterns
Standard patterns for batch renaming:

**Add Prefix**
```
Pattern: "project_" + original name
Before: data.csv, results.csv
After: project_data.csv, project_results.csv
```

**Add Suffix**
```
Pattern: original name + "_v2"
Before: customers.csv, sales.csv
After: customers_v2.csv, sales_v2.csv
```

**Replace Text**
```
Pattern: Replace "old" with "new"
Before: old_customers.csv, old_sales.csv
After: new_customers.csv, new_sales.csv
```

**Sequential Numbering**
```
Pattern: "file_" + sequential number
Before: Various names
After: file_001.csv, file_002.csv, file_003.csv
```

**Date-Based Naming**
```
Pattern: original name + "_" + current date
Before: report.csv
After: report_2024-03-15.csv
```

### Delete Files
Remove files you no longer need:

#### Single File Deletion
1. **Select File**: Click on file to delete
2. **Delete Action**: Click delete button or press Delete key
3. **Confirm**: Confirm deletion in popup dialog
4. **Permanent**: File is permanently removed

#### Bulk Deletion
Delete multiple files simultaneously:
1. **Select Files**: Choose multiple files to delete
2. **Bulk Delete**: Click Bulk Delete button
3. **Review List**: Check list of files to be deleted
4. **Confirm**: Confirm bulk deletion operation
5. **Progress**: Monitor deletion progress

#### Safe Deletion Features
- **Confirmation Dialog**: Always confirm before deletion
- **File List Review**: See exactly what will be deleted
- **Dependency Check**: Warn if files are used elsewhere
- **Undo Window**: Brief period to undo deletion
- **Audit Trail**: Log all deletion operations

#### Deletion Considerations
Before deleting files, consider:
- **File Dependencies**: Other files created from this source
- **Shared Access**: Files shared with team members
- **Backup**: Ensure important files are backed up
- **Regulatory**: Compliance requirements for data retention

### Download Files
Get files back to your computer:

#### Single File Download
1. **Select File**: Click on file to download
2. **Download Action**: Click download button
3. **Save Location**: Choose where to save file
4. **Download**: File transfers to your computer

#### Bulk Download
Download multiple files as ZIP:
1. **Select Files**: Choose files to download
2. **Bulk Download**: Click Bulk Download button
3. **ZIP Creation**: System creates compressed archive
4. **Download ZIP**: Single ZIP file downloads
5. **Extract**: Unzip files on your computer

#### Download Options
- **Original Format**: Download in original format
- **Convert Format**: Download in different format (CSV, Excel, etc.)
- **Include Metadata**: Add file information to download
- **Compressed**: Download as ZIP for faster transfer

### Copy Files
Create duplicates for different purposes:

#### Single File Copy
1. **Select File**: Click on file to copy
2. **Copy Action**: Click copy button or Ctrl+C
3. **Choose Location**: Select destination folder
4. **Name Copy**: Optionally rename the copy
5. **Create Copy**: Confirm copy operation

#### Bulk Copy
Copy multiple files at once:
1. **Select Files**: Choose files to copy
2. **Bulk Copy**: Click Bulk Copy button
3. **Destination**: Choose target folder
4. **Naming**: Select naming strategy for copies
5. **Execute**: Perform bulk copy operation

#### Copy Options
- **Same Folder**: Create copy in same location
- **Different Folder**: Copy to another folder
- **Rename Copy**: Give copy a different name
- **Link Lineage**: Maintain relationship to original

### Move Files
Relocate files to different folders:

#### Single File Move
1. **Select File**: Click on file to move
2. **Move Action**: Click move button or Ctrl+X
3. **Destination**: Choose target folder
4. **Confirm**: Confirm move operation
5. **Update References**: System updates file references

#### Bulk Move
Move multiple files simultaneously:
1. **Select Files**: Choose files to move
2. **Bulk Move**: Click Bulk Move button
3. **Destination**: Select target folder
4. **Conflict Resolution**: Handle name conflicts
5. **Execute**: Perform bulk move operation

#### Drag and Drop
Visual move operations:
- **Drag Files**: Click and drag files to new location
- **Drop Zones**: Visual indicators for valid drop locations
- **Modifier Keys**: Hold Ctrl to copy instead of move
- **Visual Feedback**: Clear indication of operation type

## Advanced File Operations

### File Merging
Combine multiple files into one:

#### Vertical Merge (Row Stacking)
Combine files with same columns:
1. **Select Files**: Choose files with compatible structure
2. **Merge Action**: Click Merge Files button
3. **Merge Type**: Select "Stack Rows" option
4. **Column Mapping**: Verify column alignment
5. **Execute**: Create merged file

#### Horizontal Merge (Column Joining)
Combine files with related data:
1. **Select Files**: Choose files to join
2. **Join Type**: Select join method (inner, left, right, full)
3. **Key Columns**: Specify columns to join on
4. **Column Selection**: Choose which columns to include
5. **Execute**: Create joined file

#### Smart Merge
Intelligent file combination:
- **Auto-Detect Structure**: Automatically identify merge type
- **Column Matching**: Smart column name matching
- **Conflict Resolution**: Handle overlapping data
- **Quality Checks**: Validate merge results

### File Splitting
Break large files into smaller pieces:

#### Row-Based Splitting
Split by number of rows:
1. **Select File**: Choose file to split
2. **Split Method**: Select "By Rows"
3. **Row Count**: Specify rows per split file
4. **Naming**: Choose naming pattern for split files
5. **Execute**: Create split files

#### Size-Based Splitting
Split by file size:
1. **Select File**: Choose file to split
2. **Split Method**: Select "By Size"
3. **Target Size**: Specify maximum size per file
4. **Preserve Headers**: Option to include headers in each split
5. **Execute**: Create split files

#### Value-Based Splitting
Split by column values:
1. **Select File**: Choose file to split
2. **Split Method**: Select "By Values"
3. **Split Column**: Choose column to split on
4. **Value Groups**: Specify how to group values
5. **Execute**: Create files for each group

### Version Management
Track file changes over time:

#### Create Version
Save current state as new version:
1. **Select File**: Choose file to version
2. **Create Version**: Click Create Version button
3. **Version Notes**: Add description of changes
4. **Save**: Create new version point

#### Version History
View and manage file versions:
- **Version List**: See all versions of a file
- **Compare Versions**: Highlight differences between versions
- **Restore Version**: Revert to previous version
- **Delete Version**: Remove specific versions

#### Version Naming
Automatic version naming patterns:
- **Sequential**: v1, v2, v3...
- **Date-Based**: 2024-03-15_v1
- **Semantic**: major.minor.patch (1.0.0, 1.1.0, 2.0.0)
- **Custom**: User-defined naming scheme

### File Conversion
Convert between different formats:

#### Format Conversion
Change file format:
1. **Select File**: Choose file to convert
2. **Convert Action**: Click Convert button
3. **Target Format**: Select desired format (CSV, Excel, JSON)
4. **Options**: Configure conversion settings
5. **Execute**: Create converted file

#### Encoding Conversion
Change text encoding:
1. **Select File**: Choose file to convert
2. **Encoding Option**: Select encoding conversion
3. **Source Encoding**: Specify current encoding
4. **Target Encoding**: Choose desired encoding (UTF-8, ASCII, etc.)
5. **Execute**: Create re-encoded file

#### Delimiter Conversion
Change CSV delimiter:
1. **Select File**: Choose CSV file
2. **Delimiter Option**: Select delimiter conversion
3. **Source Delimiter**: Current delimiter (comma, tab, etc.)
4. **Target Delimiter**: Desired delimiter
5. **Execute**: Create converted file

## Folder Operations

### Create Folders
Organize files in folders:

#### New Folder Creation
1. **Create Action**: Click New Folder button
2. **Folder Name**: Enter descriptive folder name
3. **Location**: Choose parent folder location
4. **Confirm**: Create new folder

#### Folder Templates
Pre-defined folder structures:
- **Project Folder**: Standard project organization
- **Date Folder**: Year/Month/Day hierarchy
- **Department Folder**: Organizational structure
- **Custom Template**: User-defined folder structure

### Folder Management

#### Rename Folders
1. **Select Folder**: Click on folder to rename
2. **Rename Action**: Click rename or press F2
3. **New Name**: Enter new folder name
4. **Confirm**: Save new folder name

#### Move Folders
1. **Select Folder**: Choose folder to move
2. **Move Action**: Click move or drag to new location
3. **Destination**: Select target parent folder
4. **Confirm**: Complete move operation

#### Delete Folders
1. **Select Folder**: Click on folder to delete
2. **Delete Action**: Click delete button
3. **Content Warning**: System warns about folder contents
4. **Confirm**: Confirm deletion of folder and contents

### Folder Permissions
Control access to folders:

#### Permission Levels
- **View**: Can see folder and files
- **Edit**: Can modify files in folder
- **Manage**: Can add/remove files and change permissions
- **Admin**: Full control including folder deletion

#### Setting Permissions
1. **Select Folder**: Choose folder to configure
2. **Permissions**: Click permissions button
3. **Add Users**: Add team members
4. **Set Levels**: Assign permission levels
5. **Save**: Apply permission settings

## Bulk Operations

### Bulk Selection Strategies

#### Smart Selection
- **Select by Pattern**: Choose files matching name patterns
- **Select by Date Range**: Choose files from specific time periods
- **Select by Size Range**: Choose files within size limits
- **Select by File Type**: Choose specific file formats

#### Filter-Based Selection
1. **Apply Filters**: Use search and filter tools
2. **Review Results**: Check filtered file list
3. **Select All Filtered**: Choose all files matching filters
4. **Perform Operation**: Apply bulk operation to selection

### Bulk Operation Types

#### Information Operations
- **Bulk Properties**: View properties of multiple files
- **Bulk Statistics**: Generate statistics across files
- **Bulk Validation**: Check data quality across files
- **Bulk Metadata**: Update metadata for multiple files

#### Transformation Operations
- **Bulk Conversion**: Convert multiple files to different formats
- **Bulk Cleaning**: Apply data cleaning to multiple files
- **Bulk Normalization**: Standardize data across files
- **Bulk Validation**: Apply validation rules to multiple files

#### Management Operations
- **Bulk Tagging**: Apply tags to multiple files
- **Bulk Organization**: Move files to appropriate folders
- **Bulk Archiving**: Archive old files based on criteria
- **Bulk Deletion**: Remove multiple files safely

### Operation Progress Tracking

#### Progress Indicators
- **Overall Progress**: Total operation completion percentage
- **Individual File Status**: Status of each file in bulk operation
- **Error Reporting**: Details of any failures
- **Time Estimates**: Estimated completion time

#### Cancellation and Rollback
- **Cancel Operation**: Stop bulk operation in progress
- **Partial Rollback**: Undo completed parts of operation
- **Full Rollback**: Completely reverse bulk operation
- **Error Recovery**: Handle and retry failed operations

## File Operation Security

### Permission Checks
Every operation respects file permissions:
- **Read Permissions**: Required for copy and download operations
- **Write Permissions**: Required for rename and modify operations
- **Delete Permissions**: Required for delete and move operations
- **Admin Permissions**: Required for sharing and permission changes

### Audit Logging
All file operations are logged:
- **Operation Type**: What operation was performed
- **User Identity**: Who performed the operation
- **Timestamp**: When the operation occurred
- **File Details**: Which files were affected
- **Result Status**: Success or failure of operation

### Data Protection
Operations include safety measures:
- **Backup Before Delete**: Temporary backup of deleted files
- **Conflict Detection**: Prevent accidental overwrites
- **Validation Checks**: Ensure operations are safe
- **Recovery Options**: Ability to undo recent operations

## Automation and Scripting

### Scheduled Operations
Automate routine file operations:

#### Cleanup Schedules
- **Daily Cleanup**: Remove temporary files daily
- **Weekly Archive**: Archive old files weekly
- **Monthly Purge**: Delete very old files monthly
- **Custom Schedules**: User-defined automation rules

#### Maintenance Operations
- **Duplicate Detection**: Regular duplicate file scanning
- **Storage Optimization**: Automatic compression and cleanup
- **Metadata Updates**: Keep file information current
- **Link Validation**: Ensure file relationships are valid

### API Operations
Programmatic file operations:

#### Basic Operations API
```javascript
// Rename file
await fetch('/api/v1/files/rename', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify({
    fileId: 'file123',
    newName: 'updated_filename.csv'
  })
});

// Delete file
await fetch('/api/v1/files/delete', {
  method: 'DELETE',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify({
    fileId: 'file123'
  })
});

// Copy file
await fetch('/api/v1/files/copy', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify({
    fileId: 'file123',
    destinationFolder: 'folder456',
    newName: 'copied_file.csv'
  })
});
```

#### Bulk Operations API
```javascript
// Bulk rename
await fetch('/api/v1/files/bulk-rename', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify({
    fileIds: ['file1', 'file2', 'file3'],
    pattern: 'project_{original_name}'
  })
});

// Bulk move
await fetch('/api/v1/files/bulk-move', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify({
    fileIds: ['file1', 'file2', 'file3'],
    destinationFolder: 'archive_folder'
  })
});
```

## Troubleshooting File Operations

### Common Issues

#### Permission Denied
**Problem**: Cannot perform operation due to permissions
**Solutions**:
1. **Check Permissions**: Verify you have necessary permissions
2. **Contact Owner**: Request access from file owner
3. **Admin Help**: Ask administrator for permission update
4. **Account Issues**: Verify account status and access level

#### File in Use
**Problem**: Cannot modify file because it's being used
**Solutions**:
1. **Wait and Retry**: File may be temporarily locked
2. **Check Processes**: See if file is being processed
3. **Close Dependencies**: Close any related operations
4. **Admin Override**: Administrator can force unlock

#### Storage Quota Exceeded
**Problem**: Cannot copy or move due to storage limits
**Solutions**:
1. **Free Up Space**: Delete unnecessary files
2. **Move to External**: Move files to external storage
3. **Upgrade Plan**: Increase storage quota
4. **Optimize Files**: Reduce file sizes

#### Network Issues
**Problem**: Operations fail due to connectivity
**Solutions**:
1. **Check Connection**: Verify internet connectivity
2. **Retry Operation**: Try again after connection stabilizes
3. **Smaller Batches**: Reduce size of bulk operations
4. **Download/Upload**: Use local operations when possible

### Error Recovery

#### Operation Rollback
When operations fail:
- **Automatic Rollback**: System reverses partial operations
- **Manual Rollback**: User can trigger operation reversal
- **Checkpoint Recovery**: Restore to last known good state
- **Selective Recovery**: Choose which parts to rollback

#### Data Recovery
For data loss situations:
- **Version History**: Restore from previous versions
- **Backup Recovery**: Restore from automatic backups
- **Audit Trail**: Use logs to understand what happened
- **Support Recovery**: Contact support for assistance

## Best Practices

### Organization
1. **Consistent Naming**: Use clear, consistent file naming conventions
2. **Logical Folders**: Organize files in intuitive folder structures
3. **Regular Cleanup**: Perform regular maintenance operations
4. **Documentation**: Document file purposes and relationships

### Safety
1. **Backup Important Files**: Always backup critical data
2. **Test Operations**: Try operations on sample data first
3. **Verify Results**: Check operation results before continuing
4. **Monitor Storage**: Keep track of storage usage

### Efficiency
1. **Batch Operations**: Use bulk operations for efficiency
2. **Automation**: Set up automated routine operations
3. **Organization**: Well-organized files are easier to manage
4. **Planning**: Plan file operations to avoid rework

### Collaboration
1. **Clear Permissions**: Set appropriate access levels
2. **Communication**: Communicate file changes to team
3. **Standards**: Establish team standards for file operations
4. **Training**: Ensure team knows how to use file operations

## Related Features

File operations integrate with:
- **File Management**: Overall file organization and storage
- **Storage Limits**: Understanding how operations affect quotas
- **Lineage Tracking**: How operations affect file relationships
- **CSV Cutting**: File operations on cut and filtered data

## Next Steps

- Learn about [Lineage Tracking](lineage-tracking.md) to understand file relationships
- Review [File Management Overview](overview.md) for comprehensive file organization
- Check [Storage Limits](storage-limits.md) to understand storage implications
- Explore the [API Documentation](/api-reference/endpoints/files.md) for programmatic operations
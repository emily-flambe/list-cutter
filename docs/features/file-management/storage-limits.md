---
title: Storage Limits and Quotas
category: Features
subcategory: File Management
keywords: storage limits, storage quotas, file size limits, storage management, usage monitoring
difficulty: beginner
---

# Storage Limits and Quotas

## Understanding Your Storage Allowances

Cutty implements storage limits to ensure fair resource usage and optimal performance for all users. This guide explains storage quotas, how to monitor usage, and strategies for efficient storage management.

## Storage Limit Overview

### What are Storage Limits?
Storage limits define how much data you can store in your Cutty account:
- **File Size Limits**: Maximum size for individual files
- **Total Storage Quota**: Maximum total storage across all files
- **Monthly Upload Limits**: How much data you can upload per month
- **File Count Limits**: Maximum number of files you can store

### Why Storage Limits Exist
Storage limits serve important purposes:
- **Fair Usage**: Ensure resources are available for all users
- **Performance**: Maintain fast response times for the platform
- **Cost Management**: Control infrastructure and storage costs
- **Quality Control**: Encourage efficient data management practices

## Storage Quotas by Plan

### Free Tier
Basic storage for individual users:
- **Individual File Limit**: 50MB per file
- **Total Storage**: 100MB total across all files
- **Monthly Upload**: 500MB per month
- **File Count**: Up to 50 files maximum
- **Retention**: Files kept for 30 days of inactivity

### Pro Tier
Enhanced storage for regular users:
- **Individual File Limit**: 50MB per file
- **Total Storage**: 5GB total across all files
- **Monthly Upload**: 10GB per month
- **File Count**: Up to 1,000 files maximum
- **Retention**: Files kept for 1 year of inactivity

### Team Tier
Shared storage for collaborative teams:
- **Individual File Limit**: 50MB per file
- **Total Storage**: 50GB shared across team
- **Monthly Upload**: 100GB per month per team
- **File Count**: Up to 10,000 files maximum
- **Retention**: Files kept for 2 years of inactivity

### Enterprise Tier
Custom storage for large organizations:
- **Individual File Limit**: Configurable (up to 100MB)
- **Total Storage**: Custom quotas (starting at 500GB)
- **Monthly Upload**: Custom limits
- **File Count**: Unlimited
- **Retention**: Custom retention policies

## Individual File Size Limits

### Maximum File Size: 50MB
All uploaded files must be under 50MB:
- **CSV Files**: Approximately 500,000-2,500,000 rows (depending on columns)
- **Excel Files**: Multiple sheets counted together
- **Text Files**: Any delimiter-separated text format
- **Compressed Files**: ZIP files count by uncompressed size

### Why 50MB Limit?
The 50MB limit ensures:
- **Fast Processing**: Files process quickly for responsive user experience
- **Browser Compatibility**: Works reliably across all web browsers
- **Memory Management**: Fits comfortably in browser and server memory
- **Network Efficiency**: Reasonable upload times on various connections

### File Size Calculation
File size includes:
- **Raw Data**: The actual CSV content
- **Metadata**: File information and processing history
- **Indexes**: Data structure for fast querying
- **Versions**: If multiple versions are kept

## Storage Usage Monitoring

### Real-Time Usage Display
Monitor your storage consumption:

#### Dashboard Overview
- **Total Used**: Current storage consumption
- **Quota Remaining**: Available storage space
- **Percentage Used**: Visual progress bar
- **Largest Files**: Files consuming most space

#### Detailed Breakdown
- **By File Type**: CSV, Excel, text file usage
- **By Date**: Storage usage over time
- **By Folder**: Space used in each folder
- **By Source**: Original vs. derived file usage

### Usage Alerts
Automatic notifications when approaching limits:

#### Warning Thresholds
- **75% Used**: First warning notification
- **90% Used**: Strong warning with cleanup suggestions
- **95% Used**: Critical warning, consider immediate action
- **98% Used**: Final warning before limit reached

#### Alert Methods
- **In-App Notifications**: Visible when using Cutty
- **Email Alerts**: Sent to account email address
- **Dashboard Badges**: Visual indicators on main interface
- **API Responses**: Programmatic access to usage warnings

### Historical Usage Tracking
Understanding usage patterns over time:

#### Usage Trends
- **Monthly Usage**: Track storage over months
- **Upload Patterns**: When you upload most data
- **Growth Rate**: How quickly storage is increasing
- **Seasonal Patterns**: Identify usage cycles

#### Usage Analytics
- **File Lifecycle**: How long files typically stay
- **Processing Patterns**: Which operations use most space
- **Access Patterns**: Which files are accessed most
- **Cleanup Opportunities**: Identify unused files

## Managing Storage Efficiently

### Optimization Strategies

#### File Size Reduction
Reduce individual file sizes:
- **Column Reduction**: Remove unnecessary columns before upload
- **Row Filtering**: Filter out irrelevant rows
- **Data Cleaning**: Remove empty rows and columns
- **Format Optimization**: Use most efficient data formats

#### Duplicate Management
Eliminate redundant files:
- **Duplicate Detection**: Identify identical or similar files
- **Version Control**: Keep only necessary versions
- **Merge Opportunities**: Combine related files
- **Archive Strategy**: Move old files to external storage

#### Regular Cleanup
Maintain storage proactively:
- **Scheduled Reviews**: Regular storage audits
- **Automated Cleanup**: Set up automatic file removal
- **Archive Old Files**: Move inactive files elsewhere
- **Delete Processed Files**: Remove intermediate processing files

### Storage Best Practices

#### Efficient Upload Practices
- **Pre-process Files**: Clean and optimize before uploading
- **Compress When Possible**: Use ZIP compression for large files
- **Batch Uploads**: Upload related files together
- **Avoid Duplicates**: Check for existing files before uploading

#### Smart File Management
- **Descriptive Naming**: Use clear names to avoid duplicates
- **Folder Organization**: Group related files to identify cleanup opportunities
- **Tag Usage**: Tag files for easy identification and cleanup
- **Documentation**: Note file purposes to aid in cleanup decisions

#### Retention Strategies
- **Define Lifecycles**: Determine how long different types of files are needed
- **Automatic Expiration**: Set up automatic deletion for temporary files
- **Archive Strategies**: Move old but important files to external storage
- **Backup Important Data**: Ensure critical files are backed up elsewhere

## What Happens When Limits Are Reached

### Upload Restrictions
When storage quota is reached:
- **Upload Blocked**: New file uploads are prevented
- **Error Messages**: Clear explanation of the issue
- **Cleanup Suggestions**: Specific recommendations for freeing space
- **Temporary Solutions**: Options for immediate relief

### Processing Limitations
When approaching limits:
- **Processing Warnings**: Alerts during file operations
- **Reduced Performance**: Slower processing to conserve resources
- **Feature Restrictions**: Some advanced features may be limited
- **Queue Delays**: Operations may be queued longer

### Account Impact
Storage limit effects:
- **Existing Files**: Current files remain accessible
- **New Operations**: New file creation blocked
- **Sharing**: File sharing may be restricted
- **API Access**: Programmatic uploads blocked

## Increasing Storage Limits

### Plan Upgrades
Options for more storage:

#### Upgrade to Pro
- **5GB Total Storage**: 50x more than free tier
- **1,000 File Limit**: 20x more files
- **10GB Monthly Upload**: 20x more monthly capacity
- **Extended Retention**: Files kept much longer

#### Upgrade to Team
- **50GB Shared Storage**: Team-based storage pool
- **Collaboration Features**: Enhanced sharing and permissions
- **10,000 File Limit**: Large-scale file management
- **Team Management**: Multi-user administration

#### Enterprise Solutions
- **Custom Storage**: Tailored to your specific needs
- **Dedicated Resources**: Guaranteed performance
- **Advanced Features**: Enterprise-grade capabilities
- **Support**: Dedicated customer success

### Temporary Expansions
Short-term storage increases:
- **Promotional Offers**: Occasional storage bonuses
- **Trial Extensions**: Extended trials for evaluation
- **Special Events**: Additional storage during campaigns
- **Customer Support**: Case-by-case consideration for special needs

## Storage Optimization Tools

### Built-in Tools

#### Storage Analyzer
Comprehensive storage analysis:
- **File Size Analysis**: Identify largest files
- **Duplicate Detection**: Find identical files
- **Usage Patterns**: Understand how storage is used
- **Cleanup Recommendations**: Specific suggestions for optimization

#### Automatic Compression
System-level optimization:
- **Background Compression**: Automatic file compression
- **Format Optimization**: Convert to efficient formats
- **Deduplication**: Remove duplicate data blocks
- **Intelligent Caching**: Cache frequently accessed data

#### Cleanup Wizard
Guided storage cleanup:
- **Step-by-Step**: Guided cleanup process
- **Safe Deletion**: Prevent accidental data loss
- **Bulk Operations**: Clean multiple files at once
- **Undo Options**: Recover accidentally deleted files

### External Integration

#### Cloud Storage Integration
Connect external storage:
- **Google Drive**: Archive files to Google Drive
- **Dropbox**: Move old files to Dropbox
- **OneDrive**: Integrate with Microsoft OneDrive
- **Amazon S3**: Professional cloud storage integration

#### Export and Archive
Move data out of Cutty:
- **Bulk Export**: Export multiple files at once
- **Automated Export**: Schedule regular exports
- **Format Conversion**: Export in various formats
- **Metadata Preservation**: Keep file history and lineage

## Monitoring and Alerts API

### Programmatic Monitoring
Access storage information via API:

#### Usage Endpoints
```javascript
// Get current storage usage
const usage = await fetch('/api/v1/storage/usage', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
});

// Response format
{
  "totalUsed": "150MB",
  "totalQuota": "5GB", 
  "percentageUsed": 3.0,
  "filesCount": 45,
  "largestFile": "customer_data.csv (8.5MB)"
}
```

#### Alert Configuration
```javascript
// Set up storage alerts
const alertConfig = {
  "warningThreshold": 75,
  "criticalThreshold": 90,
  "emailNotifications": true,
  "webhookUrl": "https://your-app.com/storage-alerts"
};

await fetch('/api/v1/storage/alerts', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify(alertConfig)
});
```

#### Cleanup Automation
```javascript
// Automated cleanup rules
const cleanupRules = {
  "deleteAfterDays": 90,
  "archiveAfterDays": 30,
  "excludeTags": ["important", "permanent"],
  "maxFileAge": "1 year"
};
```

## Troubleshooting Storage Issues

### Common Problems

#### "File Too Large" Error
**Problem**: Cannot upload files over 50MB
**Solutions**:
1. **Reduce Columns**: Remove unnecessary columns
2. **Filter Rows**: Remove irrelevant data rows
3. **Split Files**: Break large files into smaller pieces
4. **Compress Data**: Remove empty cells and optimize format

#### "Storage Quota Exceeded"
**Problem**: Cannot upload due to storage limits
**Solutions**:
1. **Delete Old Files**: Remove files no longer needed
2. **Export and Delete**: Save files externally then delete
3. **Upgrade Plan**: Increase storage quota
4. **Optimize Existing Files**: Reduce size of current files

#### "Monthly Upload Limit Reached"
**Problem**: Cannot upload more data this month
**Solutions**:
1. **Wait for Reset**: Upload limits reset monthly
2. **Delete and Re-upload**: Remove files to free monthly quota
3. **Upgrade Plan**: Increase monthly upload limits
4. **Plan Ahead**: Spread uploads across months

#### Slow Performance
**Problem**: Platform is slow when near storage limits
**Solutions**:
1. **Free Up Space**: Delete unnecessary files
2. **Organize Files**: Better organization improves performance
3. **Reduce File Count**: Merge files where possible
4. **Archive Old Data**: Move old files to external storage

### Getting Help

#### Self-Service Options
- **Storage Analyzer**: Use built-in tools to identify issues
- **Cleanup Wizard**: Guided cleanup process
- **Documentation**: Comprehensive guides and best practices
- **FAQ**: Common questions and solutions

#### Support Options
- **Help Chat**: Real-time assistance with storage issues
- **Email Support**: Detailed support for complex problems
- **Knowledge Base**: Searchable articles and guides
- **Community Forum**: User community for tips and tricks

## Best Practices Summary

### Daily Practices
1. **Monitor Usage**: Check storage dashboard regularly
2. **Clean As You Go**: Delete unnecessary files immediately
3. **Optimize Uploads**: Prepare files before uploading
4. **Use Descriptive Names**: Avoid creating duplicate files

### Weekly Practices
1. **Review Large Files**: Identify optimization opportunities
2. **Organize Folders**: Maintain clean folder structure
3. **Check Duplicates**: Look for and merge duplicate files
4. **Archive Completed Work**: Move finished projects to archive

### Monthly Practices
1. **Storage Audit**: Comprehensive review of all files
2. **Delete Old Files**: Remove files older than needed
3. **Export Archives**: Move old files to external storage
4. **Review Quotas**: Assess if plan changes are needed

### Strategic Practices
1. **Plan Storage Needs**: Anticipate future storage requirements
2. **Establish Policies**: Create team guidelines for storage use
3. **Training**: Ensure team understands efficient storage practices
4. **Regular Reviews**: Periodic assessment of storage strategy

## Related Features

Storage limits work with:
- **File Management**: Overall file organization and management
- **File Operations**: How operations affect storage usage
- **Upload Process**: Understanding how uploads count against quotas
- **Export Features**: Moving data out to manage storage

## Next Steps

- Learn about [File Operations](file-operations.md) to understand how operations affect storage
- Explore [File Management Overview](overview.md) for comprehensive file organization
- Check [Lineage Tracking](lineage-tracking.md) to understand file relationships
- Review the [API Documentation](/api-reference/endpoints/storage.md) for programmatic storage management
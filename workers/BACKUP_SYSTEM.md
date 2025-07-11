# R2 Backup System Documentation

## Overview

The R2 Backup System provides comprehensive disaster recovery capabilities for Cutty's file storage infrastructure. It implements automated backups, verification, and restoration features to ensure data integrity and availability.

## Features

### Core Functionality

1. **Automated Backup Creation**
   - Full backups: Complete backup of all files in the bucket
   - Incremental backups: Only files modified since the last backup
   - Scheduled daily backups at 2 AM UTC

2. **Backup Verification**
   - Checksum validation for data integrity
   - File existence verification
   - Comprehensive verification reports

3. **Backup Restoration**
   - Selective restoration with filtering options
   - Overwrite protection
   - Post-restore verification

4. **Backup Management**
   - Automated cleanup based on retention policies
   - Backup metadata tracking
   - Comprehensive logging and monitoring

### Key Components

#### 1. R2BackupService (`/workers/src/services/backup/r2-backup.ts`)

Main service class that handles all backup operations:

- `createFullBackup()`: Creates a complete backup of all files
- `createIncrementalBackup()`: Creates backup of modified files only
- `verifyBackup(backupId)`: Verifies backup integrity
- `restoreBackup(backupId, options)`: Restores files from backup
- `scheduleDailyBackup()`: Automated backup decision logic
- `cleanupOldBackups()`: Removes expired backups

#### 2. BackupScheduler (`/workers/src/services/backup/scheduler.ts`)

Manages backup scheduling and triggers:

- Automated daily backup execution
- Backup trigger integration with R2 operations
- Failure tracking and error handling
- Schedule management

#### 3. Backup API Routes (`/workers/src/routes/backup.ts`)

RESTful API endpoints for backup management:

- `POST /api/backup/create` - Create new backup
- `GET /api/backup/status/:id` - Get backup status
- `GET /api/backup/list` - List all backups
- `POST /api/backup/verify/:id` - Verify backup integrity
- `POST /api/backup/restore/:id` - Restore from backup
- `GET /api/backup/stats` - Get backup statistics
- `POST /api/backup/cleanup` - Manual cleanup

## Database Schema

### Core Tables

#### r2_backups
Main backup metadata table storing backup information:
- `id`: Unique backup identifier
- `bucket_name`: Source bucket name
- `backup_date`: When backup was created
- `status`: pending, in_progress, completed, failed
- `backup_type`: full or incremental
- `file_count`: Number of files in backup
- `total_size`: Total backup size in bytes
- `checksum`: Overall backup checksum

#### backup_files
Individual file tracking within backups:
- `backup_id`: Reference to parent backup
- `file_path`: Original file path
- `backup_path`: Path in backup bucket
- `file_size`: File size in bytes
- `checksum`: File checksum
- `status`: pending, backed_up, failed

#### backup_logs
Detailed operation logging:
- `backup_id`: Reference to backup
- `timestamp`: Log entry time
- `event_type`: start, progress, complete, error, verify
- `message`: Log message
- `level`: info, warn, error

### Analytics Views

#### backup_summary
Comprehensive backup overview with duration and success metrics.

#### backup_health_metrics
Bucket-level health statistics including success rates and storage usage.

## Configuration

### Environment Variables

Configure backup behavior through wrangler.toml variables:

```toml
# Backup Configuration
BACKUP_RETENTION_DAYS = "30"        # Days to keep backups
BACKUP_SCHEDULE = "daily"           # Backup frequency
BACKUP_INCREMENTAL_ENABLED = "true" # Enable incremental backups
BACKUP_COMPRESSION_ENABLED = "false" # Enable compression
BACKUP_ENCRYPTION_ENABLED = "false"  # Enable encryption
```

### R2 Bucket Configuration

Two R2 buckets are required:

```toml
[[r2_buckets]]
binding = "R2_BUCKET"               # Main storage bucket
bucket_name = "cutty-files"

[[r2_buckets]]
binding = "R2_BACKUP_BUCKET"        # Backup storage bucket
bucket_name = "cutty-backups"
```

### Scheduled Tasks

Automated backup scheduling:

```toml
[triggers]
crons = ["0 2 * * *"]  # Daily at 2 AM UTC
```

## API Usage

### Authentication

All backup API endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Creating Backups

#### Full Backup
```bash
curl -X POST https://your-worker.example.com/api/backup/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'
```

#### Incremental Backup
```bash
curl -X POST https://your-worker.example.com/api/backup/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "incremental"}'
```

#### Auto Backup (Service Decides)
```bash
curl -X POST https://your-worker.example.com/api/backup/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "auto"}'
```

### Backup Verification

```bash
curl -X POST https://your-worker.example.com/api/backup/verify/<backup_id> \
  -H "Authorization: Bearer <token>"
```

### Backup Restoration

```bash
curl -X POST https://your-worker.example.com/api/backup/restore/<backup_id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "overwriteExisting": false,
    "verifyAfterRestore": true,
    "filters": {
      "pathPrefix": "uploads/",
      "fileExtensions": [".csv", ".txt"]
    }
  }'
```

### Listing Backups

```bash
curl "https://your-worker.example.com/api/backup/list?status=completed&limit=20" \
  -H "Authorization: Bearer <token>"
```

### Backup Statistics

```bash
curl https://your-worker.example.com/api/backup/stats \
  -H "Authorization: Bearer <token>"
```

## Backup Strategy

### Automatic Backup Logic

The system automatically determines backup type based on:

1. **Full Backup Triggers:**
   - No previous backup exists
   - Last backup was more than 7 days ago
   - Manual full backup request

2. **Incremental Backup Triggers:**
   - Previous backup exists and is less than 7 days old
   - Incremental backups are enabled
   - Manual incremental backup request

### Retention Policy

- Default retention: 30 days
- Automatic cleanup runs during scheduled backup
- Old backups are removed from both database and R2
- Configurable retention period

### Verification Strategy

Backup verification includes:

1. **File Existence Check:** Verify all backup files exist in R2
2. **Checksum Validation:** Compare stored checksums with actual file checksums
3. **Completeness Check:** Ensure all expected files are present

## Monitoring and Alerting

### Health Metrics

Monitor backup system health through:

- Success rate percentage
- Last backup date
- Failed backup count
- Total storage usage
- Average backup duration

### Log Analysis

Backup logs provide detailed operation tracking:

- Backup start/completion times
- File-level backup status
- Error messages and stack traces
- Performance metrics

### Recommended Alerts

Set up monitoring for:

1. **Backup Failures:** Alert if backup fails 3 consecutive times
2. **Missing Backups:** Alert if no backup in 48 hours
3. **Verification Failures:** Alert on backup verification failures
4. **Storage Growth:** Alert on unusual storage growth patterns

## Disaster Recovery Procedures

### Complete Data Loss Recovery

1. **Identify Latest Valid Backup:**
   ```bash
   curl "https://your-worker.example.com/api/backup/list?status=completed&limit=1" \
     -H "Authorization: Bearer <token>"
   ```

2. **Verify Backup Integrity:**
   ```bash
   curl -X POST "https://your-worker.example.com/api/backup/verify/<backup_id>" \
     -H "Authorization: Bearer <token>"
   ```

3. **Restore All Files:**
   ```bash
   curl -X POST "https://your-worker.example.com/api/backup/restore/<backup_id>" \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "overwriteExisting": true,
       "verifyAfterRestore": true
     }'
   ```

### Partial Data Recovery

For selective restoration:

```bash
curl -X POST "https://your-worker.example.com/api/backup/restore/<backup_id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "overwriteExisting": false,
    "verifyAfterRestore": true,
    "filters": {
      "pathPrefix": "users/123/",
      "dateRange": {
        "start": "2024-01-01",
        "end": "2024-01-31"
      }
    }
  }'
```

## Performance Considerations

### Backup Performance

- Large files are backed up individually to prevent memory issues
- Progress is logged every 100 files
- Checksums are calculated using SHA-256
- Network operations include retry logic

### Storage Efficiency

- Incremental backups reduce storage requirements
- Duplicate file detection prevents redundant storage
- Compression can be enabled for additional space savings

### Scalability

- Backup operations are designed for large file collections
- Parallel processing for file operations where possible
- Database queries are optimized with appropriate indexes

## Security

### Access Control

- All backup operations require authentication
- JWT tokens validate user permissions
- API endpoints include authorization checks

### Data Protection

- Checksums ensure data integrity
- Optional encryption for sensitive data
- Secure backup bucket with restricted access

### Audit Trail

- Complete operation logging
- Backup creation and restoration tracking
- User action attribution

## Troubleshooting

### Common Issues

1. **Backup Fails to Start:**
   - Check R2 bucket permissions
   - Verify authentication tokens
   - Review backup configuration

2. **Verification Failures:**
   - Check network connectivity
   - Verify backup bucket integrity
   - Review checksum calculations

3. **Restoration Issues:**
   - Confirm target bucket permissions
   - Check available storage space
   - Verify backup completeness

### Debug Information

Access detailed logs through:

```bash
curl "https://your-worker.example.com/api/backup/logs/<backup_id>?level=error" \
  -H "Authorization: Bearer <token>"
```

### Performance Tuning

- Monitor backup duration trends
- Optimize during low-traffic periods
- Consider backup frequency adjustments
- Review retention policy settings

## Future Enhancements

Planned improvements include:

1. **Cross-Region Replication:** Multi-region backup storage
2. **Encryption at Rest:** Built-in backup encryption
3. **Compression:** Automatic backup compression
4. **Webhooks:** Real-time backup status notifications
5. **Advanced Filtering:** More sophisticated restoration filters
6. **Backup Templates:** Predefined backup configurations
7. **Performance Metrics:** Detailed backup performance analytics

## Support

For issues or questions regarding the backup system:

1. Check the troubleshooting section
2. Review backup logs for error details  
3. Monitor backup health metrics
4. Contact system administrators with specific error messages

---

*This documentation covers the comprehensive R2 backup system implementation for Cutty's disaster recovery needs.*
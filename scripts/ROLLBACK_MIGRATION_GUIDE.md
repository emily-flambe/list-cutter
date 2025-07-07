# File Migration Rollback Guide

## Overview

The `rollback_migration.py` script provides comprehensive rollback capabilities for Issue #66 file migration operations. This script can safely reverse migration operations while maintaining data integrity and providing detailed audit trails.

## Features

### Core Rollback Capabilities

1. **Database Rollback**: Reset migration columns to original state
2. **R2 Cleanup**: Delete migrated files from R2 storage
3. **Batch Rollback**: Rollback specific migration batches
4. **Selective Rollback**: Rollback only failed migrations
5. **Full Rollback**: Complete migration reversal

### Safety Features

- **Dry-run Mode**: Preview rollback actions without executing
- **Explicit Confirmation**: Required for destructive operations
- **Database Backup**: Create backup before rollback operations
- **Comprehensive Logging**: Detailed logging of all operations
- **File Verification**: Verify original files exist before R2 cleanup
- **Partial Rollback**: Support for testing and staged rollbacks
- **Audit Trail**: Complete audit log of all operations

### Technical Features

- **Progress Tracking**: Real-time progress for large operations
- **Error Handling**: Graceful error handling with detailed reporting
- **Multi-database Support**: Works with both PostgreSQL and D1 databases
- **R2 Integration**: Direct integration with Cloudflare R2 API
- **Rich Console Output**: Beautiful console output with tables and progress bars

## Installation

### Prerequisites

- Python 3.7 or higher
- Access to the migration database (PostgreSQL or D1)
- Cloudflare R2 API credentials
- Required Python packages (see requirements.txt)

### Install Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### Environment Variables

Set the following environment variables:

```bash
# Database Configuration
export USE_D1_DATABASE=false  # Set to true for D1, false for PostgreSQL
export POSTGRES_HOST=localhost
export POSTGRES_DB=list_cutter
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=your_password
export POSTGRES_PORT=5432

# D1 Database (if using D1)
export D1_LOCAL_PATH=.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite

# Cloudflare R2 Configuration
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
export R2_BUCKET_NAME=cutty-files-dev
```

## Usage

### Basic Commands

The script provides three main commands:

1. `rollback` - Execute rollback operations
2. `status` - Show migration status
3. `analyze` - Analyze rollback logs

### 1. Rollback Command

#### Syntax
```bash
python rollback_migration.py rollback [OPTIONS]
```

#### Options

| Option | Description |
|--------|-------------|
| `--batch-id ID` | Rollback specific batch ID |
| `--user-id ID` | Rollback migrations for specific user |
| `--failed-only` | Rollback only failed migrations |
| `--full-rollback` | Rollback all migrations |
| `--database-only` | Rollback database only (keep R2 files) |
| `--r2-only` | Delete R2 files only (keep database records) |
| `--dry-run` | Preview operations without executing (default) |
| `--confirm` | Execute actual rollback (overrides dry-run) |
| `--force` | Skip confirmation prompts |
| `--no-backup` | Skip creating backup before rollback |
| `--start-date DATE` | Start date for time range filter (YYYY-MM-DD) |
| `--end-date DATE` | End date for time range filter (YYYY-MM-DD) |

### 2. Status Command

#### Syntax
```bash
python rollback_migration.py status [OPTIONS]
```

#### Options

| Option | Description |
|--------|-------------|
| `--batch-id ID` | Show status for specific batch |
| `--user-id ID` | Show status for specific user |
| `--limit N` | Limit number of records shown (default: 50) |

### 3. Analyze Command

#### Syntax
```bash
python rollback_migration.py analyze [OPTIONS]
```

#### Options

| Option | Description |
|--------|-------------|
| `--log-file FILE` | Specific log file to analyze |
| `--days N` | Number of days to analyze (default: 7) |

## Examples

### Preview Operations (Dry Run)

```bash
# Preview rollback of a specific batch
python rollback_migration.py rollback --batch-id abc123-def456

# Preview rollback of failed migrations only
python rollback_migration.py rollback --failed-only

# Preview full rollback
python rollback_migration.py rollback --full-rollback
```

### Execute Rollback Operations

```bash
# Rollback a specific batch
python rollback_migration.py rollback --batch-id abc123-def456 --confirm

# Rollback failed migrations only
python rollback_migration.py rollback --failed-only --confirm

# Rollback migrations for a specific user
python rollback_migration.py rollback --user-id user123 --confirm

# Full rollback (all migrations)
python rollback_migration.py rollback --full-rollback --confirm --force
```

### Database-Only Operations

```bash
# Rollback database records only (keep R2 files)
python rollback_migration.py rollback --batch-id abc123 --database-only --confirm

# Delete R2 files only (keep database records)
python rollback_migration.py rollback --batch-id abc123 --r2-only --confirm
```

### Time Range Operations

```bash
# Rollback migrations from specific date range
python rollback_migration.py rollback --full-rollback --start-date 2024-01-01 --end-date 2024-01-31 --confirm
```

### Status and Analysis

```bash
# Show migration status
python rollback_migration.py status

# Show status for specific batch
python rollback_migration.py status --batch-id abc123

# Show status for specific user
python rollback_migration.py status --user-id user123

# Analyze recent rollback logs
python rollback_migration.py analyze

# Analyze specific log file
python rollback_migration.py analyze --log-file rollback_20240101_120000.log
```

## Rollback Scenarios

### Scenario 1: Failed Migration Batch

When a migration batch has failed files:

```bash
# 1. Check status
python rollback_migration.py status --batch-id abc123

# 2. Preview rollback of failed files only
python rollback_migration.py rollback --batch-id abc123 --failed-only

# 3. Execute rollback
python rollback_migration.py rollback --batch-id abc123 --failed-only --confirm
```

### Scenario 2: Complete Batch Rollback

When you need to rollback an entire batch:

```bash
# 1. Preview the rollback
python rollback_migration.py rollback --batch-id abc123

# 2. Execute rollback with confirmation
python rollback_migration.py rollback --batch-id abc123 --confirm
```

### Scenario 3: Emergency Full Rollback

When you need to rollback all migrations:

```bash
# 1. Create manual backup first (optional)
python rollback_migration.py rollback --full-rollback --dry-run

# 2. Execute full rollback
python rollback_migration.py rollback --full-rollback --confirm
```

### Scenario 4: Partial Rollback for Testing

When testing rollback procedures:

```bash
# 1. Rollback a small batch first
python rollback_migration.py rollback --batch-id test-batch --confirm

# 2. Verify results
python rollback_migration.py status --batch-id test-batch

# 3. Analyze logs
python rollback_migration.py analyze --days 1
```

## Output and Logging

### Console Output

The script provides rich console output including:

- **Progress bars** for long operations
- **Tables** showing migration status and results
- **Color-coded status** (green for success, red for errors, yellow for warnings)
- **Summary statistics** at completion

### Log Files

All operations are logged to files in the `logs/` directory:

- `rollback_YYYYMMDD_HHMMSS.log` - Detailed operation logs
- `rollback_audit_YYYYMMDD_HHMMSS.json` - Audit trail in JSON format

### Backup Files

Database backups are created in the `backups/` directory:

- `migration_backup_YYYYMMDD_HHMMSS.json` - Database state before rollback

## Database Operations

### PostgreSQL Tables Affected

- `file_migrations` - Migration tracking records
- `migration_batches` - Batch information
- `files` - File records (r2_key and checksum fields)

### D1 Tables Affected

- `file_migrations` - Migration tracking records
- `migration_batches` - Batch information
- `files` - File records (r2_key and checksum fields)

### Rollback Operations

1. **Migration Status Update**: Sets migration status to 'rolled_back'
2. **File Record Reset**: Clears r2_key and checksum fields
3. **Batch Status Update**: Updates batch completion status
4. **Timestamp Update**: Updates completed_at timestamps

## R2 Operations

### File Deletion

- Verifies file exists before deletion
- Uses Cloudflare R2 API for deletion
- Logs deletion success/failure
- Tracks bytes freed

### API Calls

- `DELETE /objects/{key}` - Delete specific file
- `HEAD /objects/{key}` - Check file existence
- `GET /objects` - List files (for verification)

## Error Handling

### Common Errors

1. **Database Connection Errors**
   - Check database configuration
   - Verify credentials
   - Ensure database is accessible

2. **R2 API Errors**
   - Check Cloudflare credentials
   - Verify API token permissions
   - Check bucket name

3. **File Not Found Errors**
   - File may have been deleted manually
   - Check R2 bucket contents
   - Verify file keys in database

### Recovery Procedures

1. **Database Errors**: Check logs for specific error messages
2. **R2 Errors**: Verify API credentials and permissions
3. **Partial Failures**: Review audit logs and retry failed operations

## Security Considerations

### API Credentials

- Store credentials as environment variables
- Use API tokens with minimal required permissions
- Regularly rotate API tokens

### Database Access

- Use read-only connections when possible
- Implement proper connection pooling
- Log all database operations

### File Operations

- Verify file ownership before deletion
- Check file sizes before operations
- Maintain audit trail of all operations

## Monitoring and Alerts

### Key Metrics

- **Success Rate**: Percentage of successful operations
- **Failure Rate**: Percentage of failed operations
- **Processing Time**: Time taken for operations
- **Data Volume**: Amount of data processed

### Alerting

Monitor for:
- High failure rates (>5%)
- Long processing times (>30 minutes)
- Database connection failures
- R2 API errors

## Troubleshooting

### Common Issues

1. **"No migration records found"**
   - Check batch ID spelling
   - Verify migration records exist
   - Check time range filters

2. **"Database connection failed"**
   - Verify database credentials
   - Check network connectivity
   - Ensure database is running

3. **"R2 API authentication failed"**
   - Check API token
   - Verify account ID
   - Check token permissions

4. **"File not found in R2"**
   - File may have been deleted
   - Check bucket name
   - Verify file key format

### Debug Mode

Enable debug logging by setting:
```bash
export LOG_LEVEL=DEBUG
```

### Log Analysis

Check log files for:
- Detailed error messages
- API response codes
- Database query results
- File operation status

## Best Practices

### Before Rollback

1. **Backup**: Always create backups before rollback
2. **Test**: Use dry-run mode first
3. **Verify**: Check migration status
4. **Plan**: Understand the impact of rollback

### During Rollback

1. **Monitor**: Watch progress and logs
2. **Verify**: Check intermediate results
3. **Document**: Record any issues
4. **Communicate**: Keep stakeholders informed

### After Rollback

1. **Verify**: Confirm rollback completed successfully
2. **Test**: Verify system functionality
3. **Document**: Record lessons learned
4. **Clean Up**: Remove temporary files

## Performance Optimization

### Large Datasets

- Use batch processing for large migrations
- Implement connection pooling
- Process files in chunks
- Monitor memory usage

### Network Optimization

- Use connection keep-alive
- Implement retry logic
- Handle rate limiting
- Monitor API quotas

## Integration with Existing Systems

### CI/CD Integration

The script can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Rollback Migration
  run: |
    python rollback_migration.py rollback --batch-id ${{ github.event.inputs.batch_id }} --confirm
```

### Monitoring Integration

Export metrics to monitoring systems:

```bash
# Example: Export success rate to monitoring
python rollback_migration.py analyze --days 1 | grep "Success Rate"
```

## Support and Maintenance

### Regular Maintenance

1. **Log Rotation**: Rotate log files regularly
2. **Backup Cleanup**: Remove old backup files
3. **Database Cleanup**: Clean up old migration records
4. **API Token Rotation**: Regularly rotate API tokens

### Updates and Patches

1. **Dependency Updates**: Keep dependencies current
2. **Security Patches**: Apply security updates
3. **Feature Updates**: Add new features as needed
4. **Bug Fixes**: Fix reported issues

## Contributing

### Code Standards

- Follow PEP 8 for Python code
- Use type hints where appropriate
- Write comprehensive docstrings
- Include unit tests for new features

### Testing

- Test all rollback scenarios
- Verify error handling
- Test with both PostgreSQL and D1
- Validate R2 operations

### Documentation

- Update this guide for new features
- Include examples for new functionality
- Document any breaking changes
- Maintain changelog

---

## Appendix

### Configuration Reference

Complete list of environment variables:

```bash
# Database
USE_D1_DATABASE=false
POSTGRES_HOST=localhost
POSTGRES_DB=list_cutter
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_PORT=5432
D1_LOCAL_PATH=.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
R2_BUCKET_NAME=cutty-files-dev

# Logging
LOG_LEVEL=INFO
```

### API Reference

#### Database Schema

```sql
-- Migration batches table
CREATE TABLE migration_batches (
    id TEXT PRIMARY KEY,
    batch_id TEXT UNIQUE NOT NULL,
    total_files INTEGER NOT NULL DEFAULT 0,
    completed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    verified_files INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- File migrations table
CREATE TABLE file_migrations (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    file_id TEXT,
    source_path TEXT,
    target_r2_key TEXT,
    original_checksum TEXT,
    migrated_checksum TEXT,
    file_size INTEGER,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Files table
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    user_id TEXT NOT NULL,
    r2_key TEXT,
    checksum TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Exit Codes

- `0` - Success
- `1` - General error
- `2` - Configuration error
- `3` - Database error
- `4` - R2 API error
- `5` - File operation error

---

*This guide covers the complete functionality of the rollback_migration.py script. For additional help or support, please refer to the logs or contact the development team.*
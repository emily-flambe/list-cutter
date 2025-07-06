# File Migration Tools - Issue #66

This directory contains comprehensive file migration tools for migrating files from Django filesystem storage to Cloudflare R2 storage, including migration and rollback capabilities.

## Overview

The migration toolkit includes:

1. **`migrate_to_r2.py`** - Main migration script for moving files from filesystem to R2
2. **`rollback_migration.py`** - Comprehensive rollback script for reversing migrations
3. **Production deployment scripts** - Scripts for deployment, validation, and cutover

The migration script provides a robust solution for migrating files from local filesystem storage to Cloudflare R2 with comprehensive error handling, progress tracking, and rollback capabilities.

## Migration Features

### Migration Script (`migrate_to_r2.py`)
- **Batch Processing**: Process files in configurable batches (default 50 files)
- **Real-time Progress Tracking**: Monitor migration progress with detailed reporting
- **Automatic Retry Logic**: Retry failed migrations up to 3 times with exponential backoff
- **Checksum Verification**: Verify file integrity using SHA-256 checksums
- **Resumable Migrations**: Resume interrupted migrations from where they left off
- **Dry-run Mode**: Test migrations without actually moving files
- **Comprehensive Logging**: Detailed logging to both file and console
- **Database Integration**: Updates PostgreSQL database with migration status and R2 keys

### Rollback Script (`rollback_migration.py`)
- **Multiple Rollback Types**: Database-only, R2-only, batch, selective, and full rollbacks
- **Safety Features**: Dry-run mode, explicit confirmations, and database backups
- **Comprehensive Verification**: Verify original files exist before R2 cleanup
- **Audit Trail**: Complete audit logs of all rollback operations
- **Progress Tracking**: Real-time progress for large rollback operations
- **Error Recovery**: Graceful error handling with detailed reporting
- **Multi-database Support**: Works with both PostgreSQL and D1 databases
- **Rich Console Output**: Beautiful console output with tables and progress bars

## Requirements

### Python Dependencies

The script requires the following Python packages (added to `pyproject.toml`):

```toml
"click (>=8.0.0,<9.0.0)",
"tqdm (>=4.65.0,<5.0.0)",
"aiohttp (>=3.8.0,<4.0.0)",
"asyncpg (>=0.28.0,<1.0.0)"
```

### Infrastructure Requirements

1. **PostgreSQL Database**: Must be accessible with credentials from Django settings
2. **Cloudflare Workers API**: Must be deployed and accessible
3. **File System Access**: Access to Django media files directory
4. **Django Environment**: Django settings must be properly configured

## Installation

1. Install dependencies:
```bash
cd app
pip install -e .
```

2. Ensure Django settings are configured properly in `DJANGO_SETTINGS_MODULE`

3. Verify database connectivity and Workers API accessibility

## Usage

### Basic Migration

```bash
python scripts/migrate_to_r2.py
```

### Dry Run (Recommended First)

```bash
python scripts/migrate_to_r2.py --dry-run
```

### Custom Batch Size

```bash
python scripts/migrate_to_r2.py --batch-size 25
```

### Verbose Output

```bash
python scripts/migrate_to_r2.py --verbose
```

### Resume Failed Migration

```bash
python scripts/migrate_to_r2.py --resume-batch <batch_id>
```

### Rollback Migration

```bash
python scripts/migrate_to_r2.py --rollback-batch <batch_id>
```

### List Migration Batches

```bash
python scripts/migrate_to_r2.py --list-batches
```

### Check Batch Status

```bash
python scripts/migrate_to_r2.py --batch-status <batch_id>
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Perform analysis without actual migration | False |
| `--batch-size` | Number of files per batch | 50 |
| `--max-retries` | Maximum retry attempts for failed files | 3 |
| `--api-url` | Cloudflare Workers API URL | `https://your-workers-domain.com` |
| `--resume-batch` | Resume specific batch by ID | None |
| `--rollback-batch` | Rollback specific batch by ID | None |
| `--list-batches` | List all migration batches | False |
| `--batch-status` | Show status of specific batch | None |
| `--verbose` | Enable verbose logging | False |

## Database Schema Changes

The script automatically adds the following columns to the `SavedFile` table:

- `r2_key TEXT` - R2 storage key for migrated files
- `migrated_at TIMESTAMP` - Timestamp of successful migration
- `migration_status TEXT` - Current migration status (pending, processing, completed, failed)
- `migration_batch_id TEXT` - ID of the migration batch
- `checksum TEXT` - SHA-256 checksum of the file

Additional tracking tables are created:

- `file_migration_batches` - Tracks migration batches
- `file_migration_records` - Tracks individual file migrations

## API Integration

The script communicates with Cloudflare Workers via these endpoints:

- `POST /api/migration/batch` - Create migration batch
- `POST /api/migration/process` - Process migration batch
- `GET /api/migration/progress/{batchId}` - Get batch progress
- `POST /api/migration/rollback` - Rollback migration batch

## Error Handling

The script includes comprehensive error handling:

1. **Database Errors**: Connection failures, query errors, schema issues
2. **File System Errors**: Missing files, permission issues, disk space
3. **API Errors**: Network failures, timeout, server errors
4. **Validation Errors**: Checksum mismatches, corrupted files
5. **Retry Logic**: Exponential backoff for transient failures

## Logging

Logs are written to both console and `migration.log` file:

- **INFO**: General progress and status updates
- **WARNING**: Recoverable issues (missing files, retry attempts)
- **ERROR**: Critical failures requiring attention
- **DEBUG**: Detailed technical information (with --verbose)

## Monitoring

### Progress Tracking

The script provides real-time progress updates:

```
Migration Progress:
- Total Files: 150
- Successful: 147
- Failed: 3
- Batch Status: partial
```

### Batch Status

Check detailed batch status:

```
Batch Status: 12345678-1234-1234-1234-123456789012
Status: completed
Total Files: 50
Started: 2024-01-15 10:30:00
Completed: 2024-01-15 10:35:00

File Status Breakdown:
  verified: 48
  failed: 2
```

## Rollback Procedures

The toolkit includes a comprehensive rollback script (`rollback_migration.py`) for reversing migration operations safely.

### Quick Rollback Examples

1. **Check migration status**:
   ```bash
   python scripts/rollback_migration.py status
   ```

2. **Preview rollback of a specific batch** (dry-run):
   ```bash
   python scripts/rollback_migration.py rollback --batch-id abc123
   ```

3. **Execute rollback of failed migrations**:
   ```bash
   python scripts/rollback_migration.py rollback --failed-only --confirm
   ```

4. **Full migration rollback**:
   ```bash
   python scripts/rollback_migration.py rollback --full-rollback --confirm
   ```

### Rollback Script Installation

1. Install rollback script dependencies:
   ```bash
   cd scripts
   pip install -r requirements.txt
   ```

2. Set environment variables:
   ```bash
   export CLOUDFLARE_ACCOUNT_ID=your_account_id
   export CLOUDFLARE_API_TOKEN=your_api_token
   export R2_BUCKET_NAME=list-cutter-files
   ```

3. Run rollback operations (see `ROLLBACK_MIGRATION_GUIDE.md` for complete documentation)

### Legacy Rollback (migrate_to_r2.py)

If using the legacy migration script rollback:

1. **Stop any running migrations**
2. **Identify the batch ID** to rollback
3. **Run rollback command**:
   ```bash
   python scripts/migrate_to_r2.py --rollback-batch <batch_id>
   ```
4. **Verify rollback** by checking file status in database

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL credentials in Django settings
   - Verify database is running and accessible
   - Check firewall settings

2. **API Communication Failed**
   - Verify Workers API URL is correct
   - Check API is deployed and responding
   - Verify network connectivity

3. **File Not Found**
   - Check file paths in database are correct
   - Verify file system permissions
   - Check if files were moved or deleted

4. **Checksum Mismatch**
   - May indicate file corruption
   - Check disk integrity
   - Verify file wasn't modified during migration

### Debug Mode

For detailed troubleshooting, run with verbose logging:

```bash
python scripts/migrate_to_r2.py --verbose --dry-run
```

## Performance Considerations

- **Batch Size**: Larger batches are more efficient but use more memory
- **Concurrent Uploads**: Limited by R2 and database connection limits
- **Network Bandwidth**: Large files may require longer timeouts
- **Database Connections**: Script uses connection pooling for efficiency

## Security Considerations

- **File Access**: Ensure proper file system permissions
- **Database Security**: Use strong credentials and SSL connections
- **API Security**: Secure Workers API with appropriate authentication
- **Logging**: Avoid logging sensitive information like file contents

## Support

For issues or questions about the migration script:

1. Check the migration logs for detailed error messages
2. Review this README for common solutions
3. Use dry-run mode to test before actual migration
4. Monitor database and API logs for additional context

## Development Notes

### Code Structure

- `DatabaseManager`: Handles PostgreSQL operations
- `FileMigrationClient`: Manages API communication
- `FileProcessor`: Handles file operations and checksums
- `MigrationOrchestrator`: Main coordination logic

### Testing

Before running in production:

1. Test with small batch sizes
2. Run dry-run analysis
3. Verify database backup procedures
4. Test rollback functionality
5. Monitor resource usage

### Future Enhancements

- Support for different storage backends
- Parallel processing for large deployments
- Web UI for monitoring and management
- Automated scheduling and monitoring
- Integration with backup systems

## Migration Validation Tools

This directory also contains comprehensive validation tools for verifying file migration integrity:

### Validation Script (`validate_migration.py`)

A production-ready Python script that validates:
- File integrity using SHA-256 checksums
- Database consistency between PostgreSQL and D1
- R2 storage accessibility
- Workers API functionality
- Metadata preservation
- User association integrity
- Batch completeness

### Shell Wrapper (`validate_migration.sh`)

A convenient shell wrapper that provides:
- Environment setup and dependency management
- Configuration file management
- Easy command-line interface
- Progress monitoring
- Error handling and reporting

### Usage Examples

```bash
# Setup validation environment
./validate_migration.sh --setup-environment

# Validate specific batch
./validate_migration.sh --batch-id batch-123 --verbose

# Full migration validation with human-readable output
./validate_migration.sh --full-validation --output-format human

# Generate CSV report
./validate_migration.sh --full-validation --output-format csv --output-file results.csv
```

### Configuration

Copy `validation_config.example.json` to `validation_config.json` and configure:
- PostgreSQL connection details
- Cloudflare D1 API credentials
- R2 storage API credentials
- Workers API endpoints
- Django media root path

For complete validation documentation, see `VALIDATION_README.md`.

### Test Suite

Run validation tests:
```bash
python3 test_validation.py
```

The validation tools complement the migration script by providing comprehensive verification that all files were successfully migrated with full integrity preservation.
# File Migration Validation Tools

This directory contains comprehensive validation tools for verifying file migration integrity between Django filesystem storage and Cloudflare R2 storage with D1 database tracking.

## Overview

The validation system provides:

- **File Integrity Validation**: SHA-256 checksum verification between original and migrated files
- **Database Consistency Checks**: Verification of record updates in both PostgreSQL (Django) and D1 (Workers)
- **Storage Accessibility Testing**: Verification of file access through R2 endpoints and Workers API
- **Metadata Preservation Verification**: Ensuring all file metadata is correctly preserved
- **User Association Validation**: Verifying user ownership is maintained during migration
- **Batch Completeness Verification**: Ensuring all files in batches were successfully migrated

## Files

### Core Scripts

- `validate_migration.py` - Main Python validation script with comprehensive checks
- `validate_migration.sh` - Shell wrapper for easier execution and environment management
- `requirements.txt` - Python dependencies for the validation script
- `validation_config.example.json` - Example configuration file template

### Documentation

- `VALIDATION_README.md` - This file, comprehensive documentation

## Quick Start

1. **Setup Environment**:
   ```bash
   ./validate_migration.sh --setup-environment
   ```

2. **Configure Settings**:
   ```bash
   cp validation_config.example.json validation_config.json
   # Edit validation_config.json with your actual settings
   ```

3. **Run Validation**:
   ```bash
   # Validate specific batch
   ./validate_migration.sh --batch-id batch-123 --verbose
   
   # Validate full migration
   ./validate_migration.sh --full-validation --output-format human
   ```

## Configuration

### Configuration File

Create `validation_config.json` from the example template:

```json
{
  "postgres_dsn": "postgresql://user:password@localhost:5432/list_cutter",
  "d1_api_endpoint": "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/d1/database/YOUR_DATABASE_ID/query",
  "d1_api_token": "your-d1-api-token",
  "r2_api_endpoint": "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/r2/buckets/YOUR_BUCKET_NAME",
  "r2_api_token": "your-r2-api-token",
  "workers_api_endpoint": "https://your-worker.your-subdomain.workers.dev",
  "workers_api_token": "your-workers-api-token",
  "django_media_root": "/path/to/django/media/root",
  "batch_size": 100,
  "max_workers": 10,
  "timeout": 30,
  "output_format": "json",
  "detailed_logging": true
}
```

### Required Configuration Fields

- `postgres_dsn`: PostgreSQL connection string for Django database
- `d1_api_endpoint`: Cloudflare D1 API endpoint for Workers database
- `d1_api_token`: Authentication token for D1 API
- `r2_api_endpoint`: Cloudflare R2 API endpoint for storage
- `r2_api_token`: Authentication token for R2 API
- `workers_api_endpoint`: Your Workers API endpoint
- `workers_api_token`: Authentication token for Workers API
- `django_media_root`: Path to Django media files on filesystem

## Usage

### Shell Wrapper (Recommended)

The shell wrapper provides convenient access to the validation functionality:

```bash
# Check environment setup
./validate_migration.sh --check-environment

# Setup Python environment and dependencies
./validate_migration.sh --setup-environment

# Validate specific batch
./validate_migration.sh --batch-id batch-123 --verbose

# Full validation with human-readable output
./validate_migration.sh --full-validation --output-format human --verbose

# Save results to file
./validate_migration.sh --full-validation --output-file results.json --output-format json
```

### Direct Python Script

You can also run the Python script directly:

```bash
python3 validate_migration.py \
  --postgres-dsn "postgresql://user:pass@localhost:5432/db" \
  --d1-api-endpoint "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/d1/database/YOUR_DATABASE_ID/query" \
  --d1-api-token "your-token" \
  --r2-api-endpoint "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/r2/buckets/YOUR_BUCKET_NAME" \
  --r2-api-token "your-token" \
  --workers-api-endpoint "https://your-worker.your-subdomain.workers.dev" \
  --workers-api-token "your-token" \
  --django-media-root "/path/to/media" \
  --batch-id batch-123 \
  --output-format human \
  --verbose
```

## Command Line Options

### Shell Wrapper Options

- `--batch-id BATCH_ID`: Validate specific batch ID
- `--full-validation`: Validate complete migration
- `--config CONFIG_FILE`: Configuration file path (default: validation_config.json)
- `--output-format FORMAT`: Output format: json, csv, human (default: json)
- `--output-file FILE`: Output file path
- `--max-workers N`: Maximum concurrent workers (default: 10)
- `--batch-size N`: Batch size for processing (default: 100)
- `--timeout N`: Request timeout in seconds (default: 30)
- `--verbose`: Enable verbose logging
- `--check-environment`: Check environment setup and dependencies
- `--setup-environment`: Setup Python virtual environment and dependencies
- `--help`: Show help message

### Python Script Options

- `--batch-id`: Validate specific batch ID
- `--postgres-dsn`: PostgreSQL connection string (required)
- `--d1-api-endpoint`: D1 API endpoint (required)
- `--d1-api-token`: D1 API token (required)
- `--r2-api-endpoint`: R2 API endpoint (required)
- `--r2-api-token`: R2 API token (required)
- `--workers-api-endpoint`: Workers API endpoint (required)
- `--workers-api-token`: Workers API token (required)
- `--django-media-root`: Django media root directory (required)
- `--output-format`: Output format (json, csv, human)
- `--output-file`: Output file path
- `--max-workers`: Maximum concurrent workers
- `--batch-size`: Batch size for processing
- `--timeout`: Request timeout in seconds
- `--verbose`: Enable verbose logging

## Validation Checks

### File Integrity Validation

- **Checksum Verification**: Compares SHA-256 checksums between original Django files and R2 storage
- **File Size Validation**: Ensures file sizes match between source and destination
- **Content Verification**: Downloads file chunks from R2 to verify content integrity

### Database Consistency Checks

- **Record Existence**: Verifies file records exist in both PostgreSQL and D1 databases
- **Metadata Consistency**: Compares file metadata between database systems
- **User Association**: Ensures user ownership is properly maintained
- **Migration Status**: Verifies migration tracking records are accurate

### Storage Accessibility Testing

- **R2 Storage Access**: Tests file accessibility through Cloudflare R2 API
- **Workers API Access**: Verifies files can be accessed through Workers API endpoints
- **Permission Verification**: Ensures proper access permissions are maintained

### Batch Completeness Verification

- **File Count Validation**: Verifies all files in a batch were processed
- **Status Verification**: Checks migration status for all files in batch
- **Error Tracking**: Identifies and reports any failed migrations

## Output Formats

### JSON Format

Structured JSON output with detailed validation results:

```json
{
  "validation_id": "validation-1234567890",
  "start_time": "2024-01-01T00:00:00Z",
  "end_time": "2024-01-01T00:05:00Z",
  "total_files": 100,
  "successful_files": 95,
  "failed_files": 2,
  "warning_files": 3,
  "success_rate": 95.0,
  "batches": [...],
  "remediation_suggestions": [...]
}
```

### CSV Format

Comma-separated values for spreadsheet analysis:

```csv
file_id,file_name,user_id,status,postgres_exists,d1_exists,r2_accessible,workers_accessible,checksum_match,errors,warnings
file-123,document.csv,user-456,success,true,true,true,true,true,"",""
file-789,data.csv,user-101,failed,true,false,false,false,false,"D1 record missing","File not in R2"
```

### Human-Readable Format

Easy-to-read summary report:

```
======================================================================
FILE MIGRATION VALIDATION REPORT
======================================================================
Validation ID: validation-1234567890
Generated: 2024-01-01 00:00:00 UTC
Duration: 300.00 seconds

SUMMARY
------------------------------
Total Files: 100
Successful: 95
Failed: 2
Warnings: 3
Success Rate: 95.0%

BATCH DETAILS
------------------------------
Batch: batch-123
  Total Files: 50
  Successful: 48
  Failed: 1
  Warnings: 1
  Duration: 150.00s

REMEDIATION SUGGESTIONS
------------------------------
• Found 2 files with integrity issues. Consider re-migrating these files with full checksum verification.
• Found 1 files missing from D1 database. Update D1 records to match PostgreSQL data.
```

## Error Handling and Remediation

### Common Issues and Solutions

1. **File Not Found in R2**:
   - **Issue**: Original file migrated but not accessible in R2
   - **Solution**: Re-run migration for affected files
   - **Command**: Check R2 bucket permissions and file paths

2. **Checksum Mismatch**:
   - **Issue**: File integrity compromised during migration
   - **Solution**: Re-migrate affected files with verification
   - **Command**: Use full checksum verification mode

3. **Database Inconsistency**:
   - **Issue**: Records missing or inconsistent between PostgreSQL and D1
   - **Solution**: Synchronize database records
   - **Command**: Update D1 records to match PostgreSQL data

4. **Permission Issues**:
   - **Issue**: Files not accessible through Workers API
   - **Solution**: Verify and update access permissions
   - **Command**: Check Workers API authentication and R2 bucket policies

### Exit Codes

- `0`: Validation completed successfully (no errors)
- `1`: Validation failed (errors found)
- `2`: Validation completed with warnings

## Performance Considerations

### Optimization Settings

- **max_workers**: Adjust based on system resources and API rate limits
- **batch_size**: Balance between memory usage and processing efficiency
- **timeout**: Set appropriate timeouts for network operations

### Monitoring and Logging

- Use `--verbose` flag for detailed logging during validation
- Monitor system resources during large validation runs
- Consider running validation in chunks for very large migrations

## Security Considerations

### Sensitive Data Protection

- Store API tokens securely (environment variables or secure config files)
- Use minimum required permissions for API access
- Regularly rotate API tokens and credentials

### Network Security

- Use HTTPS for all API communications
- Implement proper timeout and retry mechanisms
- Monitor for unusual network activity during validation

## Integration with CI/CD

### Automated Validation

```yaml
# Example GitHub Actions workflow
name: Migration Validation
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          cd scripts
          pip install -r requirements.txt
      - name: Run validation
        run: |
          cd scripts
          python3 validate_migration.py \
            --postgres-dsn "${{ secrets.POSTGRES_DSN }}" \
            --d1-api-endpoint "${{ secrets.D1_API_ENDPOINT }}" \
            --d1-api-token "${{ secrets.D1_API_TOKEN }}" \
            --r2-api-endpoint "${{ secrets.R2_API_ENDPOINT }}" \
            --r2-api-token "${{ secrets.R2_API_TOKEN }}" \
            --workers-api-endpoint "${{ secrets.WORKERS_API_ENDPOINT }}" \
            --workers-api-token "${{ secrets.WORKERS_API_TOKEN }}" \
            --django-media-root "${{ secrets.DJANGO_MEDIA_ROOT }}" \
            --output-format json \
            --output-file validation_results.json
```

## Troubleshooting

### Common Problems

1. **Import Errors**:
   - Ensure all dependencies are installed: `pip install -r requirements.txt`
   - Check Python version compatibility (3.7+)

2. **Database Connection Issues**:
   - Verify PostgreSQL connection string format
   - Check network connectivity to database server
   - Ensure database user has required permissions

3. **API Authentication Failures**:
   - Verify API tokens are valid and not expired
   - Check API endpoint URLs for correctness
   - Ensure required permissions are granted

4. **File Access Issues**:
   - Verify Django media root path is correct
   - Check file system permissions
   - Ensure files exist at specified paths

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```bash
./validate_migration.sh --full-validation --verbose --output-format human
```

## Contributing

When contributing to the validation tools:

1. Follow existing code style and patterns
2. Add comprehensive error handling
3. Include unit tests for new functionality
4. Update documentation for new features
5. Test with various migration scenarios

## License

This validation toolset is part of the List Cutter project and follows the same licensing terms.

## Support

For issues or questions regarding the validation tools:

1. Check this documentation first
2. Review error messages and logs
3. Test with a small subset of files first
4. Report issues with detailed logs and configuration details

---

*Last updated: 2024-01-01*
*Version: 1.0.0*
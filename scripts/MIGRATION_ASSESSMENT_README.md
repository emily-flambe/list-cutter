# File Migration Assessment Tool

Comprehensive Python script for assessing Django file storage migration readiness to Cloudflare R2.

## Overview

The `assess_file_migration.py` script performs a thorough analysis of your Django media files and PostgreSQL database to provide detailed migration planning information, cost estimates, and recommendations for migrating to Cloudflare R2 storage.

## Features

- **Filesystem Analysis**: Scans `app/media/uploads/` and `app/media/generated/` directories
- **Database Correlation**: Analyzes PostgreSQL `list_cutter_savedfile` table
- **Cost Estimation**: Calculates R2 storage costs based on Cloudflare pricing
- **Migration Planning**: Creates optimized migration batches
- **Issue Detection**: Identifies missing files, corrupted data, and inconsistencies
- **Multiple Output Formats**: Text and JSON reporting
- **Batch Strategies**: Size, date, user, or random-based batching
- **Progress Tracking**: Real-time progress bars with tqdm
- **Dry Run Mode**: Filesystem-only analysis without database connection

## Requirements

### Python Dependencies
- `click` (>=8.0.0) - Command-line interface
- `tqdm` (>=4.65.0) - Progress bars
- `psycopg2-binary` (>=2.9.10) - PostgreSQL connectivity
- `pandas` (>=2.2.3) - Data analysis

### Environment Setup
```bash
# Install dependencies
pip install click tqdm psycopg2-binary pandas

# Or if using poetry (recommended)
poetry install
```

### Database Access
- PostgreSQL database connection
- Read access to `list_cutter_savedfile` table
- Database credentials (via environment variables or command line)

## Usage

### Basic Assessment
```bash
python scripts/assess_file_migration.py
```

### With Database Credentials
```bash
export DB_PASSWORD=your_password
python scripts/assess_file_migration.py \
    --db-host localhost \
    --db-port 5432 \
    --db-name list_cutter \
    --db-user list_cutter
```

### Advanced Options
```bash
python scripts/assess_file_migration.py \
    --media-root app/media \
    --batch-size 500 \
    --batch-strategy date \
    --output-format both \
    --output-file migration_report.json \
    --detailed \
    --calculate-checksums
```

### Dry Run (Filesystem Only)
```bash
python scripts/assess_file_migration.py --dry-run --detailed
```

## Command Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--media-root` | `app/media` | Path to Django media root directory |
| `--db-host` | `localhost` | PostgreSQL host |
| `--db-port` | `5432` | PostgreSQL port |
| `--db-name` | `list_cutter` | PostgreSQL database name |
| `--db-user` | `list_cutter` | PostgreSQL username |
| `--db-password` | `$DB_PASSWORD` | PostgreSQL password (from env var) |
| `--batch-size` | `1000` | Migration batch size |
| `--batch-strategy` | `size` | Batch creation strategy (size/date/user/random) |
| `--output-format` | `text` | Output format (text/json/both) |
| `--output-file` | auto | Output file path (for JSON) |
| `--detailed` | false | Show detailed report |
| `--dry-run` | false | Perform dry run without database connection |
| `--calculate-checksums` | false | Calculate file checksums (slow) |
| `--log-level` | `INFO` | Logging level (DEBUG/INFO/WARNING/ERROR) |

## Output

### Text Report
```
============================================================
FILE MIGRATION ASSESSMENT REPORT
============================================================
Generated: 2024-01-15 10:30:00

SUMMARY
--------------------
Total files in filesystem: 15,432
Existing files: 15,201
Total size: 45.2 GB
Database records: 14,987

ISSUES FOUND
--------------------
⚠️  231 files referenced in database but missing from filesystem
⚠️  445 files in filesystem but not in database
⚠️  12 files are larger than 1GB

MIGRATION ESTIMATES
--------------------
Estimated migration time: 2.3 hours
Estimated monthly R2 cost: $0.68
Number of batches: 16

RECOMMENDATIONS
--------------------
1. Clean up database records for missing files before migration
2. Decide whether to migrate orphaned files or remove them
3. Test migration with a small subset first
4. Monitor R2 costs and performance after migration
```

### JSON Report
```json
{
  "timestamp": "2024-01-15T10:30:00",
  "total_files": 15432,
  "total_size": 48654312960,
  "existing_files": 15201,
  "missing_files": 231,
  "corrupted_files": 0,
  "database_records": 14987,
  "estimated_migration_time": 2.3,
  "estimated_r2_cost": 0.68,
  "batches": [
    {
      "batch_id": 1,
      "file_count": 1000,
      "total_size": 3221225472,
      "estimated_time": 0.15,
      "estimated_cost": 0.00036
    }
  ],
  "file_type_distribution": {
    ".csv": 8932,
    ".pdf": 3421,
    ".jpg": 2876,
    ".png": 203
  },
  "issues": [],
  "recommendations": []
}
```

## Analysis Features

### File System Analysis
- Scans both `uploads/` and `generated/` directories
- Calculates file sizes and modification times
- Detects missing, corrupted, or unreadable files
- Identifies file types and size distributions
- Optional checksum calculation for integrity verification

### Database Analysis
- Queries `list_cutter_savedfile` table
- Analyzes file metadata and relationships
- Identifies orphaned records (files in DB but not on filesystem)
- Calculates user-based file distributions
- Tracks upload patterns and timestamps

### Cost Calculation
- **Storage Costs**: Based on Cloudflare R2 pricing ($0.015/GB/month)
- **Transfer Costs**: PUT operations for initial migration
- **Ongoing Costs**: Monthly storage estimates
- **Bandwidth Savings**: Estimated CDN cost reductions

### Migration Planning
- **Batch Creation**: Optimized batching based on configurable strategies
- **Size-based**: Largest files first for early problem detection
- **Date-based**: Chronological migration for auditability
- **User-based**: Migrate by user for testing and rollback
- **Random**: Random distribution for load balancing

## Batch Strategies

### Size Strategy (`--batch-strategy size`)
- Sorts files by size (largest first)
- Useful for identifying large file issues early
- Helps with storage capacity planning

### Date Strategy (`--batch-strategy date`)
- Migrates files chronologically by upload date
- Maintains historical migration order
- Good for audit trails and rollback scenarios

### User Strategy (`--batch-strategy user`)
- Groups files by user ID
- Enables user-by-user migration testing
- Supports selective rollback if needed

### Random Strategy (`--batch-strategy random`)
- Randomly distributes files across batches
- Provides balanced load distribution
- Good for parallel processing scenarios

## Issue Detection

The script identifies several types of issues:

### Data Integrity Issues
- **Missing Files**: Database records without corresponding files
- **Orphaned Files**: Files on filesystem not in database
- **Corrupted Files**: Unreadable or damaged files
- **Duplicate Names**: Multiple files with same name

### Migration Challenges
- **Large Files**: Files >1GB that may need special handling
- **Special Characters**: Filenames with problematic characters
- **Permission Issues**: Files with restricted access
- **Path Length**: Paths exceeding system limits

### Performance Considerations
- **High File Counts**: Users with excessive file counts
- **Storage Hotspots**: Directories with high file density
- **Recent Upload Patterns**: Usage trends affecting migration timing

## Security Considerations

- **Database Credentials**: Use environment variables for passwords
- **File Access**: Script requires read access to media directories
- **Logging**: Sensitive information filtered from logs
- **Checksums**: Optional for integrity verification (performance impact)

## Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check credentials and network connectivity
psql -h localhost -p 5432 -U list_cutter -d list_cutter
```

**Permission Denied on Media Files**
```bash
# Check file permissions
ls -la app/media/uploads/
# Fix permissions if needed
chmod -R 755 app/media/
```

**Memory Issues with Large Datasets**
```bash
# Use smaller batch sizes
python scripts/assess_file_migration.py --batch-size 100
```

**Slow Checksum Calculation**
```bash
# Skip checksums for initial assessment
python scripts/assess_file_migration.py --detailed
# Or run in background
nohup python scripts/assess_file_migration.py --calculate-checksums &
```

### Performance Optimization

For large datasets (>100GB or >50K files):
- Use `--batch-size 500` or smaller
- Skip `--calculate-checksums` for initial runs
- Use `--log-level WARNING` to reduce output
- Consider running during off-peak hours

## Integration with Migration Pipeline

The assessment report provides essential data for:

1. **Migration Planning**: Batch configuration and timing
2. **Cost Budgeting**: R2 storage and transfer costs
3. **Risk Assessment**: Identification of potential issues
4. **Testing Strategy**: Subset selection for pilot migrations
5. **Monitoring Setup**: Key metrics for migration tracking

## Example Workflows

### Pre-Migration Assessment
```bash
# 1. Quick assessment
python scripts/assess_file_migration.py --dry-run

# 2. Full assessment with database
export DB_PASSWORD=your_password
python scripts/assess_file_migration.py --detailed --output-format both

# 3. Generate migration batches
python scripts/assess_file_migration.py --batch-strategy size --batch-size 500
```

### Production Migration Planning
```bash
# 1. Comprehensive analysis
python scripts/assess_file_migration.py \
    --detailed \
    --calculate-checksums \
    --output-format json \
    --output-file prod_migration_assessment.json

# 2. Review and plan
cat prod_migration_assessment.json | jq '.recommendations[]'

# 3. Execute migration based on batches
# (Use batch information to configure actual migration tools)
```

## Support and Documentation

- **Script Help**: `python scripts/assess_file_migration.py --help`
- **Debug Mode**: `--log-level DEBUG` for detailed troubleshooting
- **Issue Reporting**: Include JSON report with any support requests
- **Performance Profiling**: Use `--detailed` for comprehensive analysis

## License

This tool is part of the List Cutter project and follows the same license terms.
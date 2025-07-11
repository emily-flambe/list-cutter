# Production Migration Tools for Issue #66

This directory contains a comprehensive suite of production-ready migration tools for zero-downtime Django to Cloudflare R2 file migration.

## 🚀 Overview

The migration system provides a complete solution for migrating Django media files to Cloudflare R2 storage with zero downtime, comprehensive safety features, and automated rollback capabilities.

## 📋 Core Components

### 1. Production Migration Orchestrator
**File:** `production_migration_orchestrator.py`
- Central coordination system for zero-downtime migrations
- Comprehensive state management with checkpoints
- Automated failure recovery and rollback
- Real-time progress monitoring and alerting

### 2. Batch Migration Engine
**File:** `batch_migration_engine.py`
- High-performance parallel file processing
- Intelligent error handling and retry logic
- Rate limiting and bandwidth management
- Memory-efficient streaming for large files

### 3. Comprehensive Integrity Checker
**File:** `comprehensive_integrity_checker.py`
- Multi-layer integrity verification (checksum, size, metadata)
- Database consistency checks between PostgreSQL and D1
- R2 storage accessibility and performance testing
- Automated remediation suggestions

### 4. Migration State Manager
**File:** `migration_state_manager.py`
- SQLite-based persistent state storage
- Checkpoint creation and recovery
- Error and metric recording
- Recovery point management

### 5. Disaster Recovery Procedures
**File:** `disaster_recovery_procedures.py`
- Automated critical failure detection
- Emergency rollback procedures with data preservation
- Service availability restoration
- Incident response automation and escalation

### 6. Migration Monitoring System
**File:** `migration_monitoring.py`
- Real-time migration progress tracking
- Performance monitoring with bottleneck detection
- Comprehensive alerting system with escalation
- Interactive monitoring dashboard

### 7. Production Migration Playbook
**File:** `production_migration_playbook.py`
- Complete migration orchestration with checklists
- Step-by-step migration execution with checkpoints
- Team coordination and communication tools
- Comprehensive documentation and reporting

### 8. Unified Execution Script
**File:** `execute_production_migration.py`
- Single entry point for complete migration execution
- Coordinated execution of all migration components
- Comprehensive pre-migration validation
- Detailed reporting and documentation

### 9. Comprehensive Test Suite
**File:** `test_migration_tools.py`
- Unit tests for individual components
- Integration tests for component interactions
- End-to-end migration workflow tests
- Performance and load testing

## 🔧 Quick Start

### 1. Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Copy configuration template
cp production_migration_config.example.json production_migration_config.json
```

### 2. Configuration

Edit `production_migration_config.json` with your environment settings:

```json
{
  "database": {
    "postgres_config": {
      "host": "your-postgres-host",
      "database": "your-database",
      "user": "your-user",
      "password": "your-password"
    }
  },
  "storage": {
    "r2_config": {
      "api_endpoint": "https://your-r2-endpoint",
      "api_token": "your-r2-token",
      "bucket_name": "your-bucket"
    },
    "django_media_root": "/path/to/your/media"
  }
}
```

### 3. Pre-Migration Assessment

```bash
# Run enhanced migration assessment
python enhanced_migration_assessment.py assess --media-root /path/to/media

# Generate migration playbook
python production_migration_playbook.py generate --config-file production_migration_config.json
```

### 4. Execute Migration

```bash
# Execute complete production migration
python execute_production_migration.py execute production_migration_config.json

# Or run in dry-run mode first
python execute_production_migration.py execute production_migration_config.json --dry-run
```

### 5. Monitor Progress

```bash
# Monitor migration progress
python migration_monitoring.py monitor --config-file production_migration_config.json --dashboard

# Check migration status
python execute_production_migration.py status <execution-id>
```

## 🛠️ Advanced Usage

### Individual Component Usage

#### 1. State Management
```bash
# Initialize migration state
python migration_state_manager.py init

# List migration sessions
python migration_state_manager.py list-sessions

# Show session details
python migration_state_manager.py show <session-id>
```

#### 2. Batch Processing
```bash
# Generate migration tasks
python batch_migration_engine.py generate-tasks /path/to/media tasks.json

# Execute batch migration
python batch_migration_engine.py migrate tasks.json --max-workers 10
```

#### 3. Integrity Verification
```bash
# Verify file integrity
python comprehensive_integrity_checker.py verify files.json

# Verify single file
python comprehensive_integrity_checker.py verify-single <file-id> <source-path> <r2-key>
```

#### 4. Disaster Recovery
```bash
# Start disaster recovery monitoring
python disaster_recovery_procedures.py monitor --config-file dr_config.json

# Simulate incident for testing
python disaster_recovery_procedures.py simulate-incident migration_failure critical "Test incident"
```

#### 5. Monitoring and Alerting
```bash
# Start monitoring
python migration_monitoring.py monitor --config-file monitoring_config.json

# Test alert system
python migration_monitoring.py test-alert --alert-type performance_degradation --level warning
```

### Playbook Execution

```bash
# Generate custom playbook
python production_migration_playbook.py generate --config-file config.json --team-members "Alice,Bob,Charlie"

# Execute playbook
python production_migration_playbook.py execute playbook.json --interactive

# Execute specific phase
python production_migration_playbook.py execute playbook.json --phase migration_execution

# Check playbook status
python production_migration_playbook.py status playbook.json
```

## 🧪 Testing

### Run Test Suite

```bash
# Run all tests
python test_migration_tools.py run

# Run specific test suite
python test_migration_tools.py run --suite unit
python test_migration_tools.py run --suite integration
python test_migration_tools.py run --suite e2e
python test_migration_tools.py run --suite performance

# Generate test data
python test_migration_tools.py generate-test-data --count 1000 --output-dir ./test_data
```

### Test Categories

- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **End-to-End Tests**: Complete workflow testing
- **Performance Tests**: Load and performance validation

## 📊 Monitoring and Alerting

### Dashboard Features

- Real-time migration progress tracking
- System health monitoring (CPU, memory, disk)
- Performance metrics and bottleneck detection
- Active alerts and escalation status
- Historical data analysis and trends

### Alert Types

- **Performance Degradation**: Slow transfer rates, high error rates
- **Resource Exhaustion**: High CPU/memory/disk usage
- **Migration Stalled**: No progress for extended periods
- **Integrity Failures**: Checksum mismatches, corruption
- **System Failures**: Database connectivity, R2 access issues

### Notification Channels

- Email notifications
- Slack integration
- Webhook endpoints
- SMS alerts (for critical issues)
- Console logging

## 🔒 Security Features

- **Encryption**: All data encrypted at rest and in transit
- **Access Control**: Role-based access management
- **Audit Logging**: Complete audit trail of all operations
- **Secure Deletion**: Secure removal of sensitive data
- **API Security**: Token-based authentication for all APIs

## 🎯 Zero-Downtime Strategy

### Migration Phases

1. **Preparation**: Team assembly, infrastructure validation
2. **Pre-Migration**: Assessment, backups, schema validation
3. **Migration Execution**: Dual-write setup, background migration
4. **Post-Migration**: Integrity verification, performance testing
5. **Cutover**: Traffic switch, health monitoring
6. **Validation**: System tests, data consistency checks
7. **Cleanup**: Archive old files, documentation updates

### Rollback Capabilities

- **Automated Rollback**: Triggered by failure conditions
- **Manual Rollback**: Operator-initiated rollback
- **Partial Rollback**: Rollback to specific checkpoints
- **Emergency Rollback**: Fast rollback for critical issues

## 📈 Performance Optimization

### Batch Processing

- Configurable batch sizes for optimal performance
- Parallel processing with worker pools
- Memory-efficient streaming for large files
- Intelligent retry logic with exponential backoff

### Resource Management

- Connection pooling for database operations
- Rate limiting for API calls
- Memory usage monitoring and optimization
- Disk space management and cleanup

## 🔧 Configuration Reference

### Core Settings

```json
{
  "migration_settings": {
    "batch_size": 50,
    "max_workers": 10,
    "max_retries": 3,
    "retry_delay": 5,
    "rate_limit_mbps": 100,
    "dual_write_enabled": true
  },
  "monitoring": {
    "enabled": true,
    "system_check_interval": 30,
    "migration_check_interval": 10,
    "dashboard_enabled": true
  },
  "disaster_recovery": {
    "enabled": true,
    "auto_rollback_enabled": true,
    "monitoring_interval": 30,
    "failure_threshold": 3
  }
}
```

### Environment Variables

```bash
# Database Configuration
export POSTGRES_HOST=your-postgres-host
export POSTGRES_DB=your-database
export POSTGRES_USER=your-user
export POSTGRES_PASSWORD=your-password

# R2 Storage Configuration
export R2_API_ENDPOINT=https://your-r2-endpoint
export R2_API_TOKEN=your-r2-token
export R2_BUCKET_NAME=your-bucket

# Django Configuration
export DJANGO_MEDIA_ROOT=/path/to/your/media

# Notification Configuration
export SMTP_SERVER=your-smtp-server
export NOTIFICATION_EMAIL=your-email@domain.com
export SLACK_WEBHOOK_URL=your-slack-webhook
```

## 📚 Documentation

### Architecture Documentation

- **Migration Strategy**: Zero-downtime dual-write approach
- **Component Architecture**: Modular design with clear interfaces
- **Data Flow**: End-to-end data flow and transformation
- **Error Handling**: Comprehensive error handling and recovery
- **Performance Optimization**: Optimization strategies and tuning

### Operational Documentation

- **Deployment Guide**: Step-by-step deployment instructions
- **Monitoring Guide**: Monitoring setup and configuration
- **Troubleshooting Guide**: Common issues and solutions
- **Recovery Procedures**: Disaster recovery and rollback procedures

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check connection parameters
   - Verify network connectivity
   - Check database permissions

2. **R2 Storage Access Issues**
   - Verify API tokens and endpoints
   - Check bucket permissions
   - Test connectivity with simple requests

3. **Migration Stalled**
   - Check system resources
   - Review error logs
   - Verify file accessibility

4. **Integrity Check Failures**
   - Re-verify file checksums
   - Check for network issues during transfer
   - Validate R2 storage consistency

### Getting Help

- Review log files in `./logs/` directory
- Check migration state with state manager
- Use monitoring dashboard for real-time status
- Run integrity checks for data validation

## 🤝 Contributing

### Development Setup

```bash
# Install development dependencies
pip install -r requirements.txt

# Run tests
python test_migration_tools.py run

# Run linting
flake8 *.py

# Run type checking
mypy *.py
```

### Code Quality

- Follow PEP 8 style guidelines
- Write comprehensive docstrings
- Include unit tests for new features
- Maintain backwards compatibility

## 📄 License

This migration system is part of the List Cutter project and follows the same licensing terms.

## 🏷️ Version History

- **v1.0.0**: Initial production release with complete migration suite
- **v0.9.0**: Beta release with core functionality
- **v0.8.0**: Alpha release with basic migration tools

---

For more information, see the individual script documentation and the project's main README.

## Legacy Migration Tools

This directory also contains legacy migration tools for reference:

### migrate_to_r2.py
Original migration script with basic functionality

### rollback_migration.py
Comprehensive rollback script for legacy migrations

### validate_migration.py
Validation tools for migration integrity

### Enhanced Migration Assessment
**File:** `enhanced_migration_assessment.py`
- Comprehensive file analysis and migration planning
- Performance estimation and resource requirements
- Migration readiness assessment
- Detailed reporting and recommendations

For complete legacy documentation, see the sections below.

---

## Legacy Documentation

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

### Legacy Usage Examples

```bash
# Basic migration
python scripts/migrate_to_r2.py

# Dry run (recommended first)
python scripts/migrate_to_r2.py --dry-run

# Custom batch size
python scripts/migrate_to_r2.py --batch-size 25

# Rollback migration
python scripts/rollback_migration.py rollback --batch-id abc123

# Validate migration
python scripts/validate_migration.py --full-validation
```

The legacy tools complement the new production migration system and provide backwards compatibility for existing workflows.
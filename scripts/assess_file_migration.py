#!/usr/bin/env python3
"""
File Migration Assessment Script for List Cutter
==============================================

This script performs comprehensive analysis of Django file storage and PostgreSQL database
to assess file migration readiness for Cloudflare R2 migration.

Requirements:
- PostgreSQL database connection
- Django media file directories
- Python packages: click, tqdm, psycopg2-binary, pandas

Usage:
    python assess_file_migration.py --help
    python assess_file_migration.py --dry-run
    python assess_file_migration.py --batch-size 1000 --output-format json
"""

import os
import sys
import json
import logging
import hashlib
import mimetypes
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from collections import defaultdict, Counter

import click
import pandas as pd
from tqdm import tqdm


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class FileInfo:
    """Information about a file in the filesystem."""
    path: str
    size: int
    modified: datetime
    exists: bool
    checksum: Optional[str] = None
    mime_type: Optional[str] = None


@dataclass
class DatabaseRecord:
    """Information about a file record in the database."""
    id: int
    user_id: int
    file_id: str
    file_name: str
    file_path: str
    uploaded_at: datetime
    system_tags: List[str]
    user_tags: List[str]
    metadata: Dict[str, Any]


@dataclass
class MigrationBatch:
    """Represents a batch of files for migration."""
    batch_id: int
    files: List[Tuple[DatabaseRecord, Optional[FileInfo]]]
    total_size: int
    estimated_time: float
    estimated_cost: float
    criteria: str


@dataclass
class AssessmentReport:
    """Comprehensive assessment report."""
    timestamp: datetime
    total_files: int
    total_size: int
    existing_files: int
    missing_files: int
    corrupted_files: int
    database_records: int
    orphaned_files: int
    orphaned_records: int
    estimated_migration_time: float
    estimated_r2_cost: float
    batches: List[MigrationBatch]
    file_type_distribution: Dict[str, int]
    size_distribution: Dict[str, int]
    user_distribution: Dict[str, int]
    issues: List[str]
    recommendations: List[str]


class FileSystemScanner:
    """Scans filesystem for files and gathers metadata."""
    
    def __init__(self, media_root: str):
        self.media_root = Path(media_root)
        self.uploads_dir = self.media_root / 'uploads'
        self.generated_dir = self.media_root / 'generated'
    
    def scan_directory(self, directory: Path, show_progress: bool = True) -> Dict[str, FileInfo]:
        """Scan a directory and return file information."""
        files = {}
        
        if not directory.exists():
            logger.warning(f"Directory does not exist: {directory}")
            return files
        
        # Get all files in directory
        all_files = list(directory.rglob('*'))
        file_paths = [f for f in all_files if f.is_file()]
        
        if show_progress:
            file_paths = tqdm(file_paths, desc=f"Scanning {directory.name}")
        
        for file_path in file_paths:
            try:
                stat = file_path.stat()
                relative_path = str(file_path.relative_to(self.media_root))
                
                files[relative_path] = FileInfo(
                    path=str(file_path),
                    size=stat.st_size,
                    modified=datetime.fromtimestamp(stat.st_mtime),
                    exists=True,
                    mime_type=mimetypes.guess_type(str(file_path))[0]
                )
            except (OSError, IOError) as e:
                logger.error(f"Error reading file {file_path}: {e}")
                files[relative_path] = FileInfo(
                    path=str(file_path),
                    size=0,
                    modified=datetime.now(),
                    exists=False
                )
        
        return files
    
    def calculate_checksum(self, file_path: str) -> Optional[str]:
        """Calculate SHA256 checksum for a file."""
        try:
            hasher = hashlib.sha256()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except (OSError, IOError) as e:
            logger.error(f"Error calculating checksum for {file_path}: {e}")
            return None
    
    def scan_all_files(self) -> Dict[str, FileInfo]:
        """Scan all media directories and return comprehensive file information."""
        logger.info("Starting filesystem scan...")
        
        all_files = {}
        
        # Scan uploads directory
        if self.uploads_dir.exists():
            uploads_files = self.scan_directory(self.uploads_dir)
            all_files.update(uploads_files)
            logger.info(f"Found {len(uploads_files)} files in uploads directory")
        
        # Scan generated directory
        if self.generated_dir.exists():
            generated_files = self.scan_directory(self.generated_dir)
            all_files.update(generated_files)
            logger.info(f"Found {len(generated_files)} files in generated directory")
        
        logger.info(f"Total files found: {len(all_files)}")
        return all_files


class DatabaseAnalyzer:
    """Analyzes PostgreSQL database for file records."""
    
    def __init__(self, db_config: Dict[str, str]):
        self.db_config = db_config
        self.connection = None
    
    def connect(self):
        """Connect to PostgreSQL database."""
        try:
            self.connection = psycopg2.connect(**self.db_config)
            logger.info("Connected to PostgreSQL database")
        except psycopg2.Error as e:
            logger.error(f"Database connection failed: {e}")
            raise
    
    def disconnect(self):
        """Disconnect from database."""
        if self.connection:
            self.connection.close()
            logger.info("Disconnected from PostgreSQL database")
    
    def get_all_file_records(self) -> List[DatabaseRecord]:
        """Retrieve all file records from database."""
        if not self.connection:
            raise RuntimeError("Database connection not established")
        
        query = """
        SELECT 
            id, user_id, file_id, file_name, file_path, uploaded_at,
            system_tags, user_tags, metadata
        FROM list_cutter_savedfile
        ORDER BY uploaded_at DESC
        """
        
        with self.connection.cursor() as cursor:
            cursor.execute(query)
            records = cursor.fetchall()
        
        db_records = []
        for record in records:
            db_records.append(DatabaseRecord(
                id=record[0],
                user_id=record[1],
                file_id=record[2],
                file_name=record[3],
                file_path=record[4],
                uploaded_at=record[5],
                system_tags=record[6] or [],
                user_tags=record[7] or [],
                metadata=record[8] or {}
            ))
        
        logger.info(f"Found {len(db_records)} database records")
        return db_records
    
    def get_file_statistics(self) -> Dict[str, Any]:
        """Get statistical information about files in database."""
        if not self.connection:
            raise RuntimeError("Database connection not established")
        
        queries = {
            'total_files': "SELECT COUNT(*) FROM list_cutter_savedfile",
            'total_users': "SELECT COUNT(DISTINCT user_id) FROM list_cutter_savedfile",
            'files_by_user': """
                SELECT user_id, COUNT(*) as file_count 
                FROM list_cutter_savedfile 
                GROUP BY user_id 
                ORDER BY file_count DESC
            """,
            'files_by_month': """
                SELECT 
                    DATE_TRUNC('month', uploaded_at) as month,
                    COUNT(*) as file_count
                FROM list_cutter_savedfile
                GROUP BY month
                ORDER BY month DESC
            """,
            'recent_uploads': """
                SELECT COUNT(*) 
                FROM list_cutter_savedfile 
                WHERE uploaded_at >= NOW() - INTERVAL '30 days'
            """
        }
        
        stats = {}
        with self.connection.cursor() as cursor:
            for key, query in queries.items():
                cursor.execute(query)
                if key in ['files_by_user', 'files_by_month']:
                    stats[key] = cursor.fetchall()
                else:
                    stats[key] = cursor.fetchone()[0]
        
        return stats


class CostCalculator:
    """Calculates migration costs and estimates."""
    
    # Cloudflare R2 pricing (as of 2024)
    R2_STORAGE_COST_PER_GB = 0.015  # $0.015 per GB per month
    R2_CLASS_A_OPERATIONS = 0.00036  # $0.36 per 1M operations (PUT, COPY, POST, LIST)
    R2_CLASS_B_OPERATIONS = 0.0018   # $1.80 per 1M operations (GET, HEAD, OPTIONS)
    R2_EGRESS_COST_PER_GB = 0.0      # First 10GB free, then varies by region
    
    # Migration estimates
    UPLOAD_RATE_MBPS = 10  # Average upload rate in Mbps
    PROCESSING_TIME_PER_FILE = 0.1  # Seconds per file for processing
    
    def __init__(self):
        pass
    
    def calculate_storage_cost(self, total_size_bytes: int) -> float:
        """Calculate monthly storage cost for R2."""
        total_gb = total_size_bytes / (1024 ** 3)
        return total_gb * self.R2_STORAGE_COST_PER_GB
    
    def calculate_migration_cost(self, file_count: int, total_size_bytes: int) -> float:
        """Calculate one-time migration cost."""
        # PUT operations for file uploads
        put_operations = file_count / 1_000_000  # Convert to millions
        put_cost = put_operations * self.R2_CLASS_A_OPERATIONS
        
        # Additional processing costs (minimal)
        processing_cost = file_count * 0.000001  # $0.000001 per file
        
        return put_cost + processing_cost
    
    def estimate_migration_time(self, total_size_bytes: int, file_count: int) -> float:
        """Estimate migration time in hours."""
        # Network transfer time
        total_mb = total_size_bytes / (1024 ** 2)
        transfer_time_seconds = total_mb / self.UPLOAD_RATE_MBPS
        
        # Processing time
        processing_time_seconds = file_count * self.PROCESSING_TIME_PER_FILE
        
        # Total time with 20% buffer
        total_seconds = (transfer_time_seconds + processing_time_seconds) * 1.2
        return total_seconds / 3600  # Convert to hours
    
    def calculate_bandwidth_savings(self, monthly_downloads: int, avg_file_size: int) -> float:
        """Calculate monthly bandwidth cost savings."""
        # Current CDN/bandwidth costs (estimate)
        monthly_gb = (monthly_downloads * avg_file_size) / (1024 ** 3)
        
        # Assuming current bandwidth costs around $0.10 per GB
        current_cost = monthly_gb * 0.10
        
        # R2 egress is free for first 10GB, then varies
        r2_cost = max(0, (monthly_gb - 10) * 0.05)  # Estimated R2 egress cost
        
        return max(0, current_cost - r2_cost)


class MigrationPlanner:
    """Plans migration batches and strategies."""
    
    def __init__(self, cost_calculator: CostCalculator):
        self.cost_calculator = cost_calculator
    
    def create_batches(
        self, 
        file_data: List[Tuple[DatabaseRecord, Optional[FileInfo]]],
        strategy: str = 'size',
        batch_size: int = 1000,
        max_batch_size_gb: float = 10.0
    ) -> List[MigrationBatch]:
        """Create migration batches based on strategy."""
        
        # Sort files based on strategy
        if strategy == 'size':
            file_data.sort(key=lambda x: x[1].size if x[1] else 0, reverse=True)
        elif strategy == 'date':
            file_data.sort(key=lambda x: x[0].uploaded_at)
        elif strategy == 'user':
            file_data.sort(key=lambda x: x[0].user_id)
        elif strategy == 'random':
            import random
            random.shuffle(file_data)
        
        batches = []
        current_batch = []
        current_size = 0
        batch_id = 1
        max_batch_size_bytes = max_batch_size_gb * 1024 ** 3
        
        for record, file_info in file_data:
            file_size = file_info.size if file_info else 0
            
            # Check if adding this file would exceed limits
            if (len(current_batch) >= batch_size or 
                current_size + file_size > max_batch_size_bytes):
                
                # Create batch if we have files
                if current_batch:
                    batch = self._create_batch(
                        batch_id, current_batch, current_size, strategy
                    )
                    batches.append(batch)
                    batch_id += 1
                    current_batch = []
                    current_size = 0
            
            current_batch.append((record, file_info))
            current_size += file_size
        
        # Add remaining files as final batch
        if current_batch:
            batch = self._create_batch(batch_id, current_batch, current_size, strategy)
            batches.append(batch)
        
        return batches
    
    def _create_batch(
        self, 
        batch_id: int, 
        files: List[Tuple[DatabaseRecord, Optional[FileInfo]]],
        total_size: int,
        criteria: str
    ) -> MigrationBatch:
        """Create a migration batch with cost and time estimates."""
        
        file_count = len(files)
        estimated_time = self.cost_calculator.estimate_migration_time(
            total_size, file_count
        )
        estimated_cost = self.cost_calculator.calculate_migration_cost(
            file_count, total_size
        )
        
        return MigrationBatch(
            batch_id=batch_id,
            files=files,
            total_size=total_size,
            estimated_time=estimated_time,
            estimated_cost=estimated_cost,
            criteria=criteria
        )


class FileMigrationAssessor:
    """Main class that orchestrates the file migration assessment."""
    
    def __init__(self, media_root: str, db_config: Dict[str, str]):
        self.media_root = media_root
        self.db_config = db_config
        self.file_scanner = FileSystemScanner(media_root)
        self.db_analyzer = DatabaseAnalyzer(db_config)
        self.cost_calculator = CostCalculator()
        self.migration_planner = MigrationPlanner(self.cost_calculator)
    
    def assess_migration(
        self, 
        batch_size: int = 1000,
        batch_strategy: str = 'size',
        calculate_checksums: bool = False
    ) -> AssessmentReport:
        """Perform comprehensive migration assessment."""
        
        logger.info("Starting file migration assessment...")
        
        # Connect to database
        self.db_analyzer.connect()
        
        try:
            # Scan filesystem
            filesystem_files = self.file_scanner.scan_all_files()
            
            # Get database records
            db_records = self.db_analyzer.get_all_file_records()
            db_stats = self.db_analyzer.get_file_statistics()
            
            # Calculate checksums if requested
            if calculate_checksums:
                logger.info("Calculating file checksums...")
                for file_info in tqdm(filesystem_files.values(), desc="Checksums"):
                    if file_info.exists:
                        file_info.checksum = self.file_scanner.calculate_checksum(
                            file_info.path
                        )
            
            # Analyze file-database correlation
            analysis_results = self._analyze_file_correlation(
                filesystem_files, db_records
            )
            
            # Create migration batches
            batches = self.migration_planner.create_batches(
                analysis_results['matched_files'],
                strategy=batch_strategy,
                batch_size=batch_size
            )
            
            # Generate comprehensive report
            report = self._generate_report(
                filesystem_files, db_records, analysis_results, batches, db_stats
            )
            
            logger.info("Assessment completed successfully")
            return report
            
        finally:
            self.db_analyzer.disconnect()
    
    def _analyze_file_correlation(
        self, 
        filesystem_files: Dict[str, FileInfo],
        db_records: List[DatabaseRecord]
    ) -> Dict[str, Any]:
        """Analyze correlation between filesystem and database."""
        
        logger.info("Analyzing file-database correlation...")
        
        # Create lookup maps
        db_files_map = {record.file_path: record for record in db_records}
        fs_files_set = set(filesystem_files.keys())
        db_files_set = set(db_files_map.keys())
        
        # Find matches and mismatches
        matched_files = []
        missing_files = []
        orphaned_files = []
        orphaned_records = []
        corrupted_files = []
        
        # Check database records against filesystem
        for record in db_records:
            if record.file_path in filesystem_files:
                file_info = filesystem_files[record.file_path]
                if file_info.exists:
                    matched_files.append((record, file_info))
                else:
                    corrupted_files.append((record, file_info))
            else:
                missing_files.append(record)
                orphaned_records.append(record)
        
        # Check filesystem files against database
        for file_path, file_info in filesystem_files.items():
            if file_path not in db_files_map:
                orphaned_files.append(file_info)
        
        return {
            'matched_files': matched_files,
            'missing_files': missing_files,
            'orphaned_files': orphaned_files,
            'orphaned_records': orphaned_records,
            'corrupted_files': corrupted_files
        }
    
    def _generate_report(
        self,
        filesystem_files: Dict[str, FileInfo],
        db_records: List[DatabaseRecord],
        analysis_results: Dict[str, Any],
        batches: List[MigrationBatch],
        db_stats: Dict[str, Any]
    ) -> AssessmentReport:
        """Generate comprehensive assessment report."""
        
        logger.info("Generating assessment report...")
        
        # Calculate totals
        total_files = len(filesystem_files)
        existing_files = sum(1 for f in filesystem_files.values() if f.exists)
        total_size = sum(f.size for f in filesystem_files.values() if f.exists)
        
        # Calculate distributions
        file_type_dist = self._calculate_file_type_distribution(filesystem_files)
        size_dist = self._calculate_size_distribution(filesystem_files)
        user_dist = self._calculate_user_distribution(db_records)
        
        # Calculate costs and time
        total_migration_time = sum(batch.estimated_time for batch in batches)
        total_migration_cost = sum(batch.estimated_cost for batch in batches)
        monthly_storage_cost = self.cost_calculator.calculate_storage_cost(total_size)
        
        # Generate issues and recommendations
        issues = self._identify_issues(analysis_results, filesystem_files, db_records)
        recommendations = self._generate_recommendations(
            analysis_results, total_size, len(db_records)
        )
        
        return AssessmentReport(
            timestamp=datetime.now(),
            total_files=total_files,
            total_size=total_size,
            existing_files=existing_files,
            missing_files=len(analysis_results['missing_files']),
            corrupted_files=len(analysis_results['corrupted_files']),
            database_records=len(db_records),
            orphaned_files=len(analysis_results['orphaned_files']),
            orphaned_records=len(analysis_results['orphaned_records']),
            estimated_migration_time=total_migration_time,
            estimated_r2_cost=monthly_storage_cost,
            batches=batches,
            file_type_distribution=file_type_dist,
            size_distribution=size_dist,
            user_distribution=user_dist,
            issues=issues,
            recommendations=recommendations
        )
    
    def _calculate_file_type_distribution(
        self, filesystem_files: Dict[str, FileInfo]
    ) -> Dict[str, int]:
        """Calculate distribution of file types."""
        type_counts = Counter()
        for file_info in filesystem_files.values():
            if file_info.exists:
                ext = Path(file_info.path).suffix.lower()
                type_counts[ext or 'no_extension'] += 1
        return dict(type_counts)
    
    def _calculate_size_distribution(
        self, filesystem_files: Dict[str, FileInfo]
    ) -> Dict[str, int]:
        """Calculate distribution of file sizes."""
        size_ranges = {
            'small (< 1MB)': 0,
            'medium (1MB - 10MB)': 0,
            'large (10MB - 100MB)': 0,
            'xlarge (> 100MB)': 0
        }
        
        for file_info in filesystem_files.values():
            if file_info.exists:
                size_mb = file_info.size / (1024 ** 2)
                if size_mb < 1:
                    size_ranges['small (< 1MB)'] += 1
                elif size_mb < 10:
                    size_ranges['medium (1MB - 10MB)'] += 1
                elif size_mb < 100:
                    size_ranges['large (10MB - 100MB)'] += 1
                else:
                    size_ranges['xlarge (> 100MB)'] += 1
        
        return size_ranges
    
    def _calculate_user_distribution(
        self, db_records: List[DatabaseRecord]
    ) -> Dict[str, int]:
        """Calculate distribution of files by user."""
        user_counts = Counter()
        for record in db_records:
            user_counts[f'user_{record.user_id}'] += 1
        return dict(user_counts.most_common(10))  # Top 10 users
    
    def _identify_issues(
        self,
        analysis_results: Dict[str, Any],
        filesystem_files: Dict[str, FileInfo],
        db_records: List[DatabaseRecord]
    ) -> List[str]:
        """Identify potential issues with the migration."""
        issues = []
        
        if analysis_results['missing_files']:
            issues.append(
                f"{len(analysis_results['missing_files'])} files referenced in database but missing from filesystem"
            )
        
        if analysis_results['orphaned_files']:
            issues.append(
                f"{len(analysis_results['orphaned_files'])} files in filesystem but not in database"
            )
        
        if analysis_results['corrupted_files']:
            issues.append(
                f"{len(analysis_results['corrupted_files'])} files marked as corrupted or unreadable"
            )
        
        # Check for very large files
        large_files = [f for f in filesystem_files.values() 
                      if f.exists and f.size > 1024 ** 3]  # > 1GB
        if large_files:
            issues.append(f"{len(large_files)} files are larger than 1GB")
        
        # Check for duplicate file names
        file_names = [record.file_name for record in db_records]
        duplicates = [name for name, count in Counter(file_names).items() if count > 1]
        if duplicates:
            issues.append(f"{len(duplicates)} duplicate file names found")
        
        return issues
    
    def _generate_recommendations(
        self,
        analysis_results: Dict[str, Any],
        total_size: int,
        total_records: int
    ) -> List[str]:
        """Generate migration recommendations."""
        recommendations = []
        
        if analysis_results['missing_files']:
            recommendations.append(
                "Clean up database records for missing files before migration"
            )
        
        if analysis_results['orphaned_files']:
            recommendations.append(
                "Decide whether to migrate orphaned files or remove them"
            )
        
        if total_size > 100 * 1024 ** 3:  # > 100GB
            recommendations.append(
                "Consider migrating in multiple phases due to large total size"
            )
        
        if total_records > 10000:
            recommendations.append(
                "Use batch processing with smaller batch sizes for large file counts"
            )
        
        recommendations.extend([
            "Test migration with a small subset first",
            "Monitor R2 costs and performance after migration",
            "Implement file integrity checks post-migration",
            "Consider implementing CDN caching for frequently accessed files"
        ])
        
        return recommendations


def format_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def format_time(hours: float) -> str:
    """Format time in human-readable format."""
    if hours < 1:
        return f"{hours * 60:.1f} minutes"
    elif hours < 24:
        return f"{hours:.1f} hours"
    else:
        return f"{hours / 24:.1f} days"


def print_report(report: AssessmentReport, detailed: bool = False):
    """Print human-readable assessment report."""
    
    print("\n" + "="*60)
    print("FILE MIGRATION ASSESSMENT REPORT")
    print("="*60)
    print(f"Generated: {report.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Summary
    print("SUMMARY")
    print("-"*20)
    print(f"Total files in filesystem: {report.total_files:,}")
    print(f"Existing files: {report.existing_files:,}")
    print(f"Total size: {format_size(report.total_size)}")
    print(f"Database records: {report.database_records:,}")
    print()
    
    # Issues
    if report.issues:
        print("ISSUES FOUND")
        print("-"*20)
        for issue in report.issues:
            print(f"⚠️  {issue}")
        print()
    
    # Migration Estimates
    print("MIGRATION ESTIMATES")
    print("-"*20)
    print(f"Estimated migration time: {format_time(report.estimated_migration_time)}")
    print(f"Estimated monthly R2 cost: ${report.estimated_r2_cost:.2f}")
    print(f"Number of batches: {len(report.batches)}")
    print()
    
    # File Analysis
    print("FILE ANALYSIS")
    print("-"*20)
    print(f"Missing files: {report.missing_files}")
    print(f"Corrupted files: {report.corrupted_files}")
    print(f"Orphaned files: {report.orphaned_files}")
    print(f"Orphaned records: {report.orphaned_records}")
    print()
    
    if detailed:
        # File Type Distribution
        print("FILE TYPE DISTRIBUTION")
        print("-"*20)
        for file_type, count in report.file_type_distribution.items():
            print(f"{file_type}: {count:,} files")
        print()
        
        # Size Distribution
        print("SIZE DISTRIBUTION")
        print("-"*20)
        for size_range, count in report.size_distribution.items():
            print(f"{size_range}: {count:,} files")
        print()
        
        # User Distribution
        print("TOP USERS BY FILE COUNT")
        print("-"*20)
        for user, count in report.user_distribution.items():
            print(f"{user}: {count:,} files")
        print()
        
        # Batch Information
        print("MIGRATION BATCHES")
        print("-"*20)
        for batch in report.batches[:5]:  # Show first 5 batches
            print(f"Batch {batch.batch_id}: {len(batch.files):,} files, "
                  f"{format_size(batch.total_size)}, "
                  f"{format_time(batch.estimated_time)}")
        if len(report.batches) > 5:
            print(f"... and {len(report.batches) - 5} more batches")
        print()
    
    # Recommendations
    print("RECOMMENDATIONS")
    print("-"*20)
    for i, rec in enumerate(report.recommendations, 1):
        print(f"{i}. {rec}")
    print()


def save_json_report(report: AssessmentReport, filename: str):
    """Save assessment report as JSON."""
    
    # Convert dataclasses to dictionaries
    report_dict = asdict(report)
    
    # Convert datetime objects to strings
    report_dict['timestamp'] = report.timestamp.isoformat()
    
    # Convert batch data
    for batch in report_dict['batches']:
        # Remove the files list for JSON (too large)
        batch['file_count'] = len(batch['files'])
        batch['files'] = f"[{batch['file_count']} files - details omitted]"
    
    with open(filename, 'w') as f:
        json.dump(report_dict, f, indent=2, default=str)
    
    print(f"JSON report saved to: {filename}")


@click.command()
@click.option('--media-root', default='app/media', help='Path to Django media root directory')
@click.option('--db-host', default='localhost', help='PostgreSQL host')
@click.option('--db-port', default=5432, help='PostgreSQL port')
@click.option('--db-name', default='list_cutter', help='PostgreSQL database name')
@click.option('--db-user', default='list_cutter', help='PostgreSQL username')
@click.option('--db-password', envvar='DB_PASSWORD', help='PostgreSQL password')
@click.option('--batch-size', default=1000, help='Migration batch size')
@click.option('--batch-strategy', default='size', 
              type=click.Choice(['size', 'date', 'user', 'random']),
              help='Batch creation strategy')
@click.option('--output-format', default='text', 
              type=click.Choice(['text', 'json', 'both']),
              help='Output format')
@click.option('--output-file', help='Output file path (for JSON)')
@click.option('--detailed', is_flag=True, help='Show detailed report')
@click.option('--dry-run', is_flag=True, help='Perform dry run without database connection')
@click.option('--calculate-checksums', is_flag=True, help='Calculate file checksums (slow)')
@click.option('--log-level', default='INFO', 
              type=click.Choice(['DEBUG', 'INFO', 'WARNING', 'ERROR']),
              help='Logging level')
def main(media_root, db_host, db_port, db_name, db_user, db_password,
         batch_size, batch_strategy, output_format, output_file, detailed,
         dry_run, calculate_checksums, log_level):
    """
    Assess file migration readiness for Django to Cloudflare R2 migration.
    
    This script analyzes your Django media files and database to provide
    comprehensive migration planning information.
    
    Examples:
        # Basic assessment
        python assess_file_migration.py
        
        # Detailed assessment with JSON output
        python assess_file_migration.py --detailed --output-format json --output-file report.json
        
        # Dry run (filesystem only)
        python assess_file_migration.py --dry-run --detailed
        
        # Custom batch strategy
        python assess_file_migration.py --batch-strategy date --batch-size 500
    """
    
    # Set logging level
    logging.getLogger().setLevel(getattr(logging, log_level))
    
    # Validate inputs
    if not dry_run and not db_password:
        click.echo("Error: Database password required. Set DB_PASSWORD environment variable or use --db-password", err=True)
        sys.exit(1)
    
    if not os.path.exists(media_root):
        click.echo(f"Error: Media root directory does not exist: {media_root}", err=True)
        sys.exit(1)
    
    try:
        # Database configuration
        if not dry_run:
            db_config = {
                'host': db_host,
                'port': db_port,
                'database': db_name,
                'user': db_user,
                'password': db_password
            }
        else:
            db_config = {}
            click.echo("Running in dry-run mode (filesystem analysis only)")
        
        # Initialize assessor
        assessor = FileMigrationAssessor(media_root, db_config)
        
        # Perform assessment
        if dry_run:
            # Dry run - analyze filesystem only
            filesystem_files = assessor.file_scanner.scan_all_files()
            
            # Create dummy report for dry run
            total_size = sum(f.size for f in filesystem_files.values() if f.exists)
            existing_files = sum(1 for f in filesystem_files.values() if f.exists)
            
            click.echo(f"\nDry Run Results:")
            click.echo(f"Total files found: {len(filesystem_files):,}")
            click.echo(f"Existing files: {existing_files:,}")
            click.echo(f"Total size: {format_size(total_size)}")
            click.echo(f"Estimated monthly R2 cost: ${assessor.cost_calculator.calculate_storage_cost(total_size):.2f}")
            
        else:
            # Full assessment
            report = assessor.assess_migration(
                batch_size=batch_size,
                batch_strategy=batch_strategy,
                calculate_checksums=calculate_checksums
            )
            
            # Output results
            if output_format in ['text', 'both']:
                print_report(report, detailed=detailed)
            
            if output_format in ['json', 'both']:
                json_file = output_file or f"migration_assessment_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                save_json_report(report, json_file)
    
    except Exception as e:
        logger.error(f"Assessment failed: {e}")
        if log_level == 'DEBUG':
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
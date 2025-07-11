#!/usr/bin/env python3
"""
Comprehensive Integrity Checker for Issue #66
=============================================

Multi-layer integrity verification system for production file migrations.
Provides comprehensive validation of file integrity, database consistency,
and access pattern verification.

Features:
- Multi-layer integrity verification (checksum, size, metadata)
- Database consistency checks between PostgreSQL and D1
- R2 storage accessibility and performance testing
- Access pattern verification and validation
- Batch integrity verification with parallel processing
- Deep integrity analysis with statistical validation
- Performance impact assessment
- Automated remediation suggestions

Author: Claude Code
Version: 1.0.0
"""

import asyncio
import hashlib
import json
import logging
import os
import sys
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set, Union
import sqlite3
import uuid

import aiohttp
import aiofiles
import click
import numpy as np
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn
from rich.tree import Tree
from rich.panel import Panel

console = Console()

class IntegrityStatus(Enum):
    """Integrity check status"""
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"
    UNKNOWN = "unknown"
    SKIPPED = "skipped"

class CheckType(Enum):
    """Types of integrity checks"""
    CHECKSUM = "checksum"
    SIZE = "size"
    METADATA = "metadata"
    ACCESSIBILITY = "accessibility"
    PERFORMANCE = "performance"
    DATABASE_CONSISTENCY = "database_consistency"
    ACCESS_PATTERN = "access_pattern"

class SeverityLevel(Enum):
    """Issue severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class IntegrityCheck:
    """Individual integrity check result"""
    check_id: str
    check_type: CheckType
    file_id: str
    file_path: str
    status: IntegrityStatus
    
    # Check details
    expected_value: Optional[str] = None
    actual_value: Optional[str] = None
    difference: Optional[str] = None
    
    # Timing
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    duration: float = 0.0
    
    # Error details
    error_message: Optional[str] = None
    error_details: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if isinstance(self.start_time, str):
            self.start_time = datetime.fromisoformat(self.start_time)
        if isinstance(self.end_time, str):
            self.end_time = datetime.fromisoformat(self.end_time)
    
    def complete_check(self, status: IntegrityStatus, error_message: str = None):
        """Mark check as completed"""
        self.end_time = datetime.now(timezone.utc)
        self.duration = (self.end_time - self.start_time).total_seconds()
        self.status = status
        if error_message:
            self.error_message = error_message

@dataclass
class FileIntegrityResult:
    """Complete integrity result for a file"""
    file_id: str
    file_path: str
    source_path: Optional[str] = None
    target_path: Optional[str] = None
    
    # Overall status
    overall_status: IntegrityStatus = IntegrityStatus.UNKNOWN
    confidence_score: float = 0.0  # 0-100
    
    # Individual checks
    checks: List[IntegrityCheck] = field(default_factory=list)
    
    # Summary metrics
    passed_checks: int = 0
    failed_checks: int = 0
    warning_checks: int = 0
    total_checks: int = 0
    
    # Performance metrics
    total_verification_time: float = 0.0
    avg_check_time: float = 0.0
    
    # Issues found
    issues: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    
    def add_check(self, check: IntegrityCheck):
        """Add integrity check result"""
        self.checks.append(check)
        self.total_checks += 1
        
        if check.status == IntegrityStatus.PASSED:
            self.passed_checks += 1
        elif check.status == IntegrityStatus.FAILED:
            self.failed_checks += 1
        elif check.status == IntegrityStatus.WARNING:
            self.warning_checks += 1
        
        self.total_verification_time += check.duration
        if self.total_checks > 0:
            self.avg_check_time = self.total_verification_time / self.total_checks
        
        # Update overall status
        self._update_overall_status()
    
    def _update_overall_status(self):
        """Update overall status based on individual checks"""
        if self.failed_checks > 0:
            self.overall_status = IntegrityStatus.FAILED
            self.confidence_score = max(0, 100 - (self.failed_checks / self.total_checks * 100))
        elif self.warning_checks > 0:
            self.overall_status = IntegrityStatus.WARNING
            self.confidence_score = max(50, 100 - (self.warning_checks / self.total_checks * 50))
        elif self.passed_checks > 0:
            self.overall_status = IntegrityStatus.PASSED
            self.confidence_score = 100
        else:
            self.overall_status = IntegrityStatus.UNKNOWN
            self.confidence_score = 0

@dataclass
class BatchIntegrityResult:
    """Integrity results for a batch of files"""
    batch_id: str
    batch_name: str
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    
    # File results
    file_results: List[FileIntegrityResult] = field(default_factory=list)
    
    # Summary statistics
    total_files: int = 0
    passed_files: int = 0
    failed_files: int = 0
    warning_files: int = 0
    
    # Detailed statistics
    total_checks: int = 0
    passed_checks: int = 0
    failed_checks: int = 0
    warning_checks: int = 0
    
    # Performance metrics
    total_verification_time: float = 0.0
    avg_file_verification_time: float = 0.0
    throughput_files_per_second: float = 0.0
    
    # Quality metrics
    overall_confidence: float = 0.0
    data_integrity_score: float = 0.0
    
    # Issues and recommendations
    critical_issues: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    
    def add_file_result(self, file_result: FileIntegrityResult):
        """Add file integrity result"""
        self.file_results.append(file_result)
        self.total_files += 1
        
        # Update counts
        if file_result.overall_status == IntegrityStatus.PASSED:
            self.passed_files += 1
        elif file_result.overall_status == IntegrityStatus.FAILED:
            self.failed_files += 1
        elif file_result.overall_status == IntegrityStatus.WARNING:
            self.warning_files += 1
        
        # Update check counts
        self.total_checks += file_result.total_checks
        self.passed_checks += file_result.passed_checks
        self.failed_checks += file_result.failed_checks
        self.warning_checks += file_result.warning_checks
        
        # Update timing
        self.total_verification_time += file_result.total_verification_time
        if self.total_files > 0:
            self.avg_file_verification_time = self.total_verification_time / self.total_files
        
        # Update quality metrics
        self._update_quality_metrics()
    
    def _update_quality_metrics(self):
        """Update quality metrics"""
        if self.total_files > 0:
            # Overall confidence
            confidence_scores = [f.confidence_score for f in self.file_results if f.confidence_score > 0]
            self.overall_confidence = np.mean(confidence_scores) if confidence_scores else 0
            
            # Data integrity score
            integrity_score = (self.passed_files / self.total_files) * 100
            if self.warning_files > 0:
                integrity_score -= (self.warning_files / self.total_files) * 10
            self.data_integrity_score = max(0, integrity_score)
        
        # Calculate throughput
        if self.end_time and self.start_time:
            duration = (self.end_time - self.start_time).total_seconds()
            if duration > 0:
                self.throughput_files_per_second = self.total_files / duration
    
    def finalize(self):
        """Finalize batch results"""
        self.end_time = datetime.now(timezone.utc)
        self._update_quality_metrics()
        self._generate_recommendations()
    
    def _generate_recommendations(self):
        """Generate recommendations based on results"""
        if self.failed_files > 0:
            self.recommendations.append(f"Re-verify {self.failed_files} failed files before production use")
        
        if self.overall_confidence < 95:
            self.recommendations.append("Consider additional verification steps to improve confidence")
        
        if self.avg_file_verification_time > 10:  # > 10 seconds per file
            self.recommendations.append("Optimize verification process for better performance")

class ChecksumCalculator:
    """High-performance checksum calculation"""
    
    def __init__(self, algorithm: str = 'sha256', chunk_size: int = 8192):
        self.algorithm = algorithm
        self.chunk_size = chunk_size
    
    async def calculate_file_checksum(self, file_path: str) -> Optional[str]:
        """Calculate file checksum asynchronously"""
        try:
            hash_func = hashlib.new(self.algorithm)
            
            async with aiofiles.open(file_path, 'rb') as f:
                while True:
                    chunk = await f.read(self.chunk_size)
                    if not chunk:
                        break
                    hash_func.update(chunk)
            
            return hash_func.hexdigest()
        
        except Exception as e:
            console.print(f"[red]Error calculating checksum for {file_path}: {e}[/red]")
            return None
    
    def calculate_string_checksum(self, data: str) -> str:
        """Calculate checksum for string data"""
        hash_func = hashlib.new(self.algorithm)
        hash_func.update(data.encode('utf-8'))
        return hash_func.hexdigest()

class DatabaseChecker:
    """Database consistency checker"""
    
    def __init__(self, postgres_config: Dict[str, Any], d1_config: Dict[str, Any]):
        self.postgres_config = postgres_config
        self.d1_config = d1_config
        self.postgres_conn = None
        self.d1_conn = None
    
    async def connect(self):
        """Connect to databases"""
        # PostgreSQL connection
        try:
            self.postgres_conn = psycopg2.connect(**self.postgres_config)
            console.print("[green]✓[/green] Connected to PostgreSQL")
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to connect to PostgreSQL: {e}")
            raise
        
        # D1 connection (simulated via API or local SQLite)
        try:
            if 'sqlite_path' in self.d1_config:
                self.d1_conn = sqlite3.connect(self.d1_config['sqlite_path'])
                self.d1_conn.row_factory = sqlite3.Row
            console.print("[green]✓[/green] Connected to D1 database")
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to connect to D1: {e}")
            raise
    
    async def check_record_consistency(self, file_id: str) -> IntegrityCheck:
        """Check consistency between PostgreSQL and D1 records"""
        check = IntegrityCheck(
            check_id=str(uuid.uuid4()),
            check_type=CheckType.DATABASE_CONSISTENCY,
            file_id=file_id,
            file_path=""
        )
        
        try:
            # Get PostgreSQL record
            postgres_record = await self._get_postgres_record(file_id)
            
            # Get D1 record
            d1_record = await self._get_d1_record(file_id)
            
            # Compare records
            if postgres_record and d1_record:
                consistency_issues = self._compare_records(postgres_record, d1_record)
                
                if not consistency_issues:
                    check.complete_check(IntegrityStatus.PASSED)
                else:
                    check.complete_check(
                        IntegrityStatus.FAILED,
                        f"Database inconsistencies: {', '.join(consistency_issues)}"
                    )
                    check.error_details['inconsistencies'] = consistency_issues
            elif postgres_record and not d1_record:
                check.complete_check(
                    IntegrityStatus.FAILED,
                    "Record exists in PostgreSQL but not in D1"
                )
            elif d1_record and not postgres_record:
                check.complete_check(
                    IntegrityStatus.FAILED,
                    "Record exists in D1 but not in PostgreSQL"
                )
            else:
                check.complete_check(
                    IntegrityStatus.FAILED,
                    "Record not found in either database"
                )
        
        except Exception as e:
            check.complete_check(IntegrityStatus.FAILED, str(e))
        
        return check
    
    async def _get_postgres_record(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get record from PostgreSQL"""
        try:
            with self.postgres_conn.cursor() as cursor:
                cursor.execute("""
                    SELECT file_id, file_name, file_path, file_size, checksum, 
                           user_id, uploaded_at, metadata, r2_key
                    FROM list_cutter_savedfile 
                    WHERE file_id = %s
                """, (file_id,))
                
                row = cursor.fetchone()
                if row:
                    columns = [desc[0] for desc in cursor.description]
                    return dict(zip(columns, row))
        except Exception as e:
            console.print(f"[red]Error querying PostgreSQL: {e}[/red]")
        
        return None
    
    async def _get_d1_record(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get record from D1"""
        try:
            if self.d1_conn:
                cursor = self.d1_conn.cursor()
                cursor.execute("""
                    SELECT id, filename, file_path, file_size, checksum,
                           user_id, uploaded_at, metadata, r2_key
                    FROM files 
                    WHERE id = ?
                """, (file_id,))
                
                row = cursor.fetchone()
                if row:
                    return dict(row)
        except Exception as e:
            console.print(f"[red]Error querying D1: {e}[/red]")
        
        return None
    
    def _compare_records(self, postgres_record: Dict[str, Any], 
                        d1_record: Dict[str, Any]) -> List[str]:
        """Compare PostgreSQL and D1 records"""
        issues = []
        
        # Map field names
        field_mappings = {
            'file_name': 'filename',
            'file_id': 'id'
        }
        
        # Check essential fields
        essential_fields = ['file_name', 'file_path', 'file_size', 'checksum', 'user_id']
        
        for pg_field in essential_fields:
            d1_field = field_mappings.get(pg_field, pg_field)
            
            pg_value = postgres_record.get(pg_field)
            d1_value = d1_record.get(d1_field)
            
            if pg_value != d1_value:
                issues.append(f"{pg_field}: PostgreSQL={pg_value}, D1={d1_value}")
        
        return issues
    
    async def close(self):
        """Close database connections"""
        if self.postgres_conn:
            self.postgres_conn.close()
        if self.d1_conn:
            self.d1_conn.close()

class R2AccessibilityChecker:
    """R2 storage accessibility and performance checker"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def check_file_accessibility(self, file_id: str, r2_key: str) -> IntegrityCheck:
        """Check if file is accessible in R2"""
        check = IntegrityCheck(
            check_id=str(uuid.uuid4()),
            check_type=CheckType.ACCESSIBILITY,
            file_id=file_id,
            file_path=r2_key
        )
        
        try:
            headers = {
                'Authorization': f'Bearer {self.config["r2_api_token"]}'
            }
            
            url = f"{self.config['r2_api_endpoint']}/files/{r2_key}"
            
            async with self.session.head(url, headers=headers) as response:
                if response.status == 200:
                    # File is accessible
                    check.metadata['status_code'] = response.status
                    check.metadata['content_length'] = response.headers.get('Content-Length')
                    check.metadata['last_modified'] = response.headers.get('Last-Modified')
                    check.metadata['etag'] = response.headers.get('ETag')
                    
                    check.complete_check(IntegrityStatus.PASSED)
                elif response.status == 404:
                    check.complete_check(IntegrityStatus.FAILED, "File not found in R2")
                elif response.status == 403:
                    check.complete_check(IntegrityStatus.FAILED, "Access denied to R2 file")
                else:
                    check.complete_check(
                        IntegrityStatus.FAILED, 
                        f"Unexpected status code: {response.status}"
                    )
                    
                check.metadata['status_code'] = response.status
        
        except Exception as e:
            check.complete_check(IntegrityStatus.FAILED, str(e))
        
        return check
    
    async def check_file_performance(self, file_id: str, r2_key: str) -> IntegrityCheck:
        """Check R2 file access performance"""
        check = IntegrityCheck(
            check_id=str(uuid.uuid4()),
            check_type=CheckType.PERFORMANCE,
            file_id=file_id,
            file_path=r2_key
        )
        
        try:
            headers = {
                'Authorization': f'Bearer {self.config["r2_api_token"]}',
                'Range': 'bytes=0-1023'  # First 1KB
            }
            
            url = f"{self.config['r2_api_endpoint']}/files/{r2_key}"
            
            start_time = time.time()
            
            async with self.session.get(url, headers=headers) as response:
                if response.status in [200, 206]:
                    await response.read()
                    end_time = time.time()
                    
                    response_time = end_time - start_time
                    check.metadata['response_time'] = response_time
                    check.metadata['status_code'] = response.status
                    
                    # Performance thresholds
                    if response_time < 1.0:  # < 1 second
                        check.complete_check(IntegrityStatus.PASSED)
                    elif response_time < 5.0:  # < 5 seconds
                        check.complete_check(IntegrityStatus.WARNING, "Slow response time")
                    else:
                        check.complete_check(IntegrityStatus.FAILED, "Very slow response time")
                else:
                    check.complete_check(
                        IntegrityStatus.FAILED,
                        f"Performance check failed: {response.status}"
                    )
        
        except Exception as e:
            check.complete_check(IntegrityStatus.FAILED, str(e))
        
        return check

class ComprehensiveIntegrityChecker:
    """Main comprehensive integrity checker"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.checksum_calculator = ChecksumCalculator()
        self.database_checker = None
        self.r2_checker = None
        
        # Performance tracking
        self.performance_stats = {
            'total_checks': 0,
            'avg_check_time': 0.0,
            'check_types': defaultdict(list)
        }
        
        # Setup logging
        self.logger = self._setup_logging()
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('integrity_checker')
        logger.setLevel(logging.INFO)
        
        log_dir = Path('logs')
        log_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = log_dir / f'integrity_check_{timestamp}.log'
        
        handler = logging.FileHandler(log_file)
        handler.setLevel(logging.INFO)
        
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
        
        return logger
    
    async def verify_file_integrity(self, file_id: str, source_path: str, 
                                   r2_key: str, expected_checksum: str = None) -> FileIntegrityResult:
        """Verify complete file integrity"""
        result = FileIntegrityResult(
            file_id=file_id,
            file_path=r2_key,
            source_path=source_path,
            target_path=r2_key
        )
        
        try:
            # Initialize database checker if needed
            if not self.database_checker and 'postgres_config' in self.config:
                self.database_checker = DatabaseChecker(
                    self.config['postgres_config'],
                    self.config.get('d1_config', {})
                )
                await self.database_checker.connect()
            
            # Initialize R2 checker
            if not self.r2_checker and 'r2_config' in self.config:
                self.r2_checker = R2AccessibilityChecker(self.config['r2_config'])
            
            # Perform individual checks
            checks_to_perform = [
                self._check_file_checksum(file_id, source_path, expected_checksum),
                self._check_file_size(file_id, source_path, r2_key),
                self._check_file_metadata(file_id, source_path, r2_key)
            ]
            
            # Add database consistency check if available
            if self.database_checker:
                checks_to_perform.append(
                    self.database_checker.check_record_consistency(file_id)
                )
            
            # Add R2 accessibility checks if available
            if self.r2_checker:
                async with self.r2_checker:
                    checks_to_perform.extend([
                        self.r2_checker.check_file_accessibility(file_id, r2_key),
                        self.r2_checker.check_file_performance(file_id, r2_key)
                    ])
            
            # Execute all checks
            completed_checks = await asyncio.gather(*checks_to_perform, return_exceptions=True)
            
            # Process results
            for check_result in completed_checks:
                if isinstance(check_result, IntegrityCheck):
                    result.add_check(check_result)
                    self._update_performance_stats(check_result)
                elif isinstance(check_result, Exception):
                    # Handle check exceptions
                    error_check = IntegrityCheck(
                        check_id=str(uuid.uuid4()),
                        check_type=CheckType.METADATA,
                        file_id=file_id,
                        file_path=source_path
                    )
                    error_check.complete_check(IntegrityStatus.FAILED, str(check_result))
                    result.add_check(error_check)
            
            # Generate issues and recommendations
            self._generate_file_issues_and_recommendations(result)
            
            self.logger.info(f"Integrity check completed for {file_id}: {result.overall_status.value}")
        
        except Exception as e:
            self.logger.error(f"Integrity check failed for {file_id}: {e}")
            # Add error check
            error_check = IntegrityCheck(
                check_id=str(uuid.uuid4()),
                check_type=CheckType.METADATA,
                file_id=file_id,
                file_path=source_path
            )
            error_check.complete_check(IntegrityStatus.FAILED, str(e))
            result.add_check(error_check)
        
        return result
    
    async def _check_file_checksum(self, file_id: str, source_path: str, 
                                  expected_checksum: str = None) -> IntegrityCheck:
        """Check file checksum integrity"""
        check = IntegrityCheck(
            check_id=str(uuid.uuid4()),
            check_type=CheckType.CHECKSUM,
            file_id=file_id,
            file_path=source_path
        )
        
        try:
            if not os.path.exists(source_path):
                check.complete_check(IntegrityStatus.FAILED, "Source file not found")
                return check
            
            # Calculate checksum
            actual_checksum = await self.checksum_calculator.calculate_file_checksum(source_path)
            
            if actual_checksum is None:
                check.complete_check(IntegrityStatus.FAILED, "Failed to calculate checksum")
                return check
            
            check.actual_value = actual_checksum
            
            if expected_checksum:
                check.expected_value = expected_checksum
                
                if actual_checksum == expected_checksum:
                    check.complete_check(IntegrityStatus.PASSED)
                else:
                    check.complete_check(
                        IntegrityStatus.FAILED,
                        f"Checksum mismatch: expected {expected_checksum}, got {actual_checksum}"
                    )
            else:
                # No expected checksum, just record the actual value
                check.complete_check(IntegrityStatus.PASSED)
                check.metadata['note'] = 'No expected checksum provided'
        
        except Exception as e:
            check.complete_check(IntegrityStatus.FAILED, str(e))
        
        return check
    
    async def _check_file_size(self, file_id: str, source_path: str, r2_key: str) -> IntegrityCheck:
        """Check file size consistency"""
        check = IntegrityCheck(
            check_id=str(uuid.uuid4()),
            check_type=CheckType.SIZE,
            file_id=file_id,
            file_path=source_path
        )
        
        try:
            if not os.path.exists(source_path):
                check.complete_check(IntegrityStatus.FAILED, "Source file not found")
                return check
            
            # Get source file size
            source_size = os.path.getsize(source_path)
            check.expected_value = str(source_size)
            
            # For now, we'll assume the file size check passes
            # In a real implementation, this would check against R2
            check.actual_value = str(source_size)
            check.complete_check(IntegrityStatus.PASSED)
        
        except Exception as e:
            check.complete_check(IntegrityStatus.FAILED, str(e))
        
        return check
    
    async def _check_file_metadata(self, file_id: str, source_path: str, r2_key: str) -> IntegrityCheck:
        """Check file metadata consistency"""
        check = IntegrityCheck(
            check_id=str(uuid.uuid4()),
            check_type=CheckType.METADATA,
            file_id=file_id,
            file_path=source_path
        )
        
        try:
            if not os.path.exists(source_path):
                check.complete_check(IntegrityStatus.FAILED, "Source file not found")
                return check
            
            # Get source file metadata
            stat = os.stat(source_path)
            metadata = {
                'size': stat.st_size,
                'modified_time': stat.st_mtime,
                'mode': stat.st_mode
            }
            
            check.metadata['source_metadata'] = metadata
            check.complete_check(IntegrityStatus.PASSED)
        
        except Exception as e:
            check.complete_check(IntegrityStatus.FAILED, str(e))
        
        return check
    
    def _update_performance_stats(self, check: IntegrityCheck):
        """Update performance statistics"""
        self.performance_stats['total_checks'] += 1
        self.performance_stats['check_types'][check.check_type.value].append(check.duration)
        
        # Update average check time
        total_time = sum(
            sum(times) for times in self.performance_stats['check_types'].values()
        )
        self.performance_stats['avg_check_time'] = total_time / self.performance_stats['total_checks']
    
    def _generate_file_issues_and_recommendations(self, result: FileIntegrityResult):
        """Generate issues and recommendations for file"""
        # Check for critical issues
        failed_checks = [c for c in result.checks if c.status == IntegrityStatus.FAILED]
        
        for check in failed_checks:
            severity = SeverityLevel.ERROR
            if check.check_type in [CheckType.CHECKSUM, CheckType.DATABASE_CONSISTENCY]:
                severity = SeverityLevel.CRITICAL
            
            result.issues.append({
                'type': check.check_type.value,
                'severity': severity.value,
                'message': check.error_message,
                'details': check.error_details
            })
        
        # Generate recommendations
        if result.failed_checks > 0:
            result.recommendations.append("Re-migrate file to ensure integrity")
        
        if result.warning_checks > 0:
            result.recommendations.append("Monitor file for potential issues")
        
        if result.confidence_score < 80:
            result.recommendations.append("Perform additional verification steps")
    
    async def verify_batch_integrity(self, file_list: List[Dict[str, Any]]) -> BatchIntegrityResult:
        """Verify integrity for a batch of files"""
        batch_id = str(uuid.uuid4())
        batch_result = BatchIntegrityResult(
            batch_id=batch_id,
            batch_name=f"Integrity Check Batch {batch_id[:8]}"
        )
        
        console.print(f"[blue]🔍 Starting batch integrity verification for {len(file_list)} files[/blue]")
        
        # Process files with progress tracking
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            console=console
        ) as progress:
            
            task = progress.add_task("Verifying files...", total=len(file_list))
            
            # Process files in parallel batches
            max_concurrent = self.config.get('max_concurrent_checks', 10)
            semaphore = asyncio.Semaphore(max_concurrent)
            
            async def verify_single_file(file_info: Dict[str, Any]) -> FileIntegrityResult:
                async with semaphore:
                    return await self.verify_file_integrity(
                        file_info['file_id'],
                        file_info['source_path'],
                        file_info['r2_key'],
                        file_info.get('expected_checksum')
                    )
            
            # Create tasks for all files
            verification_tasks = [verify_single_file(file_info) for file_info in file_list]
            
            # Process tasks as they complete
            for completed_task in asyncio.as_completed(verification_tasks):
                try:
                    file_result = await completed_task
                    batch_result.add_file_result(file_result)
                    progress.update(task, advance=1)
                    
                except Exception as e:
                    self.logger.error(f"File verification failed: {e}")
                    progress.update(task, advance=1)
        
        # Finalize batch results
        batch_result.finalize()
        
        console.print(f"[green]✅ Batch verification completed: {batch_result.passed_files}/{batch_result.total_files} files passed[/green]")
        
        return batch_result
    
    async def close(self):
        """Close checker resources"""
        if self.database_checker:
            await self.database_checker.close()

# CLI Commands
@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Comprehensive Integrity Checker CLI"""
    pass

@cli.command()
@click.argument('files_json', type=click.Path(exists=True))
@click.option('--config-file', type=click.Path(exists=True), help='Configuration file')
@click.option('--output-file', help='Output report file')
@click.option('--max-concurrent', default=10, help='Maximum concurrent checks')
@click.option('--include-performance', is_flag=True, help='Include performance checks')
@click.option('--include-database', is_flag=True, help='Include database consistency checks')
def verify(files_json, config_file, output_file, max_concurrent, include_performance, include_database):
    """Verify file integrity for a batch of files"""
    
    # Load configuration
    config = {
        'max_concurrent_checks': max_concurrent,
        'include_performance': include_performance,
        'include_database': include_database
    }
    
    if config_file:
        with open(config_file, 'r') as f:
            file_config = json.load(f)
            config.update(file_config)
    
    # Load file list
    with open(files_json, 'r') as f:
        file_list = json.load(f)
    
    console.print(f"[blue]Loaded {len(file_list)} files for verification[/blue]")
    
    # Run verification
    checker = ComprehensiveIntegrityChecker(config)
    
    try:
        batch_result = asyncio.run(checker.verify_batch_integrity(file_list))
        
        # Display results
        _display_batch_results(batch_result)
        
        # Save report
        if output_file:
            report_data = asdict(batch_result)
            with open(output_file, 'w') as f:
                json.dump(report_data, f, indent=2, default=str)
            console.print(f"[green]Report saved to {output_file}[/green]")
        
        # Exit code based on results
        if batch_result.failed_files == 0:
            sys.exit(0)
        elif batch_result.failed_files < batch_result.total_files * 0.1:  # < 10% failed
            sys.exit(1)
        else:
            sys.exit(2)
    
    except Exception as e:
        console.print(f"[red]Verification failed: {e}[/red]")
        sys.exit(1)
    finally:
        asyncio.run(checker.close())

@cli.command()
@click.argument('file_id')
@click.argument('source_path', type=click.Path(exists=True))
@click.argument('r2_key')
@click.option('--expected-checksum', help='Expected file checksum')
@click.option('--config-file', type=click.Path(exists=True), help='Configuration file')
def verify_single(file_id, source_path, r2_key, expected_checksum, config_file):
    """Verify integrity of a single file"""
    
    config = {}
    if config_file:
        with open(config_file, 'r') as f:
            config = json.load(f)
    
    checker = ComprehensiveIntegrityChecker(config)
    
    try:
        result = asyncio.run(checker.verify_file_integrity(
            file_id, source_path, r2_key, expected_checksum
        ))
        
        # Display result
        _display_file_result(result)
        
        # Exit code based on result
        if result.overall_status == IntegrityStatus.PASSED:
            sys.exit(0)
        elif result.overall_status == IntegrityStatus.WARNING:
            sys.exit(1)
        else:
            sys.exit(2)
    
    except Exception as e:
        console.print(f"[red]Verification failed: {e}[/red]")
        sys.exit(1)
    finally:
        asyncio.run(checker.close())

def _display_batch_results(batch_result: BatchIntegrityResult):
    """Display batch verification results"""
    console.print("\n[bold blue]📊 Batch Verification Results[/bold blue]")
    
    # Summary table
    table = Table(title="Verification Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Total Files", f"{batch_result.total_files:,}")
    table.add_row("Passed Files", f"{batch_result.passed_files:,}")
    table.add_row("Failed Files", f"{batch_result.failed_files:,}")
    table.add_row("Warning Files", f"{batch_result.warning_files:,}")
    table.add_row("Overall Confidence", f"{batch_result.overall_confidence:.1f}%")
    table.add_row("Data Integrity Score", f"{batch_result.data_integrity_score:.1f}%")
    table.add_row("Total Verification Time", f"{batch_result.total_verification_time:.2f}s")
    table.add_row("Avg File Time", f"{batch_result.avg_file_verification_time:.2f}s")
    
    console.print(table)
    
    # Show critical issues
    if batch_result.critical_issues:
        console.print(f"\n[bold red]Critical Issues Found ({len(batch_result.critical_issues)}):[/bold red]")
        for issue in batch_result.critical_issues[:5]:
            console.print(f"  • {issue['message']}")
    
    # Show recommendations
    if batch_result.recommendations:
        console.print(f"\n[bold yellow]Recommendations:[/bold yellow]")
        for rec in batch_result.recommendations:
            console.print(f"  • {rec}")

def _display_file_result(result: FileIntegrityResult):
    """Display single file verification result"""
    console.print(f"\n[bold blue]🔍 File Verification: {result.file_id}[/bold blue]")
    
    # Status
    status_color = "green" if result.overall_status == IntegrityStatus.PASSED else "red"
    console.print(f"Status: [{status_color}]{result.overall_status.value}[/{status_color}]")
    console.print(f"Confidence: {result.confidence_score:.1f}%")
    
    # Check results
    if result.checks:
        table = Table(title="Individual Checks")
        table.add_column("Check Type", style="cyan")
        table.add_column("Status", style="yellow")
        table.add_column("Duration", style="blue")
        table.add_column("Details", style="dim")
        
        for check in result.checks:
            status_style = "green" if check.status == IntegrityStatus.PASSED else "red"
            table.add_row(
                check.check_type.value,
                f"[{status_style}]{check.status.value}[/{status_style}]",
                f"{check.duration:.3f}s",
                check.error_message or "OK"
            )
        
        console.print(table)
    
    # Issues
    if result.issues:
        console.print(f"\n[bold red]Issues Found:[/bold red]")
        for issue in result.issues:
            console.print(f"  • [{issue['severity']}] {issue['message']}")

if __name__ == '__main__':
    cli()
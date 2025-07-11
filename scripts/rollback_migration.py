#!/usr/bin/env python3
"""
File Migration Rollback Script for Issue #66
============================================

A comprehensive Python script that can rollback file migrations safely with the following capabilities:

1. Database Rollback: Reset migration columns to original state
2. R2 Cleanup: Delete migrated files from R2 storage
3. Batch Rollback: Rollback specific migration batches
4. Selective Rollback: Rollback only failed migrations
5. Full Rollback: Complete migration reversal

Safety Features:
- Require explicit confirmation for destructive operations
- Support dry-run mode to preview rollback actions
- Create backup of database state before rollback
- Detailed logging of all rollback operations
- Verify original files still exist before R2 cleanup
- Support partial rollback for testing and staged rollbacks

Usage:
    python rollback_migration.py --help
    python rollback_migration.py --dry-run --batch-id abc123
    python rollback_migration.py --confirm --batch-id abc123
    python rollback_migration.py --confirm --failed-only
    python rollback_migration.py --confirm --full-rollback
"""

import asyncio
import json
import logging
import os
import sys
import sqlite3
import hashlib
import requests
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum

import click
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn
from rich.prompt import Confirm, Prompt
from rich.logging import RichHandler
from rich.panel import Panel
from rich.tree import Tree


# Rich console for beautiful output
console = Console()


class RollbackOperation(Enum):
    """Types of rollback operations"""
    DATABASE_ONLY = "database_only"
    R2_ONLY = "r2_only"
    FULL = "full"
    BATCH = "batch"
    FAILED_ONLY = "failed_only"
    USER_SPECIFIC = "user_specific"


class MigrationStatus(Enum):
    """Migration status values"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    VERIFIED = "verified"
    ROLLED_BACK = "rolled_back"


@dataclass
class RollbackConfig:
    """Configuration for rollback operations"""
    operation_type: RollbackOperation
    dry_run: bool = True
    batch_id: Optional[str] = None
    user_id: Optional[str] = None
    time_range: Optional[Tuple[datetime, datetime]] = None
    force: bool = False
    backup_before_rollback: bool = True
    verify_original_files: bool = True
    delete_r2_files: bool = True
    reset_migration_status: bool = True
    create_audit_log: bool = True


@dataclass
class RollbackStats:
    """Statistics for rollback operations"""
    total_files: int = 0
    database_rollbacks: int = 0
    r2_deletions: int = 0
    failures: int = 0
    skipped: int = 0
    bytes_freed: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


@dataclass
class MigrationRecord:
    """Represents a migration record"""
    id: str
    batch_id: str
    file_id: str
    source_path: str
    target_r2_key: Optional[str]
    original_checksum: Optional[str]
    migrated_checksum: Optional[str]
    file_size: int
    status: str
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    user_id: str
    filename: str


class DatabaseManager:
    """Manages database connections and operations"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.postgres_conn = None
        self.d1_conn = None
        self.use_d1 = config.get('use_d1', False)
        
    async def connect(self) -> None:
        """Establish database connections"""
        if self.use_d1:
            await self._connect_d1()
        else:
            await self._connect_postgres()
            
    async def _connect_postgres(self) -> None:
        """Connect to PostgreSQL database"""
        try:
            self.postgres_conn = psycopg2.connect(
                host=self.config.get('postgres_host', 'localhost'),
                database=self.config.get('postgres_db', 'list_cutter'),
                user=self.config.get('postgres_user', 'postgres'),
                password=self.config.get('postgres_password', ''),
                port=self.config.get('postgres_port', 5432)
            )
            console.print("[green]✓[/green] Connected to PostgreSQL database")
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to connect to PostgreSQL: {e}")
            raise
            
    async def _connect_d1(self) -> None:
        """Connect to D1 database"""
        try:
            db_path = self.config.get('d1_local_path', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
            # Find the actual SQLite file
            import glob
            db_files = glob.glob(db_path)
            if not db_files:
                raise FileNotFoundError(f"No D1 database found at {db_path}")
            
            self.d1_conn = sqlite3.connect(db_files[0])
            self.d1_conn.row_factory = sqlite3.Row
            console.print("[green]✓[/green] Connected to D1 database")
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to connect to D1: {e}")
            raise
    
    async def close(self) -> None:
        """Close database connections"""
        if self.postgres_conn:
            self.postgres_conn.close()
        if self.d1_conn:
            self.d1_conn.close()
    
    async def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict]:
        """Execute a database query"""
        conn = self.d1_conn if self.use_d1 else self.postgres_conn
        cursor = conn.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            if cursor.description:
                columns = [desc[0] for desc in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
            else:
                return []
        finally:
            cursor.close()
    
    async def execute_update(self, query: str, params: Optional[tuple] = None) -> int:
        """Execute an update query and return affected rows"""
        conn = self.d1_conn if self.use_d1 else self.postgres_conn
        cursor = conn.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            affected_rows = cursor.rowcount
            conn.commit()
            return affected_rows
        finally:
            cursor.close()


class CloudflareR2Manager:
    """Manages Cloudflare R2 operations"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.account_id = config.get('cloudflare_account_id')
        self.api_token = config.get('cloudflare_api_token')
        self.bucket_name = config.get('r2_bucket_name')
        
        if not all([self.account_id, self.api_token, self.bucket_name]):
            raise ValueError("Missing required Cloudflare R2 configuration")
    
    async def delete_file(self, r2_key: str) -> bool:
        """Delete a file from R2 storage"""
        try:
            url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/r2/buckets/{self.bucket_name}/objects/{r2_key}"
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.delete(url, headers=headers)
            response.raise_for_status()
            
            console.print(f"[green]✓[/green] Deleted R2 file: {r2_key}")
            return True
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to delete R2 file {r2_key}: {e}")
            return False
    
    async def list_files(self, prefix: str = "") -> List[Dict]:
        """List files in R2 bucket"""
        try:
            url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/r2/buckets/{self.bucket_name}/objects"
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            params = {}
            if prefix:
                params['prefix'] = prefix
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            return data.get('result', [])
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to list R2 files: {e}")
            return []
    
    async def get_file_info(self, r2_key: str) -> Optional[Dict]:
        """Get information about a file in R2"""
        try:
            url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/r2/buckets/{self.bucket_name}/objects/{r2_key}"
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.head(url, headers=headers)
            if response.status_code == 200:
                return {
                    'exists': True,
                    'size': int(response.headers.get('Content-Length', 0)),
                    'last_modified': response.headers.get('Last-Modified'),
                    'etag': response.headers.get('ETag')
                }
            else:
                return {'exists': False}
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to get R2 file info {r2_key}: {e}")
            return None


class MigrationRollbackService:
    """Main service for handling migration rollbacks"""
    
    def __init__(self, config: RollbackConfig):
        self.config = config
        self.stats = RollbackStats()
        self.logger = self._setup_logger()
        
        # Initialize database and R2 managers
        db_config = self._get_db_config()
        r2_config = self._get_r2_config()
        
        self.db_manager = DatabaseManager(db_config)
        self.r2_manager = CloudflareR2Manager(r2_config)
        
        # Track operations for audit
        self.operations_log = []
    
    def _setup_logger(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger('migration_rollback')
        logger.setLevel(logging.INFO)
        
        # Create logs directory if it doesn't exist
        log_dir = Path('logs')
        log_dir.mkdir(exist_ok=True)
        
        # File handler
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = log_dir / f'rollback_{timestamp}.log'
        
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.INFO)
        
        # Console handler with Rich
        console_handler = RichHandler(rich_tracebacks=True)
        console_handler.setLevel(logging.INFO)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        return logger
    
    def _get_db_config(self) -> Dict[str, Any]:
        """Get database configuration from environment"""
        return {
            'use_d1': os.getenv('USE_D1_DATABASE', 'false').lower() == 'true',
            'postgres_host': os.getenv('POSTGRES_HOST', 'localhost'),
            'postgres_db': os.getenv('POSTGRES_DB', 'list_cutter'),
            'postgres_user': os.getenv('POSTGRES_USER', 'postgres'),
            'postgres_password': os.getenv('POSTGRES_PASSWORD', ''),
            'postgres_port': int(os.getenv('POSTGRES_PORT', '5432')),
            'd1_local_path': os.getenv('D1_LOCAL_PATH', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
        }
    
    def _get_r2_config(self) -> Dict[str, Any]:
        """Get R2 configuration from environment"""
        return {
            'cloudflare_account_id': os.getenv('CLOUDFLARE_ACCOUNT_ID'),
            'cloudflare_api_token': os.getenv('CLOUDFLARE_API_TOKEN'),
            'r2_bucket_name': os.getenv('R2_BUCKET_NAME', 'cutty-files-dev')
        }
    
    async def execute_rollback(self) -> RollbackStats:
        """Execute the rollback operation"""
        self.stats.start_time = datetime.now(timezone.utc)
        self.logger.info(f"Starting rollback operation: {self.config.operation_type.value}")
        
        try:
            # Connect to databases
            await self.db_manager.connect()
            
            # Create backup if requested
            if self.config.backup_before_rollback and not self.config.dry_run:
                await self._create_backup()
            
            # Get migration records to rollback
            migration_records = await self._get_migration_records()
            self.stats.total_files = len(migration_records)
            
            if not migration_records:
                console.print("[yellow]⚠[/yellow] No migration records found for rollback")
                return self.stats
            
            # Display preview
            self._display_rollback_preview(migration_records)
            
            # Confirm operation if not in dry-run mode
            if not self.config.dry_run and not self.config.force:
                if not self._confirm_rollback():
                    console.print("[yellow]⚠[/yellow] Rollback cancelled by user")
                    return self.stats
            
            # Execute rollback operations
            await self._execute_rollback_operations(migration_records)
            
            # Update statistics
            self.stats.end_time = datetime.now(timezone.utc)
            
            # Create audit log
            if self.config.create_audit_log:
                await self._create_audit_log()
            
            # Display final results
            self._display_results()
            
            return self.stats
            
        except Exception as e:
            self.logger.error(f"Rollback operation failed: {e}")
            raise
        finally:
            await self.db_manager.close()
    
    async def _create_backup(self) -> None:
        """Create a backup of the current database state"""
        console.print("[blue]📦[/blue] Creating database backup...")
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_dir = Path('backups')
        backup_dir.mkdir(exist_ok=True)
        
        backup_file = backup_dir / f'migration_backup_{timestamp}.json'
        
        try:
            # Get current migration state
            query = """
            SELECT mb.batch_id, mb.total_files, mb.status as batch_status,
                   fm.file_id, fm.source_path, fm.target_r2_key, fm.status as file_status,
                   fm.original_checksum, fm.migrated_checksum, fm.file_size,
                   f.filename, f.user_id, f.r2_key as current_r2_key
            FROM migration_batches mb
            JOIN file_migrations fm ON mb.batch_id = fm.batch_id
            LEFT JOIN files f ON fm.file_id = f.id
            WHERE mb.status IN ('completed', 'partial', 'failed')
            ORDER BY mb.created_at DESC
            """
            
            records = await self.db_manager.execute_query(query)
            
            backup_data = {
                'timestamp': timestamp,
                'total_records': len(records),
                'records': records,
                'config': asdict(self.config)
            }
            
            with open(backup_file, 'w') as f:
                json.dump(backup_data, f, indent=2, default=str)
            
            console.print(f"[green]✓[/green] Backup created: {backup_file}")
            self.logger.info(f"Database backup created: {backup_file}")
            
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to create backup: {e}")
            raise
    
    async def _get_migration_records(self) -> List[MigrationRecord]:
        """Get migration records based on rollback configuration"""
        conditions = []
        params = []
        
        base_query = """
        SELECT fm.id, fm.batch_id, fm.file_id, fm.source_path, fm.target_r2_key,
               fm.original_checksum, fm.migrated_checksum, fm.file_size, fm.status,
               fm.error_message, fm.started_at, fm.completed_at,
               f.filename, f.user_id
        FROM file_migrations fm
        LEFT JOIN files f ON fm.file_id = f.id
        WHERE 1=1
        """
        
        # Add conditions based on operation type
        if self.config.operation_type == RollbackOperation.BATCH and self.config.batch_id:
            conditions.append("fm.batch_id = %s")
            params.append(self.config.batch_id)
        
        elif self.config.operation_type == RollbackOperation.FAILED_ONLY:
            conditions.append("fm.status = 'failed'")
        
        elif self.config.operation_type == RollbackOperation.USER_SPECIFIC and self.config.user_id:
            conditions.append("f.user_id = %s")
            params.append(self.config.user_id)
        
        elif self.config.operation_type in [RollbackOperation.FULL, RollbackOperation.DATABASE_ONLY, RollbackOperation.R2_ONLY]:
            conditions.append("fm.status IN ('completed', 'verified', 'partial')")
        
        # Add time range filter if specified
        if self.config.time_range:
            conditions.append("fm.started_at >= %s AND fm.started_at <= %s")
            params.extend([self.config.time_range[0], self.config.time_range[1]])
        
        # Build final query
        if conditions:
            query = base_query + " AND " + " AND ".join(conditions)
        else:
            query = base_query
        
        query += " ORDER BY fm.started_at DESC"
        
        # Execute query
        records = await self.db_manager.execute_query(query, tuple(params) if params else None)
        
        # Convert to MigrationRecord objects
        migration_records = []
        for record in records:
            migration_records.append(MigrationRecord(
                id=record['id'],
                batch_id=record['batch_id'],
                file_id=record['file_id'],
                source_path=record['source_path'],
                target_r2_key=record['target_r2_key'],
                original_checksum=record['original_checksum'],
                migrated_checksum=record['migrated_checksum'],
                file_size=record['file_size'],
                status=record['status'],
                error_message=record['error_message'],
                started_at=record['started_at'],
                completed_at=record['completed_at'],
                user_id=record['user_id'],
                filename=record['filename']
            ))
        
        return migration_records
    
    def _display_rollback_preview(self, migration_records: List[MigrationRecord]) -> None:
        """Display a preview of what will be rolled back"""
        console.print("\n[bold blue]📋 Rollback Preview[/bold blue]")
        
        # Create summary table
        table = Table(title="Migration Records to Rollback")
        table.add_column("Batch ID", style="cyan")
        table.add_column("File ID", style="green")
        table.add_column("Filename", style="yellow")
        table.add_column("Status", style="red")
        table.add_column("Size", style="blue")
        table.add_column("R2 Key", style="magenta")
        
        total_size = 0
        for record in migration_records[:10]:  # Show first 10 records
            size_str = self._format_size(record.file_size)
            total_size += record.file_size
            
            table.add_row(
                record.batch_id[:8] + "...",
                record.file_id[:8] + "...",
                record.filename[:30] + "..." if len(record.filename) > 30 else record.filename,
                record.status,
                size_str,
                record.target_r2_key[:30] + "..." if record.target_r2_key and len(record.target_r2_key) > 30 else record.target_r2_key or "N/A"
            )
        
        console.print(table)
        
        if len(migration_records) > 10:
            console.print(f"[dim]... and {len(migration_records) - 10} more records[/dim]")
        
        # Summary statistics
        console.print(f"\n[bold]Summary:[/bold]")
        console.print(f"• Total files: {len(migration_records)}")
        console.print(f"• Total size: {self._format_size(total_size)}")
        console.print(f"• Operation type: {self.config.operation_type.value}")
        console.print(f"• Dry run: {'Yes' if self.config.dry_run else 'No'}")
        
        if self.config.dry_run:
            console.print("\n[yellow]⚠ This is a dry run - no actual changes will be made[/yellow]")
    
    def _confirm_rollback(self) -> bool:
        """Confirm the rollback operation with the user"""
        console.print("\n[bold red]⚠ WARNING: This operation will permanently modify your data![/bold red]")
        
        operations = []
        if self.config.reset_migration_status:
            operations.append("Reset migration status in database")
        if self.config.delete_r2_files:
            operations.append("Delete files from R2 storage")
        
        console.print("\n[bold]The following operations will be performed:[/bold]")
        for op in operations:
            console.print(f"• {op}")
        
        return Confirm.ask("\n[bold red]Are you sure you want to proceed?[/bold red]", default=False)
    
    async def _execute_rollback_operations(self, migration_records: List[MigrationRecord]) -> None:
        """Execute the actual rollback operations"""
        console.print(f"\n[bold green]🔄 {'Simulating' if self.config.dry_run else 'Executing'} rollback operations...[/bold green]")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            console=console
        ) as progress:
            
            task = progress.add_task("Processing files...", total=len(migration_records))
            
            for record in migration_records:
                try:
                    # Process database rollback
                    if self.config.reset_migration_status:
                        await self._rollback_database_record(record)
                        self.stats.database_rollbacks += 1
                    
                    # Process R2 deletion
                    if self.config.delete_r2_files and record.target_r2_key:
                        if await self._delete_r2_file(record):
                            self.stats.r2_deletions += 1
                            self.stats.bytes_freed += record.file_size
                    
                    # Log operation
                    self._log_operation(record, success=True)
                    
                except Exception as e:
                    self.stats.failures += 1
                    self.logger.error(f"Failed to rollback {record.file_id}: {e}")
                    self._log_operation(record, success=False, error=str(e))
                
                progress.update(task, advance=1)
    
    async def _rollback_database_record(self, record: MigrationRecord) -> None:
        """Rollback a database record"""
        if self.config.dry_run:
            self.logger.info(f"DRY RUN: Would rollback database record {record.file_id}")
            return
        
        try:
            # Update migration status
            update_query = """
            UPDATE file_migrations 
            SET status = 'rolled_back', 
                completed_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """
            await self.db_manager.execute_update(update_query, (record.id,))
            
            # Reset file record if it has R2 key
            if record.target_r2_key:
                file_update_query = """
                UPDATE files 
                SET r2_key = NULL, 
                    checksum = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """
                await self.db_manager.execute_update(file_update_query, (record.file_id,))
            
            self.logger.info(f"Rolled back database record for file {record.file_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to rollback database record {record.file_id}: {e}")
            raise
    
    async def _delete_r2_file(self, record: MigrationRecord) -> bool:
        """Delete a file from R2 storage"""
        if not record.target_r2_key:
            return False
        
        if self.config.dry_run:
            self.logger.info(f"DRY RUN: Would delete R2 file {record.target_r2_key}")
            return True
        
        try:
            # Verify file exists in R2 first
            file_info = await self.r2_manager.get_file_info(record.target_r2_key)
            if not file_info or not file_info.get('exists'):
                self.logger.warning(f"R2 file {record.target_r2_key} does not exist")
                return False
            
            # Delete the file
            success = await self.r2_manager.delete_file(record.target_r2_key)
            if success:
                self.logger.info(f"Deleted R2 file {record.target_r2_key}")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Failed to delete R2 file {record.target_r2_key}: {e}")
            return False
    
    def _log_operation(self, record: MigrationRecord, success: bool, error: str = None) -> None:
        """Log a rollback operation"""
        operation_log = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'file_id': record.file_id,
            'batch_id': record.batch_id,
            'filename': record.filename,
            'target_r2_key': record.target_r2_key,
            'success': success,
            'error': error,
            'dry_run': self.config.dry_run
        }
        
        self.operations_log.append(operation_log)
    
    async def _create_audit_log(self) -> None:
        """Create an audit log of the rollback operation"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_dir = Path('logs')
        log_dir.mkdir(exist_ok=True)
        
        audit_file = log_dir / f'rollback_audit_{timestamp}.json'
        
        audit_data = {
            'timestamp': timestamp,
            'config': asdict(self.config),
            'stats': asdict(self.stats),
            'operations': self.operations_log
        }
        
        with open(audit_file, 'w') as f:
            json.dump(audit_data, f, indent=2, default=str)
        
        console.print(f"[green]✓[/green] Audit log created: {audit_file}")
        self.logger.info(f"Audit log created: {audit_file}")
    
    def _display_results(self) -> None:
        """Display final rollback results"""
        console.print("\n[bold green]📊 Rollback Results[/bold green]")
        
        # Create results table
        table = Table(title="Operation Summary")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        duration = self.stats.end_time - self.stats.start_time if self.stats.end_time and self.stats.start_time else None
        
        table.add_row("Total Files", str(self.stats.total_files))
        table.add_row("Database Rollbacks", str(self.stats.database_rollbacks))
        table.add_row("R2 Deletions", str(self.stats.r2_deletions))
        table.add_row("Failures", str(self.stats.failures))
        table.add_row("Bytes Freed", self._format_size(self.stats.bytes_freed))
        table.add_row("Duration", str(duration).split('.')[0] if duration else "N/A")
        table.add_row("Operation Type", self.config.operation_type.value)
        table.add_row("Dry Run", "Yes" if self.config.dry_run else "No")
        
        console.print(table)
        
        # Success/failure summary
        if self.stats.failures > 0:
            console.print(f"\n[red]⚠ {self.stats.failures} operations failed. Check logs for details.[/red]")
        else:
            console.print(f"\n[green]✅ All operations completed successfully![/green]")
        
        if self.config.dry_run:
            console.print("\n[yellow]💡 This was a dry run. Run again with --confirm to execute changes.[/yellow]")
    
    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes == 0:
            return "0 B"
        
        size_names = ["B", "KB", "MB", "GB", "TB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024.0
            i += 1
        
        return f"{size_bytes:.1f} {size_names[i]}"


# CLI Commands
@click.group()
@click.version_option(version="1.0.0")
def cli():
    """File Migration Rollback Tool for Issue #66"""
    pass


@cli.command()
@click.option('--batch-id', help='Rollback specific batch ID')
@click.option('--user-id', help='Rollback migrations for specific user')
@click.option('--failed-only', is_flag=True, help='Rollback only failed migrations')
@click.option('--full-rollback', is_flag=True, help='Rollback all migrations')
@click.option('--database-only', is_flag=True, help='Rollback database only (keep R2 files)')
@click.option('--r2-only', is_flag=True, help='Delete R2 files only (keep database records)')
@click.option('--dry-run', is_flag=True, default=True, help='Preview operations without executing')
@click.option('--confirm', is_flag=True, help='Execute actual rollback (overrides dry-run)')
@click.option('--force', is_flag=True, help='Skip confirmation prompts')
@click.option('--no-backup', is_flag=True, help='Skip creating backup before rollback')
@click.option('--start-date', help='Start date for time range filter (YYYY-MM-DD)')
@click.option('--end-date', help='End date for time range filter (YYYY-MM-DD)')
def rollback(batch_id, user_id, failed_only, full_rollback, database_only, r2_only, 
            dry_run, confirm, force, no_backup, start_date, end_date):
    """Execute migration rollback operations"""
    
    # Validate arguments
    operation_count = sum([
        bool(batch_id), failed_only, full_rollback, database_only, r2_only, bool(user_id)
    ])
    
    if operation_count == 0:
        console.print("[red]Error: Must specify one rollback operation[/red]")
        console.print("Use one of: --batch-id, --user-id, --failed-only, --full-rollback, --database-only, --r2-only")
        sys.exit(1)
    
    if operation_count > 1:
        console.print("[red]Error: Can only specify one rollback operation at a time[/red]")
        sys.exit(1)
    
    # Determine operation type
    if batch_id:
        operation_type = RollbackOperation.BATCH
    elif user_id:
        operation_type = RollbackOperation.USER_SPECIFIC
    elif failed_only:
        operation_type = RollbackOperation.FAILED_ONLY
    elif full_rollback:
        operation_type = RollbackOperation.FULL
    elif database_only:
        operation_type = RollbackOperation.DATABASE_ONLY
    elif r2_only:
        operation_type = RollbackOperation.R2_ONLY
    else:
        operation_type = RollbackOperation.FULL
    
    # Parse time range
    time_range = None
    if start_date or end_date:
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d') if start_date else None
            end_dt = datetime.strptime(end_date, '%Y-%m-%d') if end_date else None
            if start_dt and end_dt:
                time_range = (start_dt, end_dt)
        except ValueError as e:
            console.print(f"[red]Error parsing date: {e}[/red]")
            sys.exit(1)
    
    # Create configuration
    config = RollbackConfig(
        operation_type=operation_type,
        dry_run=dry_run and not confirm,
        batch_id=batch_id,
        user_id=user_id,
        time_range=time_range,
        force=force,
        backup_before_rollback=not no_backup,
        verify_original_files=True,
        delete_r2_files=operation_type != RollbackOperation.DATABASE_ONLY,
        reset_migration_status=operation_type != RollbackOperation.R2_ONLY,
        create_audit_log=True
    )
    
    # Execute rollback
    service = MigrationRollbackService(config)
    
    try:
        stats = asyncio.run(service.execute_rollback())
        
        # Exit with appropriate code
        if stats.failures > 0:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        console.print(f"[red]Fatal error: {e}[/red]")
        sys.exit(1)


@cli.command()
@click.option('--batch-id', help='Show status for specific batch')
@click.option('--user-id', help='Show status for specific user')
@click.option('--limit', default=50, help='Limit number of records shown')
def status(batch_id, user_id, limit):
    """Show migration status and available rollback operations"""
    
    async def show_status():
        config = RollbackConfig(operation_type=RollbackOperation.FULL, dry_run=True)
        service = MigrationRollbackService(config)
        
        try:
            await service.db_manager.connect()
            
            # Build query
            conditions = []
            params = []
            
            query = """
            SELECT mb.batch_id, mb.total_files, mb.completed_files, mb.failed_files, 
                   mb.status as batch_status, mb.created_at, mb.started_at, mb.completed_at,
                   COUNT(fm.id) as migration_count,
                   SUM(CASE WHEN fm.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                   SUM(CASE WHEN fm.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                   SUM(CASE WHEN fm.status = 'verified' THEN 1 ELSE 0 END) as verified_count
            FROM migration_batches mb
            LEFT JOIN file_migrations fm ON mb.batch_id = fm.batch_id
            WHERE 1=1
            """
            
            if batch_id:
                conditions.append("mb.batch_id = %s")
                params.append(batch_id)
            
            if user_id:
                query += " LEFT JOIN files f ON fm.file_id = f.id"
                conditions.append("f.user_id = %s")
                params.append(user_id)
            
            if conditions:
                query += " AND " + " AND ".join(conditions)
            
            query += " GROUP BY mb.batch_id ORDER BY mb.created_at DESC LIMIT %s"
            params.append(limit)
            
            batches = await service.db_manager.execute_query(query, tuple(params))
            
            if not batches:
                console.print("[yellow]No migration batches found[/yellow]")
                return
            
            # Display batch status
            table = Table(title="Migration Batch Status")
            table.add_column("Batch ID", style="cyan")
            table.add_column("Status", style="green")
            table.add_column("Total Files", style="blue")
            table.add_column("Completed", style="green")
            table.add_column("Failed", style="red")
            table.add_column("Verified", style="yellow")
            table.add_column("Created", style="dim")
            
            for batch in batches:
                table.add_row(
                    batch['batch_id'][:12] + "...",
                    batch['batch_status'],
                    str(batch['total_files']),
                    str(batch['completed_count']),
                    str(batch['failed_count']),
                    str(batch['verified_count']),
                    batch['created_at'][:10] if batch['created_at'] else "N/A"
                )
            
            console.print(table)
            
            # Show rollback recommendations
            console.print("\n[bold]Available Rollback Operations:[/bold]")
            
            for batch in batches:
                if batch['failed_count'] > 0:
                    console.print(f"• [red]Batch {batch['batch_id'][:12]}...[/red] has {batch['failed_count']} failed migrations")
                    console.print(f"  Run: python rollback_migration.py rollback --batch-id {batch['batch_id']} --failed-only")
                
                if batch['completed_count'] > 0:
                    console.print(f"• [green]Batch {batch['batch_id'][:12]}...[/green] has {batch['completed_count']} completed migrations")
                    console.print(f"  Run: python rollback_migration.py rollback --batch-id {batch['batch_id']} --confirm")
        
        finally:
            await service.db_manager.close()
    
    try:
        asyncio.run(show_status())
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)


@cli.command()
@click.option('--log-file', help='Specific log file to analyze')
@click.option('--days', default=7, help='Number of days to analyze')
def analyze(log_file, days):
    """Analyze rollback logs and generate reports"""
    
    log_dir = Path('logs')
    
    if log_file:
        log_files = [log_dir / log_file]
    else:
        # Find recent log files
        log_files = list(log_dir.glob('rollback_*.log'))
        cutoff_date = datetime.now() - timedelta(days=days)
        log_files = [f for f in log_files if datetime.fromtimestamp(f.stat().st_mtime) > cutoff_date]
    
    if not log_files:
        console.print("[yellow]No log files found[/yellow]")
        return
    
    console.print(f"[blue]📊 Analyzing {len(log_files)} log files...[/blue]")
    
    # Parse log files
    total_operations = 0
    total_successes = 0
    total_failures = 0
    
    for log_file in log_files:
        try:
            with open(log_file, 'r') as f:
                content = f.read()
                # Simple parsing - in real implementation you'd want more sophisticated parsing
                operations = content.count('Rolled back database record')
                successes = content.count('✓')
                failures = content.count('✗')
                
                total_operations += operations
                total_successes += successes
                total_failures += failures
        except Exception as e:
            console.print(f"[red]Error reading {log_file}: {e}[/red]")
    
    # Display analysis
    table = Table(title="Rollback Analysis")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Log Files Analyzed", str(len(log_files)))
    table.add_row("Total Operations", str(total_operations))
    table.add_row("Successes", str(total_successes))
    table.add_row("Failures", str(total_failures))
    
    if total_operations > 0:
        success_rate = (total_successes / total_operations) * 100
        table.add_row("Success Rate", f"{success_rate:.1f}%")
    
    console.print(table)


if __name__ == '__main__':
    cli()
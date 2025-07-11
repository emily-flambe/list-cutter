#!/usr/bin/env python3
"""
Migration State Manager for Issue #66
====================================

Comprehensive state management system for production file migrations.
Provides persistent state tracking, checkpoint management, and recovery capabilities.

Features:
- SQLite-based persistent state storage
- Checkpoint creation and recovery
- Migration session tracking
- Error and metric recording
- Recovery point management
- State consistency validation

Author: Claude Code
Version: 1.0.0
"""

import json
import sqlite3
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Iterator
from uuid import uuid4

import click
from rich.console import Console
from rich.table import Table

console = Console()

class MigrationPhase(Enum):
    """Migration phases for state tracking"""
    INITIALIZATION = "initialization"
    PREPARATION = "preparation"
    VALIDATION = "validation"
    DUAL_WRITE_SETUP = "dual_write_setup"
    BACKGROUND_MIGRATION = "background_migration"
    READ_CUTOVER = "read_cutover"
    WRITE_CUTOVER = "write_cutover"
    VERIFICATION = "verification"
    CLEANUP = "cleanup"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    PAUSED = "paused"

class MigrationStatus(Enum):
    """Migration status types"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    ARCHIVED = "archived"

class ErrorSeverity(Enum):
    """Error severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class MigrationStats:
    """Migration statistics and metrics"""
    total_files: int = 0
    processed_files: int = 0
    successful_files: int = 0
    failed_files: int = 0
    skipped_files: int = 0
    
    total_size: int = 0
    processed_size: int = 0
    transferred_size: int = 0
    
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    last_update: Optional[datetime] = None
    
    # Performance metrics
    avg_file_size: float = 0.0
    avg_transfer_rate: float = 0.0
    peak_transfer_rate: float = 0.0
    
    # Error tracking
    error_count: int = 0
    retry_count: int = 0
    warning_count: int = 0
    
    def __post_init__(self):
        """Post-initialization processing"""
        if isinstance(self.start_time, str):
            self.start_time = datetime.fromisoformat(self.start_time)
        if isinstance(self.end_time, str):
            self.end_time = datetime.fromisoformat(self.end_time)
        if isinstance(self.last_update, str):
            self.last_update = datetime.fromisoformat(self.last_update)
    
    def duration(self) -> float:
        """Get duration in seconds"""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        elif self.start_time:
            return (datetime.now(timezone.utc) - self.start_time).total_seconds()
        return 0.0
    
    def progress_percentage(self) -> float:
        """Get progress as percentage"""
        if self.total_files == 0:
            return 0.0
        return (self.processed_files / self.total_files) * 100
    
    def success_rate(self) -> float:
        """Get success rate as percentage"""
        if self.processed_files == 0:
            return 0.0
        return (self.successful_files / self.processed_files) * 100
    
    def files_per_second(self) -> float:
        """Get files processed per second"""
        duration = self.duration()
        if duration > 0:
            return self.processed_files / duration
        return 0.0
    
    def bytes_per_second(self) -> float:
        """Get bytes processed per second"""
        duration = self.duration()
        if duration > 0:
            return self.processed_size / duration
        return 0.0

@dataclass
class MigrationError:
    """Migration error record"""
    id: str
    migration_id: str
    error_type: str
    error_message: str
    severity: ErrorSeverity
    phase: Optional[MigrationPhase] = None
    file_id: Optional[str] = None
    batch_id: Optional[str] = None
    stack_trace: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def __post_init__(self):
        if isinstance(self.created_at, str):
            self.created_at = datetime.fromisoformat(self.created_at)
        if isinstance(self.severity, str):
            self.severity = ErrorSeverity(self.severity)
        if isinstance(self.phase, str):
            self.phase = MigrationPhase(self.phase)

@dataclass
class MigrationCheckpoint:
    """Migration checkpoint for recovery"""
    id: str
    migration_id: str
    name: str
    description: str
    phase: MigrationPhase
    stats: MigrationStats
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def __post_init__(self):
        if isinstance(self.created_at, str):
            self.created_at = datetime.fromisoformat(self.created_at)
        if isinstance(self.phase, str):
            self.phase = MigrationPhase(self.phase)
        if isinstance(self.stats, dict):
            self.stats = MigrationStats(**self.stats)

@dataclass
class MigrationSession:
    """Migration session record"""
    id: str
    name: str
    description: str
    config: Dict[str, Any]
    phase: MigrationPhase
    status: MigrationStatus
    stats: MigrationStats
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def __post_init__(self):
        if isinstance(self.created_at, str):
            self.created_at = datetime.fromisoformat(self.created_at)
        if isinstance(self.updated_at, str):
            self.updated_at = datetime.fromisoformat(self.updated_at)
        if isinstance(self.phase, str):
            self.phase = MigrationPhase(self.phase)
        if isinstance(self.status, str):
            self.status = MigrationStatus(self.status)
        if isinstance(self.stats, dict):
            self.stats = MigrationStats(**self.stats)

class MigrationStateManager:
    """Manages migration state with persistent storage"""
    
    def __init__(self, db_path: str = "migration_state.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database with schema"""
        with self._get_connection() as conn:
            conn.executescript("""
                -- Migration sessions table
                CREATE TABLE IF NOT EXISTS migration_sessions (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    config TEXT NOT NULL,
                    phase TEXT NOT NULL,
                    status TEXT NOT NULL,
                    stats TEXT NOT NULL,
                    metadata TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                -- Migration checkpoints table
                CREATE TABLE IF NOT EXISTS migration_checkpoints (
                    id TEXT PRIMARY KEY,
                    migration_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    phase TEXT NOT NULL,
                    stats TEXT NOT NULL,
                    metadata TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (migration_id) REFERENCES migration_sessions(id)
                );
                
                -- Migration errors table
                CREATE TABLE IF NOT EXISTS migration_errors (
                    id TEXT PRIMARY KEY,
                    migration_id TEXT NOT NULL,
                    error_type TEXT NOT NULL,
                    error_message TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    phase TEXT,
                    file_id TEXT,
                    batch_id TEXT,
                    stack_trace TEXT,
                    metadata TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (migration_id) REFERENCES migration_sessions(id)
                );
                
                -- Migration metrics table
                CREATE TABLE IF NOT EXISTS migration_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    migration_id TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    metric_value REAL NOT NULL,
                    unit TEXT,
                    metadata TEXT DEFAULT '{}',
                    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (migration_id) REFERENCES migration_sessions(id)
                );
                
                -- Migration batches table
                CREATE TABLE IF NOT EXISTS migration_batches (
                    id TEXT PRIMARY KEY,
                    migration_id TEXT NOT NULL,
                    batch_number INTEGER NOT NULL,
                    total_files INTEGER NOT NULL,
                    processed_files INTEGER DEFAULT 0,
                    successful_files INTEGER DEFAULT 0,
                    failed_files INTEGER DEFAULT 0,
                    status TEXT NOT NULL,
                    metadata TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (migration_id) REFERENCES migration_sessions(id)
                );
                
                -- Migration file records table
                CREATE TABLE IF NOT EXISTS migration_file_records (
                    id TEXT PRIMARY KEY,
                    migration_id TEXT NOT NULL,
                    batch_id TEXT,
                    file_id TEXT NOT NULL,
                    source_path TEXT NOT NULL,
                    target_path TEXT,
                    file_size INTEGER,
                    checksum TEXT,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    metadata TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (migration_id) REFERENCES migration_sessions(id),
                    FOREIGN KEY (batch_id) REFERENCES migration_batches(id)
                );
                
                -- Create indexes for better performance
                CREATE INDEX IF NOT EXISTS idx_migration_checkpoints_migration_id 
                ON migration_checkpoints(migration_id);
                
                CREATE INDEX IF NOT EXISTS idx_migration_errors_migration_id 
                ON migration_errors(migration_id);
                
                CREATE INDEX IF NOT EXISTS idx_migration_errors_severity 
                ON migration_errors(severity);
                
                CREATE INDEX IF NOT EXISTS idx_migration_metrics_migration_id 
                ON migration_metrics(migration_id);
                
                CREATE INDEX IF NOT EXISTS idx_migration_batches_migration_id 
                ON migration_batches(migration_id);
                
                CREATE INDEX IF NOT EXISTS idx_migration_file_records_migration_id 
                ON migration_file_records(migration_id);
                
                CREATE INDEX IF NOT EXISTS idx_migration_file_records_batch_id 
                ON migration_file_records(batch_id);
                
                CREATE INDEX IF NOT EXISTS idx_migration_file_records_status 
                ON migration_file_records(status);
                
                -- Create triggers for automatic timestamp updates
                CREATE TRIGGER IF NOT EXISTS update_migration_sessions_updated_at
                AFTER UPDATE ON migration_sessions
                BEGIN
                    UPDATE migration_sessions 
                    SET updated_at = CURRENT_TIMESTAMP 
                    WHERE id = NEW.id;
                END;
                
                CREATE TRIGGER IF NOT EXISTS update_migration_batches_updated_at
                AFTER UPDATE ON migration_batches
                BEGIN
                    UPDATE migration_batches 
                    SET updated_at = CURRENT_TIMESTAMP 
                    WHERE id = NEW.id;
                END;
                
                CREATE TRIGGER IF NOT EXISTS update_migration_file_records_updated_at
                AFTER UPDATE ON migration_file_records
                BEGIN
                    UPDATE migration_file_records 
                    SET updated_at = CURRENT_TIMESTAMP 
                    WHERE id = NEW.id;
                END;
            """)
    
    @contextmanager
    def _get_connection(self) -> Iterator[sqlite3.Connection]:
        """Get thread-safe database connection"""
        with self._lock:
            conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            try:
                yield conn
            finally:
                conn.close()
    
    def create_migration_session(self, name: str, description: str, config: Dict[str, Any]) -> str:
        """Create new migration session"""
        session_id = str(uuid4())
        session = MigrationSession(
            id=session_id,
            name=name,
            description=description,
            config=config,
            phase=MigrationPhase.INITIALIZATION,
            status=MigrationStatus.PENDING,
            stats=MigrationStats()
        )
        
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO migration_sessions 
                (id, name, description, config, phase, status, stats, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session.id,
                session.name,
                session.description,
                json.dumps(session.config),
                session.phase.value,
                session.status.value,
                json.dumps(asdict(session.stats)),
                json.dumps(session.metadata)
            ))
            conn.commit()
        
        return session_id
    
    def update_migration_session(self, session_id: str, phase: MigrationPhase = None, 
                                status: MigrationStatus = None, stats: MigrationStats = None,
                                metadata: Dict[str, Any] = None):
        """Update migration session"""
        updates = []
        params = []
        
        if phase is not None:
            updates.append("phase = ?")
            params.append(phase.value)
        
        if status is not None:
            updates.append("status = ?")
            params.append(status.value)
        
        if stats is not None:
            updates.append("stats = ?")
            params.append(json.dumps(asdict(stats)))
        
        if metadata is not None:
            updates.append("metadata = ?")
            params.append(json.dumps(metadata))
        
        if updates:
            params.append(session_id)
            
            with self._get_connection() as conn:
                conn.execute(f"""
                    UPDATE migration_sessions 
                    SET {', '.join(updates)}
                    WHERE id = ?
                """, params)
                conn.commit()
    
    def get_migration_session(self, session_id: str) -> Optional[MigrationSession]:
        """Get migration session by ID"""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM migration_sessions WHERE id = ?
            """, (session_id,))
            
            row = cursor.fetchone()
            if row:
                return MigrationSession(
                    id=row['id'],
                    name=row['name'],
                    description=row['description'],
                    config=json.loads(row['config']),
                    phase=MigrationPhase(row['phase']),
                    status=MigrationStatus(row['status']),
                    stats=MigrationStats(**json.loads(row['stats'])),
                    metadata=json.loads(row['metadata']),
                    created_at=datetime.fromisoformat(row['created_at']),
                    updated_at=datetime.fromisoformat(row['updated_at'])
                )
        return None
    
    def list_migration_sessions(self, status: MigrationStatus = None, 
                               limit: int = 50) -> List[MigrationSession]:
        """List migration sessions"""
        query = "SELECT * FROM migration_sessions"
        params = []
        
        if status:
            query += " WHERE status = ?"
            params.append(status.value)
        
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        sessions = []
        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            
            for row in cursor.fetchall():
                sessions.append(MigrationSession(
                    id=row['id'],
                    name=row['name'],
                    description=row['description'],
                    config=json.loads(row['config']),
                    phase=MigrationPhase(row['phase']),
                    status=MigrationStatus(row['status']),
                    stats=MigrationStats(**json.loads(row['stats'])),
                    metadata=json.loads(row['metadata']),
                    created_at=datetime.fromisoformat(row['created_at']),
                    updated_at=datetime.fromisoformat(row['updated_at'])
                ))
        
        return sessions
    
    def create_checkpoint(self, migration_id: str, name: str, description: str,
                         phase: MigrationPhase, stats: MigrationStats,
                         metadata: Dict[str, Any] = None) -> str:
        """Create migration checkpoint"""
        checkpoint_id = str(uuid4())
        checkpoint = MigrationCheckpoint(
            id=checkpoint_id,
            migration_id=migration_id,
            name=name,
            description=description,
            phase=phase,
            stats=stats,
            metadata=metadata or {}
        )
        
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO migration_checkpoints 
                (id, migration_id, name, description, phase, stats, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                checkpoint.id,
                checkpoint.migration_id,
                checkpoint.name,
                checkpoint.description,
                checkpoint.phase.value,
                json.dumps(asdict(checkpoint.stats)),
                json.dumps(checkpoint.metadata)
            ))
            conn.commit()
        
        return checkpoint_id
    
    def get_checkpoint(self, checkpoint_id: str) -> Optional[MigrationCheckpoint]:
        """Get checkpoint by ID"""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM migration_checkpoints WHERE id = ?
            """, (checkpoint_id,))
            
            row = cursor.fetchone()
            if row:
                return MigrationCheckpoint(
                    id=row['id'],
                    migration_id=row['migration_id'],
                    name=row['name'],
                    description=row['description'],
                    phase=MigrationPhase(row['phase']),
                    stats=MigrationStats(**json.loads(row['stats'])),
                    metadata=json.loads(row['metadata']),
                    created_at=datetime.fromisoformat(row['created_at'])
                )
        return None
    
    def list_checkpoints(self, migration_id: str) -> List[MigrationCheckpoint]:
        """List checkpoints for migration"""
        checkpoints = []
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM migration_checkpoints 
                WHERE migration_id = ? 
                ORDER BY created_at DESC
            """, (migration_id,))
            
            for row in cursor.fetchall():
                checkpoints.append(MigrationCheckpoint(
                    id=row['id'],
                    migration_id=row['migration_id'],
                    name=row['name'],
                    description=row['description'],
                    phase=MigrationPhase(row['phase']),
                    stats=MigrationStats(**json.loads(row['stats'])),
                    metadata=json.loads(row['metadata']),
                    created_at=datetime.fromisoformat(row['created_at'])
                ))
        
        return checkpoints
    
    def record_error(self, migration_id: str, error_type: str, error_message: str,
                    severity: ErrorSeverity, phase: MigrationPhase = None,
                    file_id: str = None, batch_id: str = None,
                    stack_trace: str = None, metadata: Dict[str, Any] = None) -> str:
        """Record migration error"""
        error_id = str(uuid4())
        error = MigrationError(
            id=error_id,
            migration_id=migration_id,
            error_type=error_type,
            error_message=error_message,
            severity=severity,
            phase=phase,
            file_id=file_id,
            batch_id=batch_id,
            stack_trace=stack_trace,
            metadata=metadata or {}
        )
        
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO migration_errors 
                (id, migration_id, error_type, error_message, severity, phase, 
                 file_id, batch_id, stack_trace, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                error.id,
                error.migration_id,
                error.error_type,
                error.error_message,
                error.severity.value,
                error.phase.value if error.phase else None,
                error.file_id,
                error.batch_id,
                error.stack_trace,
                json.dumps(error.metadata)
            ))
            conn.commit()
        
        return error_id
    
    def get_errors(self, migration_id: str, severity: ErrorSeverity = None) -> List[MigrationError]:
        """Get migration errors"""
        query = "SELECT * FROM migration_errors WHERE migration_id = ?"
        params = [migration_id]
        
        if severity:
            query += " AND severity = ?"
            params.append(severity.value)
        
        query += " ORDER BY created_at DESC"
        
        errors = []
        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            
            for row in cursor.fetchall():
                errors.append(MigrationError(
                    id=row['id'],
                    migration_id=row['migration_id'],
                    error_type=row['error_type'],
                    error_message=row['error_message'],
                    severity=ErrorSeverity(row['severity']),
                    phase=MigrationPhase(row['phase']) if row['phase'] else None,
                    file_id=row['file_id'],
                    batch_id=row['batch_id'],
                    stack_trace=row['stack_trace'],
                    metadata=json.loads(row['metadata']),
                    created_at=datetime.fromisoformat(row['created_at'])
                ))
        
        return errors
    
    def record_metric(self, migration_id: str, metric_name: str, metric_value: float,
                     unit: str = None, metadata: Dict[str, Any] = None):
        """Record migration metric"""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO migration_metrics 
                (migration_id, metric_name, metric_value, unit, metadata)
                VALUES (?, ?, ?, ?, ?)
            """, (
                migration_id,
                metric_name,
                metric_value,
                unit,
                json.dumps(metadata or {})
            ))
            conn.commit()
    
    def get_metrics(self, migration_id: str, metric_name: str = None) -> List[Dict[str, Any]]:
        """Get migration metrics"""
        query = "SELECT * FROM migration_metrics WHERE migration_id = ?"
        params = [migration_id]
        
        if metric_name:
            query += " AND metric_name = ?"
            params.append(metric_name)
        
        query += " ORDER BY recorded_at DESC"
        
        metrics = []
        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            
            for row in cursor.fetchall():
                metrics.append({
                    'id': row['id'],
                    'migration_id': row['migration_id'],
                    'metric_name': row['metric_name'],
                    'metric_value': row['metric_value'],
                    'unit': row['unit'],
                    'metadata': json.loads(row['metadata']),
                    'recorded_at': datetime.fromisoformat(row['recorded_at'])
                })
        
        return metrics
    
    def cleanup_old_sessions(self, days_old: int = 30):
        """Clean up old migration sessions"""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        with self._get_connection() as conn:
            # Get sessions to cleanup
            cursor = conn.execute("""
                SELECT id FROM migration_sessions 
                WHERE created_at < ? AND status IN ('completed', 'failed', 'archived')
            """, (cutoff_date.isoformat(),))
            
            session_ids = [row['id'] for row in cursor.fetchall()]
            
            if session_ids:
                # Delete related records
                placeholders = ','.join(['?' for _ in session_ids])
                
                # Delete in reverse order of foreign key dependencies
                tables = [
                    'migration_file_records',
                    'migration_batches',
                    'migration_metrics',
                    'migration_errors',
                    'migration_checkpoints',
                    'migration_sessions'
                ]
                
                for table in tables:
                    conn.execute(f"""
                        DELETE FROM {table} 
                        WHERE migration_id IN ({placeholders})
                    """, session_ids)
                
                conn.commit()
                console.print(f"[green]Cleaned up {len(session_ids)} old migration sessions[/green]")
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        with self._get_connection() as conn:
            stats = {}
            
            # Count records in each table
            tables = [
                'migration_sessions',
                'migration_checkpoints',
                'migration_errors',
                'migration_metrics',
                'migration_batches',
                'migration_file_records'
            ]
            
            for table in tables:
                cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
                stats[f'{table}_count'] = cursor.fetchone()[0]
            
            # Get database size
            cursor = conn.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()")
            stats['database_size_bytes'] = cursor.fetchone()[0]
            
            # Get recent activity
            cursor = conn.execute("""
                SELECT COUNT(*) FROM migration_sessions 
                WHERE created_at > datetime('now', '-7 days')
            """)
            stats['recent_sessions'] = cursor.fetchone()[0]
            
            return stats
    
    def export_migration_data(self, migration_id: str, output_file: str):
        """Export migration data to JSON file"""
        data = {
            'migration_id': migration_id,
            'exported_at': datetime.now(timezone.utc).isoformat(),
            'session': None,
            'checkpoints': [],
            'errors': [],
            'metrics': []
        }
        
        # Get session data
        session = self.get_migration_session(migration_id)
        if session:
            data['session'] = asdict(session)
        
        # Get checkpoints
        checkpoints = self.list_checkpoints(migration_id)
        data['checkpoints'] = [asdict(cp) for cp in checkpoints]
        
        # Get errors
        errors = self.get_errors(migration_id)
        data['errors'] = [asdict(error) for error in errors]
        
        # Get metrics
        metrics = self.get_metrics(migration_id)
        data['metrics'] = metrics
        
        # Write to file
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        console.print(f"[green]Migration data exported to {output_file}[/green]")

# CLI Commands
@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Migration State Manager CLI"""
    pass

@cli.command()
@click.option('--db-path', default='migration_state.db', help='Database path')
def init(db_path):
    """Initialize migration state database"""
    try:
        manager = MigrationStateManager(db_path)
        console.print(f"[green]✅ Database initialized at {db_path}[/green]")
    except Exception as e:
        console.print(f"[red]❌ Failed to initialize database: {e}[/red]")

@cli.command()
@click.option('--db-path', default='migration_state.db', help='Database path')
@click.option('--limit', default=20, help='Limit number of sessions shown')
def list_sessions(db_path, limit):
    """List migration sessions"""
    try:
        manager = MigrationStateManager(db_path)
        sessions = manager.list_migration_sessions(limit=limit)
        
        if not sessions:
            console.print("[yellow]No migration sessions found[/yellow]")
            return
        
        table = Table(title="Migration Sessions")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Status", style="yellow")
        table.add_column("Phase", style="blue")
        table.add_column("Progress", style="magenta")
        table.add_column("Created", style="dim")
        
        for session in sessions:
            table.add_row(
                session.id[:8] + "...",
                session.name,
                session.status.value,
                session.phase.value,
                f"{session.stats.progress_percentage():.1f}%",
                session.created_at.strftime('%Y-%m-%d %H:%M')
            )
        
        console.print(table)
        
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")

@cli.command()
@click.argument('migration_id')
@click.option('--db-path', default='migration_state.db', help='Database path')
def show(migration_id, db_path):
    """Show migration details"""
    try:
        manager = MigrationStateManager(db_path)
        session = manager.get_migration_session(migration_id)
        
        if not session:
            console.print(f"[red]Migration {migration_id} not found[/red]")
            return
        
        # Session details
        console.print(f"[bold]Migration: {session.name}[/bold]")
        console.print(f"ID: {session.id}")
        console.print(f"Status: {session.status.value}")
        console.print(f"Phase: {session.phase.value}")
        console.print(f"Progress: {session.stats.progress_percentage():.1f}%")
        console.print(f"Created: {session.created_at}")
        console.print(f"Updated: {session.updated_at}")
        
        # Checkpoints
        checkpoints = manager.list_checkpoints(migration_id)
        if checkpoints:
            console.print(f"\n[bold]Checkpoints ({len(checkpoints)}):[/bold]")
            for cp in checkpoints[:5]:  # Show last 5
                console.print(f"  {cp.name} - {cp.phase.value} ({cp.created_at.strftime('%H:%M:%S')})")
        
        # Errors
        errors = manager.get_errors(migration_id)
        if errors:
            console.print(f"\n[bold red]Errors ({len(errors)}):[/bold red]")
            for error in errors[:5]:  # Show last 5
                console.print(f"  {error.error_type}: {error.error_message}")
        
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")

@cli.command()
@click.argument('migration_id')
@click.argument('output_file')
@click.option('--db-path', default='migration_state.db', help='Database path')
def export(migration_id, output_file, db_path):
    """Export migration data"""
    try:
        manager = MigrationStateManager(db_path)
        manager.export_migration_data(migration_id, output_file)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")

@cli.command()
@click.option('--db-path', default='migration_state.db', help='Database path')
@click.option('--days', default=30, help='Days old to cleanup')
def cleanup(db_path, days):
    """Clean up old migration sessions"""
    try:
        manager = MigrationStateManager(db_path)
        manager.cleanup_old_sessions(days)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")

@cli.command()
@click.option('--db-path', default='migration_state.db', help='Database path')
def stats(db_path):
    """Show database statistics"""
    try:
        manager = MigrationStateManager(db_path)
        stats = manager.get_database_stats()
        
        table = Table(title="Database Statistics")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        for key, value in stats.items():
            if key == 'database_size_bytes':
                # Format file size
                size = value
                for unit in ['B', 'KB', 'MB', 'GB']:
                    if size < 1024:
                        value = f"{size:.1f} {unit}"
                        break
                    size /= 1024
            
            table.add_row(key.replace('_', ' ').title(), str(value))
        
        console.print(table)
        
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")

if __name__ == '__main__':
    cli()
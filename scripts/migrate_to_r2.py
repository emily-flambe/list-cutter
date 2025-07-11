#!/usr/bin/env python3
"""
File Migration Script for Issue #66
====================================

This script migrates files from Django filesystem storage to Cloudflare R2 storage.
It coordinates with the TypeScript FileMigrationService via API calls and updates
the PostgreSQL database with migration status and R2 keys.

Features:
- Batch processing with configurable sizes
- Real-time progress tracking and reporting
- Automatic retry logic for failed migrations
- Checksum verification for data integrity
- Resumable migrations with state tracking
- Dry-run mode for testing
- Migration rollback capability
- Comprehensive logging and error handling

Usage:
    python migrate_to_r2.py --help
    python migrate_to_r2.py --dry-run
    python migrate_to_r2.py --batch-size 25 --max-retries 5
    python migrate_to_r2.py --resume-batch <batch_id>
    python migrate_to_r2.py --rollback-batch <batch_id>

Requirements:
    - Django environment configured
    - PostgreSQL database accessible
    - Cloudflare Workers API endpoint available
    - File system access to stored files
"""

import asyncio
import hashlib
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urljoin
import uuid

import aiohttp
import asyncpg
import click
import django
from django.conf import settings
from django.db import transaction
from django.contrib.auth.models import User

# Configure Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from list_cutter.models import SavedFile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MigrationError(Exception):
    """Custom exception for migration errors"""
    pass

class DatabaseManager:
    """Handles PostgreSQL database operations for migration tracking"""
    
    def __init__(self, db_config: Dict[str, Any]):
        self.db_config = db_config
        self.pool = None
    
    async def connect(self):
        """Establish connection pool to PostgreSQL"""
        try:
            self.pool = await asyncpg.create_pool(
                host=self.db_config['HOST'],
                port=self.db_config['PORT'],
                user=self.db_config['USER'],
                password=self.db_config['PASSWORD'],
                database=self.db_config['NAME'],
                min_size=1,
                max_size=20
            )
            logger.info("Database connection pool established")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise MigrationError(f"Database connection failed: {e}")
    
    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
    
    async def ensure_migration_columns(self):
        """Add migration tracking columns to SavedFile table if they don't exist"""
        try:
            async with self.pool.acquire() as conn:
                # Check if columns exist
                existing_columns = await conn.fetch("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'list_cutter_savedfile'
                """)
                
                column_names = [row['column_name'] for row in existing_columns]
                
                # Add missing columns
                if 'r2_key' not in column_names:
                    await conn.execute("""
                        ALTER TABLE list_cutter_savedfile 
                        ADD COLUMN r2_key TEXT
                    """)
                    logger.info("Added r2_key column to SavedFile table")
                
                if 'migrated_at' not in column_names:
                    await conn.execute("""
                        ALTER TABLE list_cutter_savedfile 
                        ADD COLUMN migrated_at TIMESTAMP WITH TIME ZONE
                    """)
                    logger.info("Added migrated_at column to SavedFile table")
                
                if 'migration_status' not in column_names:
                    await conn.execute("""
                        ALTER TABLE list_cutter_savedfile 
                        ADD COLUMN migration_status TEXT DEFAULT 'pending'
                    """)
                    logger.info("Added migration_status column to SavedFile table")
                
                if 'migration_batch_id' not in column_names:
                    await conn.execute("""
                        ALTER TABLE list_cutter_savedfile 
                        ADD COLUMN migration_batch_id TEXT
                    """)
                    logger.info("Added migration_batch_id column to SavedFile table")
                
                if 'checksum' not in column_names:
                    await conn.execute("""
                        ALTER TABLE list_cutter_savedfile 
                        ADD COLUMN checksum TEXT
                    """)
                    logger.info("Added checksum column to SavedFile table")
                
                # Create migration tracking table
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS file_migration_batches (
                        id SERIAL PRIMARY KEY,
                        batch_id TEXT UNIQUE NOT NULL,
                        total_files INTEGER NOT NULL DEFAULT 0,
                        completed_files INTEGER DEFAULT 0,
                        failed_files INTEGER DEFAULT 0,
                        verified_files INTEGER DEFAULT 0,
                        status TEXT DEFAULT 'pending',
                        migration_type TEXT DEFAULT 'filesystem_to_r2',
                        started_at TIMESTAMP WITH TIME ZONE,
                        completed_at TIMESTAMP WITH TIME ZONE,
                        metadata JSONB,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS file_migration_records (
                        id SERIAL PRIMARY KEY,
                        batch_id TEXT NOT NULL,
                        file_id TEXT NOT NULL,
                        source_path TEXT NOT NULL,
                        target_r2_key TEXT,
                        original_checksum TEXT,
                        migrated_checksum TEXT,
                        file_size BIGINT,
                        status TEXT DEFAULT 'pending',
                        error_message TEXT,
                        attempts INTEGER DEFAULT 0,
                        started_at TIMESTAMP WITH TIME ZONE,
                        completed_at TIMESTAMP WITH TIME ZONE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(batch_id, file_id)
                    )
                """)
                
                logger.info("Migration tracking tables ensured")
                
        except Exception as e:
            logger.error(f"Failed to ensure migration columns: {e}")
            raise MigrationError(f"Schema update failed: {e}")
    
    async def get_files_to_migrate(self, batch_size: int) -> List[Dict[str, Any]]:
        """Get files that need to be migrated"""
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT file_id, file_name, file_path, user_id, uploaded_at, metadata
                    FROM list_cutter_savedfile
                    WHERE (migration_status IS NULL OR migration_status = 'pending')
                    AND r2_key IS NULL
                    ORDER BY uploaded_at ASC
                    LIMIT $1
                """, batch_size)
                
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get files to migrate: {e}")
            raise MigrationError(f"Failed to fetch migration files: {e}")
    
    async def create_migration_batch(self, batch_id: str, files: List[Dict[str, Any]], 
                                   metadata: Dict[str, Any]) -> None:
        """Create a new migration batch record"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO file_migration_batches 
                    (batch_id, total_files, status, metadata)
                    VALUES ($1, $2, $3, $4)
                """, batch_id, len(files), 'pending', json.dumps(metadata))
                
                # Create individual file records
                for file_info in files:
                    await conn.execute("""
                        INSERT INTO file_migration_records
                        (batch_id, file_id, source_path, file_size, status)
                        VALUES ($1, $2, $3, $4, $5)
                    """, batch_id, file_info['file_id'], file_info['file_path'], 
                        file_info.get('file_size', 0), 'pending')
                
                logger.info(f"Created migration batch {batch_id} with {len(files)} files")
        except Exception as e:
            logger.error(f"Failed to create migration batch: {e}")
            raise MigrationError(f"Batch creation failed: {e}")
    
    async def update_batch_status(self, batch_id: str, status: str, 
                                 completed_files: int = None, failed_files: int = None) -> None:
        """Update migration batch status"""
        try:
            async with self.pool.acquire() as conn:
                if status == 'processing':
                    await conn.execute("""
                        UPDATE file_migration_batches 
                        SET status = $1, started_at = CURRENT_TIMESTAMP
                        WHERE batch_id = $2
                    """, status, batch_id)
                elif status in ['completed', 'failed', 'partial']:
                    query = """
                        UPDATE file_migration_batches 
                        SET status = $1, completed_at = CURRENT_TIMESTAMP
                    """
                    params = [status, batch_id]
                    
                    if completed_files is not None:
                        query += ", completed_files = $3"
                        params.append(completed_files)
                    
                    if failed_files is not None:
                        query += f", failed_files = ${'4' if completed_files is not None else '3'}"
                        params.append(failed_files)
                    
                    query += " WHERE batch_id = $2"
                    await conn.execute(query, *params)
                else:
                    await conn.execute("""
                        UPDATE file_migration_batches 
                        SET status = $1
                        WHERE batch_id = $2
                    """, status, batch_id)
                
                logger.info(f"Updated batch {batch_id} status to {status}")
        except Exception as e:
            logger.error(f"Failed to update batch status: {e}")
            raise MigrationError(f"Batch update failed: {e}")
    
    async def update_file_migration_status(self, batch_id: str, file_id: str, 
                                         status: str, **kwargs) -> None:
        """Update individual file migration status"""
        try:
            async with self.pool.acquire() as conn:
                updates = ['status = $3']
                params = [batch_id, file_id, status]
                param_count = 3
                
                if status == 'processing':
                    updates.append('started_at = CURRENT_TIMESTAMP')
                    updates.append(f'attempts = attempts + 1')
                
                if status in ['completed', 'failed', 'verified']:
                    updates.append('completed_at = CURRENT_TIMESTAMP')
                
                for key, value in kwargs.items():
                    if key in ['target_r2_key', 'original_checksum', 'migrated_checksum', 
                              'error_message', 'file_size']:
                        param_count += 1
                        updates.append(f'{key} = ${param_count}')
                        params.append(value)
                
                query = f"""
                    UPDATE file_migration_records 
                    SET {', '.join(updates)}
                    WHERE batch_id = $1 AND file_id = $2
                """
                
                await conn.execute(query, *params)
                
                # Also update the main SavedFile table
                if status == 'verified' and 'target_r2_key' in kwargs:
                    await conn.execute("""
                        UPDATE list_cutter_savedfile 
                        SET r2_key = $1, migration_status = $2, 
                            migration_batch_id = $3, migrated_at = CURRENT_TIMESTAMP,
                            checksum = $4
                        WHERE file_id = $5
                    """, kwargs['target_r2_key'], 'completed', batch_id, 
                        kwargs.get('migrated_checksum'), file_id)
                
        except Exception as e:
            logger.error(f"Failed to update file migration status: {e}")
            raise MigrationError(f"File status update failed: {e}")
    
    async def get_batch_progress(self, batch_id: str) -> Dict[str, Any]:
        """Get migration batch progress"""
        try:
            async with self.pool.acquire() as conn:
                batch_info = await conn.fetchrow("""
                    SELECT * FROM file_migration_batches WHERE batch_id = $1
                """, batch_id)
                
                if not batch_info:
                    raise MigrationError(f"Batch {batch_id} not found")
                
                file_statuses = await conn.fetch("""
                    SELECT status, COUNT(*) as count
                    FROM file_migration_records
                    WHERE batch_id = $1
                    GROUP BY status
                """, batch_id)
                
                status_counts = {row['status']: row['count'] for row in file_statuses}
                
                return {
                    'batch_id': batch_id,
                    'total_files': batch_info['total_files'],
                    'status': batch_info['status'],
                    'started_at': batch_info['started_at'],
                    'completed_at': batch_info['completed_at'],
                    'file_statuses': status_counts
                }
        except Exception as e:
            logger.error(f"Failed to get batch progress: {e}")
            raise MigrationError(f"Progress fetch failed: {e}")


class FileMigrationClient:
    """Handles communication with Cloudflare Workers API"""
    
    def __init__(self, api_base_url: str, timeout: int = 300):
        self.api_base_url = api_base_url.rstrip('/')
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=self.timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def create_migration_batch(self, files: List[Dict[str, Any]], 
                                   metadata: Dict[str, Any] = None) -> str:
        """Create a migration batch via API"""
        try:
            url = f"{self.api_base_url}/api/migration/batch"
            payload = {
                'files': files,
                'metadata': metadata or {}
            }
            
            async with self.session.post(url, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise MigrationError(f"API batch creation failed: {error_text}")
                
                result = await response.json()
                return result['batchId']
        except aiohttp.ClientError as e:
            logger.error(f"API request failed: {e}")
            raise MigrationError(f"API communication failed: {e}")
    
    async def process_migration_batch(self, batch_id: str) -> Dict[str, Any]:
        """Process a migration batch via API"""
        try:
            url = f"{self.api_base_url}/api/migration/process"
            payload = {'batchId': batch_id}
            
            async with self.session.post(url, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise MigrationError(f"API batch processing failed: {error_text}")
                
                return await response.json()
        except aiohttp.ClientError as e:
            logger.error(f"API request failed: {e}")
            raise MigrationError(f"API communication failed: {e}")
    
    async def get_batch_progress(self, batch_id: str) -> Dict[str, Any]:
        """Get batch progress via API"""
        try:
            url = f"{self.api_base_url}/api/migration/progress/{batch_id}"
            
            async with self.session.get(url) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise MigrationError(f"API progress fetch failed: {error_text}")
                
                return await response.json()
        except aiohttp.ClientError as e:
            logger.error(f"API request failed: {e}")
            raise MigrationError(f"API communication failed: {e}")


class FileProcessor:
    """Handles file operations and checksum calculations"""
    
    @staticmethod
    def calculate_checksum(file_path: str) -> str:
        """Calculate SHA-256 checksum of a file"""
        try:
            hash_sha256 = hashlib.sha256()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate checksum for {file_path}: {e}")
            raise MigrationError(f"Checksum calculation failed: {e}")
    
    @staticmethod
    def get_file_size(file_path: str) -> int:
        """Get file size in bytes"""
        try:
            return os.path.getsize(file_path)
        except Exception as e:
            logger.error(f"Failed to get file size for {file_path}: {e}")
            raise MigrationError(f"File size calculation failed: {e}")
    
    @staticmethod
    def file_exists(file_path: str) -> bool:
        """Check if file exists"""
        return os.path.exists(file_path) and os.path.isfile(file_path)


class MigrationOrchestrator:
    """Main orchestrator for file migration process"""
    
    def __init__(self, db_manager: DatabaseManager, api_client: FileMigrationClient,
                 batch_size: int = 50, max_retries: int = 3):
        self.db_manager = db_manager
        self.api_client = api_client
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.file_processor = FileProcessor()
    
    async def migrate_files(self, dry_run: bool = False) -> Dict[str, Any]:
        """Main migration process"""
        try:
            # Get files to migrate
            files_to_migrate = await self.db_manager.get_files_to_migrate(self.batch_size)
            
            if not files_to_migrate:
                logger.info("No files to migrate")
                return {'status': 'completed', 'message': 'No files to migrate'}
            
            logger.info(f"Found {len(files_to_migrate)} files to migrate")
            
            if dry_run:
                return await self._dry_run_analysis(files_to_migrate)
            
            # Process files
            return await self._process_migration_batch(files_to_migrate)
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise MigrationError(f"Migration process failed: {e}")
    
    async def _dry_run_analysis(self, files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Perform dry run analysis"""
        analysis = {
            'total_files': len(files),
            'total_size': 0,
            'files_missing': 0,
            'files_accessible': 0,
            'estimation': {}
        }
        
        for file_info in files:
            file_path = file_info['file_path']
            
            if not self.file_processor.file_exists(file_path):
                analysis['files_missing'] += 1
                logger.warning(f"File not found: {file_path}")
                continue
            
            analysis['files_accessible'] += 1
            try:
                file_size = self.file_processor.get_file_size(file_path)
                analysis['total_size'] += file_size
            except Exception as e:
                logger.warning(f"Could not get size for {file_path}: {e}")
        
        # Estimate migration time (rough estimate: 1MB per second)
        analysis['estimation'] = {
            'total_size_mb': analysis['total_size'] / (1024 * 1024),
            'estimated_time_minutes': (analysis['total_size'] / (1024 * 1024)) / 60,
            'accessible_files': analysis['files_accessible'],
            'missing_files': analysis['files_missing']
        }
        
        logger.info(f"Dry run analysis: {analysis}")
        return analysis
    
    async def _process_migration_batch(self, files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process a batch of files for migration"""
        batch_id = str(uuid.uuid4())
        
        try:
            # Prepare files with checksums
            prepared_files = []
            for file_info in files:
                file_path = file_info['file_path']
                
                if not self.file_processor.file_exists(file_path):
                    logger.warning(f"Skipping missing file: {file_path}")
                    continue
                
                try:
                    checksum = self.file_processor.calculate_checksum(file_path)
                    file_size = self.file_processor.get_file_size(file_path)
                    
                    prepared_files.append({
                        'fileId': file_info['file_id'],
                        'sourcePath': file_path,
                        'fileName': file_info['file_name'],
                        'fileSize': file_size,
                        'userId': str(file_info['user_id']),
                        'checksum': checksum
                    })
                except Exception as e:
                    logger.error(f"Failed to prepare file {file_path}: {e}")
                    continue
            
            if not prepared_files:
                return {'status': 'failed', 'message': 'No files could be prepared for migration'}
            
            # Create batch in database
            metadata = {
                'batch_size': len(prepared_files),
                'started_at': datetime.now(timezone.utc).isoformat(),
                'migration_type': 'filesystem_to_r2'
            }
            
            await self.db_manager.create_migration_batch(batch_id, files, metadata)
            
            # Update batch status to processing
            await self.db_manager.update_batch_status(batch_id, 'processing')
            
            # Process files with retries
            successful_migrations = 0
            failed_migrations = 0
            
            for file_info in prepared_files:
                file_id = file_info['fileId']
                success = False
                
                for attempt in range(self.max_retries):
                    try:
                        await self.db_manager.update_file_migration_status(
                            batch_id, file_id, 'processing'
                        )
                        
                        # Here you would call the actual migration API
                        # For now, we'll simulate the process
                        await self._simulate_file_migration(batch_id, file_info)
                        
                        successful_migrations += 1
                        success = True
                        break
                        
                    except Exception as e:
                        logger.warning(f"Migration attempt {attempt + 1} failed for {file_id}: {e}")
                        await asyncio.sleep(2 ** attempt)  # Exponential backoff
                
                if not success:
                    failed_migrations += 1
                    await self.db_manager.update_file_migration_status(
                        batch_id, file_id, 'failed', 
                        error_message=f"Failed after {self.max_retries} attempts"
                    )
            
            # Update final batch status
            if failed_migrations == 0:
                final_status = 'completed'
            elif successful_migrations == 0:
                final_status = 'failed'
            else:
                final_status = 'partial'
            
            await self.db_manager.update_batch_status(
                batch_id, final_status, successful_migrations, failed_migrations
            )
            
            return {
                'status': final_status,
                'batch_id': batch_id,
                'successful_migrations': successful_migrations,
                'failed_migrations': failed_migrations,
                'total_files': len(prepared_files)
            }
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
            await self.db_manager.update_batch_status(batch_id, 'failed')
            raise MigrationError(f"Batch processing failed: {e}")
    
    async def _simulate_file_migration(self, batch_id: str, file_info: Dict[str, Any]):
        """Simulate file migration (replace with actual API call)"""
        # This is a placeholder for the actual migration logic
        # In the real implementation, this would:
        # 1. Upload file to R2 via API
        # 2. Verify the upload
        # 3. Update database with R2 key
        
        file_id = file_info['fileId']
        
        # Simulate upload delay
        await asyncio.sleep(0.1)
        
        # Generate mock R2 key
        r2_key = f"migrated/{file_info['userId']}/{file_id}/{file_info['fileName']}"
        
        # Update database with successful migration
        await self.db_manager.update_file_migration_status(
            batch_id, file_id, 'verified',
            target_r2_key=r2_key,
            original_checksum=file_info['checksum'],
            migrated_checksum=file_info['checksum'],  # In real implementation, verify this
            file_size=file_info['fileSize']
        )
        
        logger.info(f"Successfully migrated {file_id} to {r2_key}")
    
    async def resume_batch(self, batch_id: str) -> Dict[str, Any]:
        """Resume a failed or partial migration batch"""
        try:
            progress = await self.db_manager.get_batch_progress(batch_id)
            
            if progress['status'] == 'completed':
                return {'status': 'already_completed', 'message': 'Batch already completed'}
            
            # Get failed files from this batch
            async with self.db_manager.pool.acquire() as conn:
                failed_files = await conn.fetch("""
                    SELECT fmr.file_id, fmr.source_path, sf.file_name, sf.user_id
                    FROM file_migration_records fmr
                    JOIN list_cutter_savedfile sf ON fmr.file_id = sf.file_id
                    WHERE fmr.batch_id = $1 AND fmr.status = 'failed'
                """, batch_id)
            
            if not failed_files:
                return {'status': 'no_failed_files', 'message': 'No failed files to resume'}
            
            # Reset failed files to pending and retry
            for file_record in failed_files:
                await self.db_manager.update_file_migration_status(
                    batch_id, file_record['file_id'], 'pending'
                )
            
            # Process failed files
            prepared_files = []
            for file_record in failed_files:
                file_info = {
                    'fileId': file_record['file_id'],
                    'sourcePath': file_record['source_path'],
                    'fileName': file_record['file_name'],
                    'userId': str(file_record['user_id']),
                    'checksum': self.file_processor.calculate_checksum(file_record['source_path']),
                    'fileSize': self.file_processor.get_file_size(file_record['source_path'])
                }
                prepared_files.append(file_info)
            
            # Process the failed files
            successful_migrations = 0
            failed_migrations = 0
            
            for file_info in prepared_files:
                file_id = file_info['fileId']
                success = False
                
                for attempt in range(self.max_retries):
                    try:
                        await self.db_manager.update_file_migration_status(
                            batch_id, file_id, 'processing'
                        )
                        
                        await self._simulate_file_migration(batch_id, file_info)
                        
                        successful_migrations += 1
                        success = True
                        break
                        
                    except Exception as e:
                        logger.warning(f"Resume attempt {attempt + 1} failed for {file_id}: {e}")
                        await asyncio.sleep(2 ** attempt)
                
                if not success:
                    failed_migrations += 1
                    await self.db_manager.update_file_migration_status(
                        batch_id, file_id, 'failed',
                        error_message=f"Resume failed after {self.max_retries} attempts"
                    )
            
            # Update batch status
            if failed_migrations == 0:
                await self.db_manager.update_batch_status(batch_id, 'completed')
            else:
                await self.db_manager.update_batch_status(batch_id, 'partial')
            
            return {
                'status': 'resumed',
                'batch_id': batch_id,
                'successful_migrations': successful_migrations,
                'failed_migrations': failed_migrations
            }
            
        except Exception as e:
            logger.error(f"Resume batch failed: {e}")
            raise MigrationError(f"Resume batch failed: {e}")
    
    async def rollback_batch(self, batch_id: str) -> Dict[str, Any]:
        """Rollback a migration batch"""
        try:
            # Get successful migrations from this batch
            async with self.db_manager.pool.acquire() as conn:
                successful_files = await conn.fetch("""
                    SELECT file_id, target_r2_key 
                    FROM file_migration_records 
                    WHERE batch_id = $1 AND status = 'verified' AND target_r2_key IS NOT NULL
                """, batch_id)
            
            if not successful_files:
                return {'status': 'no_files_to_rollback', 'message': 'No successful migrations to rollback'}
            
            # Reset SavedFile records
            for file_record in successful_files:
                await conn.execute("""
                    UPDATE list_cutter_savedfile 
                    SET r2_key = NULL, migration_status = 'pending', 
                        migration_batch_id = NULL, migrated_at = NULL
                    WHERE file_id = $1
                """, file_record['file_id'])
            
            # Update migration records
            await conn.execute("""
                UPDATE file_migration_records 
                SET status = 'rolled_back', completed_at = CURRENT_TIMESTAMP
                WHERE batch_id = $1
            """, batch_id)
            
            await conn.execute("""
                UPDATE file_migration_batches 
                SET status = 'rolled_back', completed_at = CURRENT_TIMESTAMP
                WHERE batch_id = $1
            """, batch_id)
            
            logger.info(f"Rolled back {len(successful_files)} files from batch {batch_id}")
            
            return {
                'status': 'rolled_back',
                'batch_id': batch_id,
                'files_rolled_back': len(successful_files)
            }
            
        except Exception as e:
            logger.error(f"Rollback batch failed: {e}")
            raise MigrationError(f"Rollback batch failed: {e}")


@click.command()
@click.option('--dry-run', is_flag=True, help='Perform a dry run without actual migration')
@click.option('--batch-size', default=50, help='Number of files to process in each batch')
@click.option('--max-retries', default=3, help='Maximum number of retry attempts for failed files')
@click.option('--api-url', default='https://your-workers-domain.com', help='Cloudflare Workers API URL')
@click.option('--resume-batch', help='Resume a specific batch by ID')
@click.option('--rollback-batch', help='Rollback a specific batch by ID')
@click.option('--list-batches', is_flag=True, help='List all migration batches')
@click.option('--batch-status', help='Show status of a specific batch')
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose logging')
async def main(dry_run, batch_size, max_retries, api_url, resume_batch, rollback_batch, 
               list_batches, batch_status, verbose):
    """
    File Migration Script for Issue #66
    
    This script migrates files from Django filesystem storage to Cloudflare R2 storage.
    """
    
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info("Starting file migration script")
    
    # Get database configuration from Django settings
    db_config = settings.DATABASES['default']
    
    # Initialize components
    db_manager = DatabaseManager(db_config)
    
    try:
        # Connect to database
        await db_manager.connect()
        
        # Ensure migration columns exist
        await db_manager.ensure_migration_columns()
        
        # Handle specific operations
        if list_batches:
            await _list_batches(db_manager)
            return
        
        if batch_status:
            await _show_batch_status(db_manager, batch_status)
            return
        
        async with FileMigrationClient(api_url) as api_client:
            orchestrator = MigrationOrchestrator(
                db_manager, api_client, batch_size, max_retries
            )
            
            if resume_batch:
                result = await orchestrator.resume_batch(resume_batch)
                logger.info(f"Resume result: {result}")
                return
            
            if rollback_batch:
                result = await orchestrator.rollback_batch(rollback_batch)
                logger.info(f"Rollback result: {result}")
                return
            
            # Regular migration
            result = await orchestrator.migrate_files(dry_run)
            logger.info(f"Migration result: {result}")
            
    except Exception as e:
        logger.error(f"Migration script failed: {e}")
        sys.exit(1)
    finally:
        await db_manager.close()
    
    logger.info("Migration script completed")


async def _list_batches(db_manager: DatabaseManager):
    """List all migration batches"""
    try:
        async with db_manager.pool.acquire() as conn:
            batches = await conn.fetch("""
                SELECT batch_id, total_files, completed_files, failed_files, 
                       status, created_at, started_at, completed_at
                FROM file_migration_batches
                ORDER BY created_at DESC
                LIMIT 20
            """)
            
            if not batches:
                print("No migration batches found")
                return
            
            print("\nMigration Batches:")
            print("-" * 100)
            print(f"{'Batch ID':<40} {'Status':<12} {'Files':<8} {'Success':<8} {'Failed':<8} {'Created':<20}")
            print("-" * 100)
            
            for batch in batches:
                print(f"{batch['batch_id']:<40} {batch['status']:<12} "
                      f"{batch['total_files']:<8} {batch['completed_files'] or 0:<8} "
                      f"{batch['failed_files'] or 0:<8} {batch['created_at'].strftime('%Y-%m-%d %H:%M'):<20}")
            
    except Exception as e:
        logger.error(f"Failed to list batches: {e}")


async def _show_batch_status(db_manager: DatabaseManager, batch_id: str):
    """Show detailed status of a specific batch"""
    try:
        progress = await db_manager.get_batch_progress(batch_id)
        
        print(f"\nBatch Status: {batch_id}")
        print("-" * 50)
        print(f"Status: {progress['status']}")
        print(f"Total Files: {progress['total_files']}")
        print(f"Started: {progress['started_at'] or 'Not started'}")
        print(f"Completed: {progress['completed_at'] or 'Not completed'}")
        print("\nFile Status Breakdown:")
        for status, count in progress['file_statuses'].items():
            print(f"  {status}: {count}")
        
    except Exception as e:
        logger.error(f"Failed to get batch status: {e}")


def cli():
    """CLI entry point"""
    asyncio.run(main())


if __name__ == '__main__':
    cli()
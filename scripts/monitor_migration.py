#!/usr/bin/env python3
"""
Migration Monitoring Script
===========================

This script provides real-time monitoring of file migration progress.

Usage:
    python monitor_migration.py [batch_id]
    python monitor_migration.py --watch-all
"""

import asyncio
import json
import time
import click
import os
import sys
import django
from datetime import datetime
from typing import Optional, Dict, Any

# Configure Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from django.conf import settings
import asyncpg

class MigrationMonitor:
    """Monitor migration progress in real-time"""
    
    def __init__(self, db_config: Dict[str, Any]):
        self.db_config = db_config
        self.pool = None
    
    async def connect(self):
        """Connect to database"""
        self.pool = await asyncpg.create_pool(
            host=self.db_config['HOST'],
            port=self.db_config['PORT'],
            user=self.db_config['USER'],
            password=self.db_config['PASSWORD'],
            database=self.db_config['NAME'],
            min_size=1,
            max_size=5
        )
    
    async def close(self):
        """Close database connection"""
        if self.pool:
            await self.pool.close()
    
    async def get_active_batches(self) -> list:
        """Get all active migration batches"""
        try:
            async with self.pool.acquire() as conn:
                results = await conn.fetch("""
                    SELECT batch_id, total_files, completed_files, failed_files, 
                           status, started_at, created_at
                    FROM file_migration_batches
                    WHERE status IN ('pending', 'processing')
                    ORDER BY created_at DESC
                """)
                return [dict(row) for row in results]
        except Exception as e:
            print(f"Error getting active batches: {e}")
            return []
    
    async def get_batch_details(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific batch"""
        try:
            async with self.pool.acquire() as conn:
                # Get batch info
                batch_info = await conn.fetchrow("""
                    SELECT * FROM file_migration_batches WHERE batch_id = $1
                """, batch_id)
                
                if not batch_info:
                    return None
                
                # Get file status breakdown
                file_statuses = await conn.fetch("""
                    SELECT status, COUNT(*) as count
                    FROM file_migration_records
                    WHERE batch_id = $1
                    GROUP BY status
                """, batch_id)
                
                # Get recent activity
                recent_files = await conn.fetch("""
                    SELECT file_id, status, error_message, completed_at, attempts
                    FROM file_migration_records
                    WHERE batch_id = $1
                    ORDER BY COALESCE(completed_at, started_at, created_at) DESC
                    LIMIT 10
                """, batch_id)
                
                return {
                    'batch_info': dict(batch_info),
                    'file_statuses': {row['status']: row['count'] for row in file_statuses},
                    'recent_files': [dict(row) for row in recent_files]
                }
        except Exception as e:
            print(f"Error getting batch details: {e}")
            return None
    
    async def get_overall_stats(self) -> Dict[str, Any]:
        """Get overall migration statistics"""
        try:
            async with self.pool.acquire() as conn:
                # Total files in system
                total_files = await conn.fetchval("""
                    SELECT COUNT(*) FROM list_cutter_savedfile
                """)
                
                # Migrated files
                migrated_files = await conn.fetchval("""
                    SELECT COUNT(*) FROM list_cutter_savedfile
                    WHERE r2_key IS NOT NULL AND migration_status = 'completed'
                """)
                
                # Failed migrations
                failed_files = await conn.fetchval("""
                    SELECT COUNT(*) FROM list_cutter_savedfile
                    WHERE migration_status = 'failed'
                """)
                
                # Pending migrations
                pending_files = await conn.fetchval("""
                    SELECT COUNT(*) FROM list_cutter_savedfile
                    WHERE (migration_status IS NULL OR migration_status = 'pending')
                    AND r2_key IS NULL
                """)
                
                # Batch statistics
                batch_stats = await conn.fetchrow("""
                    SELECT 
                        COUNT(*) as total_batches,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed_batches,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed_batches,
                        COUNT(*) FILTER (WHERE status = 'processing') as active_batches
                    FROM file_migration_batches
                """)
                
                return {
                    'total_files': total_files,
                    'migrated_files': migrated_files,
                    'failed_files': failed_files,
                    'pending_files': pending_files,
                    'batch_stats': dict(batch_stats) if batch_stats else {}
                }
        except Exception as e:
            print(f"Error getting overall stats: {e}")
            return {}

def clear_screen():
    """Clear the terminal screen"""
    os.system('cls' if os.name == 'nt' else 'clear')

def format_timestamp(ts):
    """Format timestamp for display"""
    if ts is None:
        return "N/A"
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
    return ts.strftime("%Y-%m-%d %H:%M:%S")

def format_duration(start_time, end_time=None):
    """Format duration between timestamps"""
    if start_time is None:
        return "N/A"
    
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    
    if end_time is None:
        end_time = datetime.now(start_time.tzinfo)
    elif isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    
    duration = end_time - start_time
    total_seconds = int(duration.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    
    if hours > 0:
        return f"{hours}h {minutes}m {seconds}s"
    elif minutes > 0:
        return f"{minutes}m {seconds}s"
    else:
        return f"{seconds}s"

async def monitor_batch(monitor: MigrationMonitor, batch_id: str, watch: bool = False):
    """Monitor a specific batch"""
    
    while True:
        clear_screen()
        
        details = await monitor.get_batch_details(batch_id)
        if not details:
            print(f"Batch {batch_id} not found")
            break
        
        batch_info = details['batch_info']
        file_statuses = details['file_statuses']
        recent_files = details['recent_files']
        
        print(f"Migration Batch Monitor - {batch_id}")
        print("=" * 80)
        print(f"Status: {batch_info['status']}")
        print(f"Total Files: {batch_info['total_files']}")
        print(f"Created: {format_timestamp(batch_info['created_at'])}")
        print(f"Started: {format_timestamp(batch_info['started_at'])}")
        print(f"Completed: {format_timestamp(batch_info['completed_at'])}")
        
        if batch_info['started_at']:
            duration = format_duration(batch_info['started_at'], batch_info['completed_at'])
            print(f"Duration: {duration}")
        
        print("\nFile Status Breakdown:")
        print("-" * 40)
        for status, count in file_statuses.items():
            percentage = (count / batch_info['total_files']) * 100
            print(f"{status:12}: {count:4} ({percentage:5.1f}%)")
        
        # Progress bar
        completed = file_statuses.get('verified', 0) + file_statuses.get('completed', 0)
        failed = file_statuses.get('failed', 0)
        processing = file_statuses.get('processing', 0)
        
        progress = completed / batch_info['total_files'] * 100
        bar_length = 50
        filled_length = int(bar_length * completed // batch_info['total_files'])
        bar = '█' * filled_length + '-' * (bar_length - filled_length)
        
        print(f"\nProgress: |{bar}| {progress:.1f}%")
        print(f"Completed: {completed}, Failed: {failed}, Processing: {processing}")
        
        if recent_files:
            print("\nRecent Activity:")
            print("-" * 40)
            for file_record in recent_files[:5]:
                status = file_record['status']
                file_id = file_record['file_id'][:8] + "..."
                completed_at = format_timestamp(file_record['completed_at'])
                error = file_record['error_message']
                
                status_symbol = {
                    'verified': '✓',
                    'completed': '✓',
                    'failed': '✗',
                    'processing': '⏳',
                    'pending': '○'
                }.get(status, '?')
                
                print(f"{status_symbol} {file_id} {status:12} {completed_at}")
                if error and len(error) < 60:
                    print(f"    Error: {error}")
        
        print(f"\nLast updated: {datetime.now().strftime('%H:%M:%S')}")
        
        if not watch or batch_info['status'] in ['completed', 'failed']:
            break
        
        print("\nPress Ctrl+C to stop monitoring...")
        try:
            await asyncio.sleep(5)
        except KeyboardInterrupt:
            break

async def monitor_all_batches(monitor: MigrationMonitor, watch: bool = False):
    """Monitor all active batches"""
    
    while True:
        clear_screen()
        
        stats = await monitor.get_overall_stats()
        active_batches = await monitor.get_active_batches()
        
        print("Migration System Overview")
        print("=" * 60)
        
        if stats:
            print(f"Total Files: {stats['total_files']}")
            print(f"Migrated: {stats['migrated_files']}")
            print(f"Failed: {stats['failed_files']}")
            print(f"Pending: {stats['pending_files']}")
            
            if stats['total_files'] > 0:
                migration_progress = (stats['migrated_files'] / stats['total_files']) * 100
                print(f"Overall Progress: {migration_progress:.1f}%")
            
            batch_stats = stats.get('batch_stats', {})
            if batch_stats:
                print(f"\nBatch Statistics:")
                print(f"Total: {batch_stats.get('total_batches', 0)}")
                print(f"Completed: {batch_stats.get('completed_batches', 0)}")
                print(f"Failed: {batch_stats.get('failed_batches', 0)}")
                print(f"Active: {batch_stats.get('active_batches', 0)}")
        
        if active_batches:
            print("\nActive Batches:")
            print("-" * 60)
            print(f"{'Batch ID':<40} {'Status':<12} {'Progress':<15} {'Duration'}")
            print("-" * 60)
            
            for batch in active_batches:
                batch_id = batch['batch_id']
                status = batch['status']
                total = batch['total_files']
                completed = batch.get('completed_files', 0) or 0
                progress = f"{completed}/{total}"
                duration = format_duration(batch['started_at'])
                
                print(f"{batch_id:<40} {status:<12} {progress:<15} {duration}")
        else:
            print("\nNo active batches")
        
        print(f"\nLast updated: {datetime.now().strftime('%H:%M:%S')}")
        
        if not watch:
            break
        
        print("\nPress Ctrl+C to stop monitoring...")
        try:
            await asyncio.sleep(10)
        except KeyboardInterrupt:
            break

@click.command()
@click.argument('batch_id', required=False)
@click.option('--watch', '-w', is_flag=True, help='Watch for changes in real-time')
@click.option('--watch-all', is_flag=True, help='Watch all active batches')
@click.option('--refresh-interval', '-i', default=5, help='Refresh interval in seconds')
async def main(batch_id, watch, watch_all, refresh_interval):
    """Monitor migration progress"""
    
    # Get database configuration from Django settings
    db_config = settings.DATABASES['default']
    
    monitor = MigrationMonitor(db_config)
    
    try:
        await monitor.connect()
        
        if watch_all:
            await monitor_all_batches(monitor, watch=True)
        elif batch_id:
            await monitor_batch(monitor, batch_id, watch=watch)
        else:
            await monitor_all_batches(monitor, watch=watch)
            
    except KeyboardInterrupt:
        print("\nMonitoring stopped")
    except Exception as e:
        print(f"Monitoring failed: {e}")
    finally:
        await monitor.close()

if __name__ == '__main__':
    asyncio.run(main())
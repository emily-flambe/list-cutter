"""
Django Management Command for File Migration to R2
==================================================

This command provides a Django management interface to the file migration script.

Usage:
    python manage.py migrate_files_to_r2 --help
    python manage.py migrate_files_to_r2 --dry-run
    python manage.py migrate_files_to_r2 --batch-size 25
"""

import asyncio
import sys
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings


class Command(BaseCommand):
    help = 'Migrate files from Django filesystem storage to Cloudflare R2'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Perform a dry run without actual migration',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=50,
            help='Number of files to process in each batch (default: 50)',
        )
        parser.add_argument(
            '--max-retries',
            type=int,
            default=3,
            help='Maximum number of retry attempts for failed files (default: 3)',
        )
        parser.add_argument(
            '--api-url',
            type=str,
            default='http://localhost:8787',
            help='Cloudflare Workers API URL (default: http://localhost:8787)',
        )
        parser.add_argument(
            '--resume-batch',
            type=str,
            help='Resume a specific batch by ID',
        )
        parser.add_argument(
            '--rollback-batch',
            type=str,
            help='Rollback a specific batch by ID',
        )
        parser.add_argument(
            '--list-batches',
            action='store_true',
            help='List all migration batches',
        )
        parser.add_argument(
            '--batch-status',
            type=str,
            help='Show status of a specific batch',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Enable verbose logging',
        )

    def handle(self, *args, **options):
        """Handle the management command"""
        
        # Import the migration modules here to avoid import issues
        try:
            import sys
            import os
            from pathlib import Path
            
            # Add scripts directory to path
            scripts_dir = Path(__file__).parent.parent.parent.parent.parent / 'scripts'
            sys.path.insert(0, str(scripts_dir))
            
            from migrate_to_r2 import (
                DatabaseManager, FileMigrationClient, MigrationOrchestrator,
                _list_batches, _show_batch_status
            )
            
        except ImportError as e:
            raise CommandError(f"Failed to import migration modules: {e}")

        # Set up logging level
        if options['verbose']:
            import logging
            logging.getLogger().setLevel(logging.DEBUG)

        # Get database configuration from Django settings
        db_config = settings.DATABASES['default']
        
        # Run the migration
        try:
            asyncio.run(self._run_migration(db_config, options))
        except Exception as e:
            raise CommandError(f"Migration failed: {e}")

    async def _run_migration(self, db_config, options):
        """Run the actual migration process"""
        from migrate_to_r2 import (
            DatabaseManager, FileMigrationClient, MigrationOrchestrator,
            _list_batches, _show_batch_status
        )
        
        # Initialize database manager
        db_manager = DatabaseManager(db_config)
        
        try:
            # Connect to database
            await db_manager.connect()
            
            # Ensure migration columns exist
            await db_manager.ensure_migration_columns()
            
            # Handle specific operations
            if options['list_batches']:
                await _list_batches(db_manager)
                return
            
            if options['batch_status']:
                await _show_batch_status(db_manager, options['batch_status'])
                return
            
            async with FileMigrationClient(options['api_url']) as api_client:
                orchestrator = MigrationOrchestrator(
                    db_manager, 
                    api_client, 
                    options['batch_size'], 
                    options['max_retries']
                )
                
                if options['resume_batch']:
                    result = await orchestrator.resume_batch(options['resume_batch'])
                    self.stdout.write(
                        self.style.SUCCESS(f"Resume result: {result}")
                    )
                    return
                
                if options['rollback_batch']:
                    result = await orchestrator.rollback_batch(options['rollback_batch'])
                    self.stdout.write(
                        self.style.SUCCESS(f"Rollback result: {result}")
                    )
                    return
                
                # Regular migration
                if options['dry_run']:
                    self.stdout.write(
                        self.style.WARNING("Running in DRY-RUN mode - no files will be migrated")
                    )
                
                result = await orchestrator.migrate_files(options['dry_run'])
                
                if result['status'] == 'completed':
                    self.stdout.write(
                        self.style.SUCCESS(f"Migration completed successfully: {result}")
                    )
                elif result['status'] == 'partial':
                    self.stdout.write(
                        self.style.WARNING(f"Migration partially completed: {result}")
                    )
                else:
                    self.stdout.write(
                        self.style.ERROR(f"Migration failed: {result}")
                    )
                
        finally:
            await db_manager.close()

    def handle_dry_run_result(self, result):
        """Handle dry run results"""
        self.stdout.write("Dry Run Analysis:")
        self.stdout.write("=" * 40)
        self.stdout.write(f"Total files: {result['total_files']}")
        self.stdout.write(f"Accessible files: {result['files_accessible']}")
        self.stdout.write(f"Missing files: {result['files_missing']}")
        self.stdout.write(f"Total size: {result['total_size'] / (1024*1024):.2f} MB")
        
        estimation = result['estimation']
        self.stdout.write(f"Estimated time: {estimation['estimated_time_minutes']:.1f} minutes")
        
        if result['files_missing'] > 0:
            self.stdout.write(
                self.style.WARNING(f"Warning: {result['files_missing']} files are missing")
            )
        
        if result['files_accessible'] == 0:
            self.stdout.write(
                self.style.ERROR("Error: No files are accessible for migration")
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Ready to migrate {result['files_accessible']} files")
            )
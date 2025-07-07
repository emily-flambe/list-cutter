#!/usr/bin/env python3
"""
Migration Setup Test Script
===========================

This script tests the migration setup to ensure all components are working
before running the actual migration.

Usage:
    python test_migration_setup.py
"""

import asyncio
import os
import sys
import django
from pathlib import Path

# Configure Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

from django.conf import settings
from django.db import connection
import asyncpg
import aiohttp

async def test_database_connection():
    """Test PostgreSQL database connection"""
    print("Testing database connection...")
    
    try:
        db_config = settings.DATABASES['default']
        
        # Test Django connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            assert result[0] == 1
        
        # Test asyncpg connection
        conn = await asyncpg.connect(
            host=db_config['HOST'],
            port=db_config['PORT'],
            user=db_config['USER'],
            password=db_config['PASSWORD'],
            database=db_config['NAME']
        )
        
        result = await conn.fetchval("SELECT 1")
        assert result == 1
        await conn.close()
        
        print("✓ Database connection successful")
        return True
        
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

async def test_saved_files_table():
    """Test SavedFile table and check for existing files"""
    print("Testing SavedFile table...")
    
    try:
        from list_cutter.models import SavedFile
        
        # Count total files
        total_files = SavedFile.objects.count()
        print(f"  Total files in database: {total_files}")
        
        # Count files without R2 keys (need migration)
        files_to_migrate = SavedFile.objects.filter(
            r2_key__isnull=True
        ).count()
        print(f"  Files needing migration: {files_to_migrate}")
        
        # Sample a few files to check paths
        sample_files = SavedFile.objects.all()[:5]
        for file_obj in sample_files:
            file_path = file_obj.file_path
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                print(f"  ✓ File exists: {file_path} ({file_size} bytes)")
            else:
                print(f"  ✗ File missing: {file_path}")
        
        print("✓ SavedFile table accessible")
        return True
        
    except Exception as e:
        print(f"✗ SavedFile table test failed: {e}")
        return False

async def test_media_directory():
    """Test media directory access"""
    print("Testing media directory...")
    
    try:
        media_root = settings.MEDIA_ROOT
        print(f"  Media root: {media_root}")
        
        if os.path.exists(media_root):
            print("  ✓ Media directory exists")
            
            # Check permissions
            if os.access(media_root, os.R_OK):
                print("  ✓ Media directory readable")
            else:
                print("  ✗ Media directory not readable")
                return False
                
            # Count files
            file_count = 0
            for root, dirs, files in os.walk(media_root):
                file_count += len(files)
            
            print(f"  Files in media directory: {file_count}")
            
        else:
            print("  ✗ Media directory does not exist")
            return False
        
        print("✓ Media directory accessible")
        return True
        
    except Exception as e:
        print(f"✗ Media directory test failed: {e}")
        return False

async def test_workers_api(api_url="http://localhost:8787"):
    """Test Cloudflare Workers API connectivity"""
    print(f"Testing Workers API at {api_url}...")
    
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Test health endpoint
            async with session.get(f"{api_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"  ✓ Health check passed: {data.get('status')}")
                else:
                    print(f"  ✗ Health check failed: HTTP {response.status}")
                    return False
            
            # Test R2 connectivity
            async with session.get(f"{api_url}/test-r2") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"  ✓ R2 test passed: {data.get('status')}")
                else:
                    print(f"  ✗ R2 test failed: HTTP {response.status}")
                    return False
        
        print("✓ Workers API accessible")
        return True
        
    except Exception as e:
        print(f"✗ Workers API test failed: {e}")
        return False

def test_python_dependencies():
    """Test required Python dependencies"""
    print("Testing Python dependencies...")
    
    required_packages = [
        'click',
        'tqdm', 
        'aiohttp',
        'asyncpg',
        'django',
        'psycopg2'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"  ✓ {package}")
        except ImportError:
            print(f"  ✗ {package} (missing)")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"✗ Missing packages: {', '.join(missing_packages)}")
        print("  Install with: pip install " + " ".join(missing_packages))
        return False
    
    print("✓ All Python dependencies available")
    return True

async def test_migration_tables():
    """Test migration tracking table creation"""
    print("Testing migration tables...")
    
    try:
        db_config = settings.DATABASES['default']
        conn = await asyncpg.connect(
            host=db_config['HOST'],
            port=db_config['PORT'],
            user=db_config['USER'],
            password=db_config['PASSWORD'],
            database=db_config['NAME']
        )
        
        # Check if migration columns exist in SavedFile table
        columns = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'list_cutter_savedfile'
        """)
        
        column_names = [row['column_name'] for row in columns]
        
        migration_columns = ['r2_key', 'migrated_at', 'migration_status', 'migration_batch_id', 'checksum']
        missing_columns = [col for col in migration_columns if col not in column_names]
        
        if missing_columns:
            print(f"  Migration columns need to be added: {', '.join(missing_columns)}")
            print("  (These will be added automatically by the migration script)")
        else:
            print("  ✓ All migration columns present")
        
        await conn.close()
        
        print("✓ Migration table structure ready")
        return True
        
    except Exception as e:
        print(f"✗ Migration table test failed: {e}")
        return False

async def main():
    """Run all setup tests"""
    print("Migration Setup Test")
    print("=" * 50)
    
    tests = [
        ("Python Dependencies", test_python_dependencies),
        ("Database Connection", test_database_connection),
        ("SavedFile Table", test_saved_files_table),
        ("Media Directory", test_media_directory),
        ("Migration Tables", test_migration_tables),
        ("Workers API", test_workers_api),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        print("-" * 30)
        
        if asyncio.iscoroutinefunction(test_func):
            result = await test_func()
        else:
            result = test_func()
        
        results.append((test_name, result))
    
    print("\n" + "=" * 50)
    print("Test Results Summary:")
    print("=" * 50)
    
    all_passed = True
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
        if not result:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✓ All tests passed! Migration setup is ready.")
        print("\nNext steps:")
        print("1. Run a dry-run: python scripts/migrate_to_r2.py --dry-run")
        print("2. Start migration: python scripts/migrate_to_r2.py")
    else:
        print("✗ Some tests failed. Please fix the issues before running migration.")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
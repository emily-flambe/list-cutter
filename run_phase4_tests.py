#!/usr/bin/env python3
"""
Test runner for Phase 4 database migration
Runs comprehensive tests for D1 integration and migration pipeline
"""

import os
import sys
import unittest
import django
from django.conf import settings
from django.test.utils import get_runner

# Add app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

# Configure Django settings for testing
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

# Setup Django
django.setup()

def run_unit_tests():
    """Run unit tests that don't require Django"""
    print("=== Running Unit Tests ===")
    
    # Discover and run unit tests
    loader = unittest.TestLoader()
    start_dir = os.path.join(os.path.dirname(__file__), 'app', 'tests')
    
    # Load specific test modules
    test_modules = [
        'tests.test_d1_service',
        'tests.test_migration_pipeline'
    ]
    
    suite = unittest.TestSuite()
    
    for module_name in test_modules:
        try:
            module = __import__(module_name, fromlist=[''])
            module_tests = loader.loadTestsFromModule(module)
            suite.addTests(module_tests)
            print(f"✓ Loaded tests from {module_name}")
        except ImportError as e:
            print(f"✗ Failed to import {module_name}: {e}")
    
    # Run the tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

def run_django_tests():
    """Run Django integration tests"""
    print("\n=== Running Django Integration Tests ===")
    
    # Get Django test runner
    TestRunner = get_runner(settings)
    test_runner = TestRunner(verbosity=2, interactive=False)
    
    # Run specific test modules
    test_labels = [
        'tests.test_hybrid_service',
        'tests.test_d1_api'
    ]
    
    failures = test_runner.run_tests(test_labels)
    
    return failures == 0

def run_migration_validation_tests():
    """Run migration script validation tests"""
    print("\n=== Running Migration Script Validation ===")
    
    migration_dir = os.path.join(os.path.dirname(__file__), 'migration')
    
    # Check that migration scripts exist and are executable
    required_scripts = [
        'export_postgres_data.sh',
        'export_neo4j_data.py',
        'transform_data.py',
        'validate_transformed_data.py',
        'import_to_d1.py'
    ]
    
    all_scripts_valid = True
    
    for script in required_scripts:
        script_path = os.path.join(migration_dir, script)
        
        if not os.path.exists(script_path):
            print(f"✗ Missing migration script: {script}")
            all_scripts_valid = False
            continue
        
        if not os.access(script_path, os.X_OK):
            print(f"✗ Script not executable: {script}")
            all_scripts_valid = False
            continue
        
        print(f"✓ Migration script valid: {script}")
    
    return all_scripts_valid

def run_d1_schema_validation():
    """Validate D1 schema syntax"""
    print("\n=== Validating D1 Schema ===")
    
    schema_file = os.path.join(os.path.dirname(__file__), 'migration', 'd1_schema.sql')
    
    if not os.path.exists(schema_file):
        print("✗ D1 schema file not found")
        return False
    
    # Read and validate SQL syntax (basic validation)
    try:
        with open(schema_file, 'r') as f:
            content = f.read()
        
        # Check for required tables
        required_tables = ['users', 'saved_files', 'persons', 'file_relationships']
        for table in required_tables:
            if f"CREATE TABLE {table}" not in content:
                print(f"✗ Missing table definition: {table}")
                return False
            print(f"✓ Table definition found: {table}")
        
        # Check for indexes
        if "CREATE INDEX" not in content:
            print("✗ No indexes found in schema")
            return False
        print("✓ Indexes found in schema")
        
        # Check for foreign keys
        if "FOREIGN KEY" not in content:
            print("✗ No foreign keys found in schema")
            return False
        print("✓ Foreign keys found in schema")
        
        print("✓ D1 schema validation passed")
        return True
        
    except Exception as e:
        print(f"✗ Error validating schema: {e}")
        return False

def run_configuration_validation():
    """Validate Phase 4 configuration"""
    print("\n=== Validating Phase 4 Configuration ===")
    
    try:
        # Check wrangler.toml
        wrangler_file = os.path.join(os.path.dirname(__file__), 'wrangler.toml')
        if not os.path.exists(wrangler_file):
            print("✗ wrangler.toml not found")
            return False
        
        with open(wrangler_file, 'r') as f:
            wrangler_content = f.read()
        
        if "d1_databases" not in wrangler_content:
            print("✗ D1 database configuration not found in wrangler.toml")
            return False
        print("✓ D1 database configuration found in wrangler.toml")
        
        # Check Django settings updates
        settings_file = os.path.join(os.path.dirname(__file__), 'app', 'config', 'settings', 'base.py')
        if not os.path.exists(settings_file):
            print("✗ Django settings file not found")
            return False
        
        with open(settings_file, 'r') as f:
            settings_content = f.read()
        
        if "D1_DATABASE_CONFIG" not in settings_content:
            print("✗ D1 configuration not found in Django settings")
            return False
        print("✓ D1 configuration found in Django settings")
        
        if "PHASE_4_FEATURES" not in settings_content:
            print("✗ Phase 4 feature flags not found in Django settings")
            return False
        print("✓ Phase 4 feature flags found in Django settings")
        
        print("✓ Configuration validation passed")
        return True
        
    except Exception as e:
        print(f"✗ Error validating configuration: {e}")
        return False

def main():
    """Main test runner"""
    print("Phase 4 Database Migration - Comprehensive Test Suite")
    print("=" * 60)
    
    all_tests_passed = True
    
    # Run all test suites
    test_suites = [
        ("Configuration Validation", run_configuration_validation),
        ("D1 Schema Validation", run_d1_schema_validation),
        ("Migration Script Validation", run_migration_validation_tests),
        ("Unit Tests", run_unit_tests),
        ("Django Integration Tests", run_django_tests)
    ]
    
    results = {}
    
    for suite_name, test_function in test_suites:
        print(f"\n{suite_name}")
        print("-" * len(suite_name))
        
        try:
            result = test_function()
            results[suite_name] = result
            
            if result:
                print(f"✓ {suite_name} PASSED")
            else:
                print(f"✗ {suite_name} FAILED")
                all_tests_passed = False
                
        except Exception as e:
            print(f"✗ {suite_name} ERROR: {e}")
            results[suite_name] = False
            all_tests_passed = False
    
    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for suite_name, result in results.items():
        status = "PASSED" if result else "FAILED"
        icon = "✓" if result else "✗"
        print(f"{icon} {suite_name}: {status}")
    
    print("\n" + "=" * 60)
    
    if all_tests_passed:
        print("🎉 ALL TESTS PASSED - Phase 4 implementation ready!")
        print("\nNext steps:")
        print("1. Run migration scripts on test data")
        print("2. Enable feature flags gradually")
        print("3. Monitor performance and data integrity")
        print("4. Plan production migration")
        return 0
    else:
        print("❌ SOME TESTS FAILED - Please fix issues before proceeding")
        print("\nReview failed tests and:")
        print("1. Fix any configuration issues")
        print("2. Resolve code problems")
        print("3. Re-run tests until all pass")
        return 1

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
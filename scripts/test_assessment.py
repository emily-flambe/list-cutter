#!/usr/bin/env python3
"""
Test script for the file migration assessment tool.
This script validates the assessment functionality without requiring a full database setup.
"""

import os
import sys
import tempfile
import json
from pathlib import Path
from datetime import datetime

# Add the scripts directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from assess_file_migration import (
    FileSystemScanner, 
    CostCalculator, 
    MigrationPlanner,
    FileInfo,
    DatabaseRecord,
    format_size,
    format_time
)


def create_test_files(temp_dir: Path, num_files: int = 10) -> None:
    """Create test files for scanning."""
    uploads_dir = temp_dir / "uploads"
    generated_dir = temp_dir / "generated"
    
    uploads_dir.mkdir(parents=True)
    generated_dir.mkdir(parents=True)
    
    # Create test files with various sizes
    test_files = [
        ("uploads/small_file.txt", "Small test file content"),
        ("uploads/medium_file.csv", "header1,header2,header3\n" + "data," * 1000),
        ("uploads/user_data.json", json.dumps({"users": [{"id": i, "name": f"User{i}"} for i in range(100)]})),
        ("generated/report.pdf", "PDF content placeholder " * 100),
        ("generated/output.xlsx", "Excel content placeholder " * 200),
    ]
    
    for file_path, content in test_files:
        full_path = temp_dir / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, 'w') as f:
            f.write(content)
    
    print(f"Created {len(test_files)} test files in {temp_dir}")


def test_filesystem_scanner():
    """Test the filesystem scanner functionality."""
    print("\n=== Testing FileSystem Scanner ===")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        create_test_files(temp_path)
        
        # Test scanner
        scanner = FileSystemScanner(str(temp_path))
        files = scanner.scan_all_files()
        
        print(f"Scanned {len(files)} files")
        
        total_size = sum(f.size for f in files.values() if f.exists)
        print(f"Total size: {format_size(total_size)}")
        
        # Test file types
        file_types = {}
        for file_info in files.values():
            if file_info.exists:
                ext = Path(file_info.path).suffix.lower()
                file_types[ext] = file_types.get(ext, 0) + 1
        
        print(f"File types: {file_types}")
        
        # Test checksum calculation
        if files:
            first_file = next(iter(files.values()))
            if first_file.exists:
                checksum = scanner.calculate_checksum(first_file.path)
                print(f"Sample checksum: {checksum[:16]}..." if checksum else "Checksum failed")
        
        assert len(files) > 0, "No files found"
        assert total_size > 0, "No file size calculated"
        print("✓ FileSystem Scanner test passed")


def test_cost_calculator():
    """Test the cost calculator functionality."""
    print("\n=== Testing Cost Calculator ===")
    
    calculator = CostCalculator()
    
    # Test storage cost calculation
    test_size = 10 * 1024 ** 3  # 10GB
    storage_cost = calculator.calculate_storage_cost(test_size)
    print(f"Storage cost for {format_size(test_size)}: ${storage_cost:.2f}/month")
    
    # Test migration cost calculation
    test_files = 5000
    migration_cost = calculator.calculate_migration_cost(test_files, test_size)
    print(f"Migration cost for {test_files} files: ${migration_cost:.4f}")
    
    # Test migration time estimation
    migration_time = calculator.estimate_migration_time(test_size, test_files)
    print(f"Estimated migration time: {format_time(migration_time)}")
    
    # Test bandwidth savings
    monthly_downloads = 10000
    avg_file_size = 1024 * 1024  # 1MB
    savings = calculator.calculate_bandwidth_savings(monthly_downloads, avg_file_size)
    print(f"Monthly bandwidth savings: ${savings:.2f}")
    
    assert storage_cost > 0, "Storage cost calculation failed"
    assert migration_time > 0, "Migration time estimation failed"
    print("✓ Cost Calculator test passed")


def test_migration_planner():
    """Test the migration planner functionality."""
    print("\n=== Testing Migration Planner ===")
    
    calculator = CostCalculator()
    planner = MigrationPlanner(calculator)
    
    # Create test data
    test_data = []
    for i in range(25):
        record = DatabaseRecord(
            id=i,
            user_id=i % 5,  # 5 users
            file_id=f"file_{i}",
            file_name=f"test_file_{i}.txt",
            file_path=f"uploads/test_file_{i}.txt",
            uploaded_at=datetime.now(),
            system_tags=[],
            user_tags=[],
            metadata={}
        )
        
        file_info = FileInfo(
            path=f"/tmp/test_file_{i}.txt",
            size=1024 * (i + 1),  # Varying sizes
            modified=datetime.now(),
            exists=True
        )
        
        test_data.append((record, file_info))
    
    # Test different batching strategies
    strategies = ['size', 'date', 'user']
    
    for strategy in strategies:
        batches = planner.create_batches(
            test_data.copy(),
            strategy=strategy,
            batch_size=10
        )
        
        print(f"{strategy.title()} strategy: {len(batches)} batches")
        
        total_files = sum(len(batch.files) for batch in batches)
        total_size = sum(batch.total_size for batch in batches)
        
        print(f"  Total files: {total_files}")
        print(f"  Total size: {format_size(total_size)}")
        print(f"  Estimated time: {format_time(sum(batch.estimated_time for batch in batches))}")
        
        assert len(batches) > 0, f"No batches created for {strategy} strategy"
        assert total_files == len(test_data), f"File count mismatch for {strategy} strategy"
    
    print("✓ Migration Planner test passed")


def test_data_structures():
    """Test the data structure functionality."""
    print("\n=== Testing Data Structures ===")
    
    # Test FileInfo
    file_info = FileInfo(
        path="/tmp/test.txt",
        size=1024,
        modified=datetime.now(),
        exists=True,
        checksum="abc123",
        mime_type="text/plain"
    )
    
    assert file_info.path == "/tmp/test.txt"
    assert file_info.size == 1024
    assert file_info.exists is True
    
    # Test DatabaseRecord
    record = DatabaseRecord(
        id=1,
        user_id=1,
        file_id="test_file",
        file_name="test.txt",
        file_path="uploads/test.txt",
        uploaded_at=datetime.now(),
        system_tags=["tag1", "tag2"],
        user_tags=["user_tag"],
        metadata={"key": "value"}
    )
    
    assert record.file_name == "test.txt"
    assert len(record.system_tags) == 2
    assert record.metadata["key"] == "value"
    
    print("✓ Data Structures test passed")


def test_utility_functions():
    """Test utility functions."""
    print("\n=== Testing Utility Functions ===")
    
    # Test format_size
    test_sizes = [
        (512, "512.00 B"),
        (1024, "1.00 KB"),
        (1024 * 1024, "1.00 MB"),
        (1024 ** 3, "1.00 GB"),
        (1024 ** 4, "1.00 TB"),
    ]
    
    for size, expected in test_sizes:
        result = format_size(size)
        print(f"format_size({size}) = {result}")
        assert expected in result, f"Size formatting failed for {size}"
    
    # Test format_time
    test_times = [
        (0.5, "minutes"),
        (1.5, "hours"),
        (25.0, "days"),
    ]
    
    for time_hours, expected_unit in test_times:
        result = format_time(time_hours)
        print(f"format_time({time_hours}) = {result}")
        assert expected_unit in result, f"Time formatting failed for {time_hours}"
    
    print("✓ Utility Functions test passed")


def run_all_tests():
    """Run all tests."""
    print("Starting File Migration Assessment Tool Tests")
    print("=" * 50)
    
    try:
        test_data_structures()
        test_utility_functions()
        test_filesystem_scanner()
        test_cost_calculator()
        test_migration_planner()
        
        print("\n" + "=" * 50)
        print("🎉 All tests passed successfully!")
        print("The assessment tool is ready for use.")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
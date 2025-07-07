#!/usr/bin/env python3
"""
Demo script showing the file migration assessment tool's capabilities.
This script demonstrates the tool's functionality without requiring full database setup.
"""

import os
import sys
import json
import tempfile
from pathlib import Path
from datetime import datetime

# Mock the required modules for demonstration
class MockClick:
    def command(self): return lambda f: f
    def option(self, *args, **kwargs): return lambda f: f
    def echo(self, message, **kwargs): print(message)
    def Choice(self, choices): return str

class MockTqdm:
    def __init__(self, iterable, desc=""):
        self.iterable = iterable
        self.desc = desc
        print(f"Processing {desc}...")
    
    def __iter__(self):
        return iter(self.iterable)

# Mock modules
sys.modules['click'] = MockClick()
sys.modules['tqdm'] = MockTqdm
sys.modules['psycopg2'] = type('MockPsycopg2', (), {})()
sys.modules['pandas'] = type('MockPandas', (), {})()

# Create sample data for demonstration
def create_demo_files(temp_dir: Path):
    """Create demo files that simulate a real Django media directory."""
    uploads_dir = temp_dir / "uploads"
    generated_dir = temp_dir / "generated"
    
    uploads_dir.mkdir(parents=True)
    generated_dir.mkdir(parents=True)
    
    # Create various file types and sizes
    demo_files = [
        ("uploads/user_1/contact_list.csv", "Name,Email,Phone\nJohn Doe,john@example.com,555-1234\n" * 100),
        ("uploads/user_1/data_export.json", json.dumps({"records": [{"id": i, "data": f"entry_{i}"} for i in range(500)]})),
        ("uploads/user_2/large_dataset.csv", "col1,col2,col3,col4,col5\n" + "data," * 2000),
        ("uploads/user_2/image_list.txt", "image1.jpg\nimage2.png\nimage3.gif\n" * 50),
        ("uploads/user_3/report.pdf", "PDF content placeholder " * 300),
        ("generated/monthly_report_2024_01.csv", "Date,Users,Files,Size\n2024-01-01,150,2300,45GB\n" * 30),
        ("generated/analytics_summary.json", json.dumps({"analytics": {"users": 150, "files": 2300, "total_size": "45GB"}})),
        ("generated/backup_log.txt", "Backup started at 2024-01-15 10:00:00\n" * 100),
        ("uploads/shared/templates/template1.xlsx", "Excel template content " * 150),
        ("uploads/shared/imports/bulk_import.csv", "id,name,category\n" + "1,item,cat\n" * 1000),
    ]
    
    for file_path, content in demo_files:
        full_path = temp_dir / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, 'w') as f:
            f.write(content)
    
    print(f"Created {len(demo_files)} demo files in {temp_dir}")
    return demo_files

def format_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"

def analyze_demo_files(temp_dir: Path):
    """Analyze the demo files to show assessment capabilities."""
    print("\n" + "="*60)
    print("FILE MIGRATION ASSESSMENT DEMO")
    print("="*60)
    print(f"Analyzing directory: {temp_dir}")
    print()
    
    # Scan all files
    all_files = []
    total_size = 0
    file_types = {}
    user_files = {}
    
    for file_path in temp_dir.rglob('*'):
        if file_path.is_file():
            rel_path = file_path.relative_to(temp_dir)
            size = file_path.stat().st_size
            
            all_files.append({
                'path': str(rel_path),
                'size': size,
                'modified': datetime.fromtimestamp(file_path.stat().st_mtime)
            })
            
            total_size += size
            
            # File type analysis
            ext = file_path.suffix.lower()
            file_types[ext] = file_types.get(ext, 0) + 1
            
            # User analysis (extract from path)
            path_parts = str(rel_path).split('/')
            if len(path_parts) > 1 and path_parts[0] == 'uploads' and path_parts[1].startswith('user_'):
                user = path_parts[1]
                user_files[user] = user_files.get(user, 0) + 1
    
    # Display results
    print("SUMMARY")
    print("-" * 20)
    print(f"Total files found: {len(all_files):,}")
    print(f"Total size: {format_size(total_size)}")
    print(f"Average file size: {format_size(total_size // len(all_files)) if all_files else '0 B'}")
    print()
    
    print("FILE TYPE DISTRIBUTION")
    print("-" * 20)
    for ext, count in sorted(file_types.items(), key=lambda x: x[1], reverse=True):
        print(f"{ext or 'no_extension'}: {count:,} files")
    print()
    
    print("USER FILE DISTRIBUTION")
    print("-" * 20)
    for user, count in sorted(user_files.items(), key=lambda x: x[1], reverse=True):
        print(f"{user}: {count:,} files")
    print()
    
    # Size distribution
    size_ranges = {
        'small (< 1KB)': 0,
        'medium (1KB - 10KB)': 0,
        'large (10KB - 100KB)': 0,
        'xlarge (> 100KB)': 0
    }
    
    for file_info in all_files:
        size = file_info['size']
        if size < 1024:
            size_ranges['small (< 1KB)'] += 1
        elif size < 10240:
            size_ranges['medium (1KB - 10KB)'] += 1
        elif size < 102400:
            size_ranges['large (10KB - 100KB)'] += 1
        else:
            size_ranges['xlarge (> 100KB)'] += 1
    
    print("SIZE DISTRIBUTION")
    print("-" * 20)
    for size_range, count in size_ranges.items():
        print(f"{size_range}: {count:,} files")
    print()
    
    # Cost estimates (using simplified calculation)
    R2_STORAGE_COST_PER_GB = 0.015
    storage_gb = total_size / (1024 ** 3)
    monthly_cost = storage_gb * R2_STORAGE_COST_PER_GB
    
    print("MIGRATION ESTIMATES")
    print("-" * 20)
    print(f"Estimated monthly R2 storage cost: ${monthly_cost:.2f}")
    print(f"Estimated migration time: {len(all_files) / 1000:.1f} hours (est. 1000 files/hour)")
    print()
    
    # Migration batches
    batch_size = 1000
    num_batches = (len(all_files) + batch_size - 1) // batch_size
    
    print("MIGRATION BATCHES")
    print("-" * 20)
    print(f"Recommended batch size: {batch_size:,} files")
    print(f"Number of batches: {num_batches}")
    print(f"Average batch size: {format_size(total_size // num_batches) if num_batches > 0 else '0 B'}")
    print()
    
    # Sample batch breakdown
    print("SAMPLE BATCH BREAKDOWN")
    print("-" * 20)
    for i in range(min(3, num_batches)):
        start_idx = i * batch_size
        end_idx = min((i + 1) * batch_size, len(all_files))
        batch_files = all_files[start_idx:end_idx]
        batch_size_bytes = sum(f['size'] for f in batch_files)
        
        print(f"Batch {i + 1}: {len(batch_files):,} files, {format_size(batch_size_bytes)}")
    
    if num_batches > 3:
        print(f"... and {num_batches - 3} more batches")
    
    print()
    
    # Issues simulation
    print("POTENTIAL ISSUES")
    print("-" * 20)
    
    # Simulate some common issues
    large_files = [f for f in all_files if f['size'] > 50000]  # > 50KB
    if large_files:
        print(f"⚠️  {len(large_files)} files are larger than 50KB")
    
    csv_files = [f for f in all_files if f['path'].endswith('.csv')]
    if len(csv_files) > 5:
        print(f"ℹ️  {len(csv_files)} CSV files found - verify data integrity")
    
    old_files = [f for f in all_files if (datetime.now() - f['modified']).days > 30]
    if old_files:
        print(f"ℹ️  {len(old_files)} files are older than 30 days")
    
    print()
    
    # Recommendations
    print("RECOMMENDATIONS")
    print("-" * 20)
    print("1. Test migration with a small subset first")
    print("2. Monitor R2 costs and performance after migration")
    print("3. Implement file integrity checks post-migration")
    print("4. Consider implementing CDN caching for frequently accessed files")
    print("5. Clean up old or unused files before migration")
    print("6. Use batch processing for large migrations")
    print()
    
    return {
        'total_files': len(all_files),
        'total_size': total_size,
        'file_types': file_types,
        'user_files': user_files,
        'estimated_cost': monthly_cost,
        'batches': num_batches
    }

def demo_json_output(analysis_results):
    """Demonstrate JSON output format."""
    print("SAMPLE JSON OUTPUT")
    print("-" * 20)
    
    json_report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_files": analysis_results['total_files'],
            "total_size": analysis_results['total_size'],
            "estimated_monthly_cost": analysis_results['estimated_cost'],
            "migration_batches": analysis_results['batches']
        },
        "file_type_distribution": analysis_results['file_types'],
        "user_distribution": analysis_results['user_files'],
        "recommendations": [
            "Test migration with a small subset first",
            "Monitor R2 costs and performance after migration",
            "Implement file integrity checks post-migration"
        ]
    }
    
    print(json.dumps(json_report, indent=2))

def main():
    """Run the demo."""
    print("File Migration Assessment Tool - Demo")
    print("This demo shows the capabilities of the assessment tool using sample data.")
    print("For production use, run: python assess_file_migration.py --help")
    print()
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Create demo files
        create_demo_files(temp_path)
        
        # Analyze files
        results = analyze_demo_files(temp_path)
        
        # Show JSON output
        demo_json_output(results)
        
        print("\n" + "="*60)
        print("DEMO COMPLETED")
        print("="*60)
        print("This demo showed:")
        print("✓ File system scanning and analysis")
        print("✓ Cost calculation and estimation")
        print("✓ Migration batch planning")
        print("✓ Issue identification")
        print("✓ Report generation (text and JSON)")
        print()
        print("To use the full assessment tool:")
        print("1. Install dependencies: pip install click tqdm psycopg2-binary pandas")
        print("2. Set up database connection")
        print("3. Run: python assess_file_migration.py")
        print("4. Use --help for all options")

if __name__ == "__main__":
    main()
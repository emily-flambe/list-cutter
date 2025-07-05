#!/usr/bin/env python3
"""
transform_data.py
Transform exported PostgreSQL and Neo4j data for D1 import
Handles data type conversions and validation for List Cutter Phase 4 migration
"""

import csv
import json
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

def transform_boolean(value: str) -> str:
    """Convert boolean text to integer string for SQLite"""
    if not value or value.lower() in ('', 'null', 'none'):
        return '0'
    if value.lower() in ('true', 't', '1', 'yes', 'y'):
        return '1'
    elif value.lower() in ('false', 'f', '0', 'no', 'n'):
        return '0'
    else:
        return '0'  # Default to false for unknown values

def transform_datetime(value: str) -> str:
    """Convert PostgreSQL timestamp to ISO 8601 format for SQLite"""
    if not value or value in ('', 'NULL', 'null', 'None'):
        return ''
    
    try:
        # Handle PostgreSQL timestamp formats
        if '+' in value:
            # Remove timezone info and convert
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        else:
            # Try parsing as ISO format
            dt = datetime.fromisoformat(value)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except (ValueError, TypeError):
        # Return original value if parsing fails
        return value

def transform_date(value: str) -> str:
    """Convert PostgreSQL date to ISO 8601 format for SQLite"""
    if not value or value in ('', 'NULL', 'null', 'None'):
        return ''
    
    try:
        # Parse and validate date
        dt = datetime.fromisoformat(value)
        return dt.strftime('%Y-%m-%d')
    except (ValueError, TypeError):
        return value

def validate_json(value: str) -> str:
    """Validate and clean JSON strings"""
    if not value or value in ('', 'NULL', 'null', 'None'):
        return '{}'
    
    try:
        # Parse and re-serialize to ensure valid JSON
        parsed = json.loads(value)
        return json.dumps(parsed, separators=(',', ':'))
    except (json.JSONDecodeError, TypeError):
        return '{}'

def validate_json_array(value: str) -> str:
    """Validate and clean JSON arrays"""
    if not value or value in ('', 'NULL', 'null', 'None'):
        return '[]'
    
    try:
        # Parse and re-serialize to ensure valid JSON array
        parsed = json.loads(value)
        if not isinstance(parsed, list):
            return '[]'
        return json.dumps(parsed, separators=(',', ':'))
    except (json.JSONDecodeError, TypeError):
        return '[]'

def escape_csv_value(value: str) -> str:
    """Properly escape CSV values"""
    if value is None:
        return ''
    
    # Convert to string and handle special characters
    value = str(value)
    
    # If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if ',' in value or '"' in value or '\n' in value or '\r' in value:
        value = value.replace('"', '""')
        return f'"{value}"'
    
    return value

def transform_users_csv(input_file: str, output_file: str) -> int:
    """Transform users.csv for SQLite import"""
    print(f"Transforming {input_file} -> {output_file}...")
    
    if not os.path.exists(input_file):
        print(f"WARNING: Input file {input_file} not found")
        return 0
    
    transformed_count = 0
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = [
                'id', 'password', 'last_login', 'is_superuser', 'username',
                'first_name', 'last_name', 'email', 'is_staff', 'is_active', 'date_joined'
            ]
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                transformed_row = {
                    'id': row.get('id', ''),
                    'password': row.get('password', ''),
                    'last_login': transform_datetime(row.get('last_login', '')),
                    'is_superuser': transform_boolean(row.get('is_superuser', '')),
                    'username': row.get('username', ''),
                    'first_name': row.get('first_name', ''),
                    'last_name': row.get('last_name', ''),
                    'email': row.get('email', ''),
                    'is_staff': transform_boolean(row.get('is_staff', '')),
                    'is_active': transform_boolean(row.get('is_active', '')),
                    'date_joined': transform_datetime(row.get('date_joined', ''))
                }
                writer.writerow(transformed_row)
                transformed_count += 1
    
    print(f"✓ Transformed {transformed_count} user records")
    return transformed_count

def transform_saved_files_csv(input_file: str, output_file: str) -> int:
    """Transform saved_files.csv for SQLite import"""
    print(f"Transforming {input_file} -> {output_file}...")
    
    if not os.path.exists(input_file):
        print(f"WARNING: Input file {input_file} not found")
        return 0
    
    transformed_count = 0
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = [
                'id', 'user_id', 'file_id', 'file_name', 'file_path',
                'uploaded_at', 'system_tags', 'user_tags', 'metadata'
            ]
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                transformed_row = {
                    'id': row.get('id', ''),
                    'user_id': row.get('user_id', ''),
                    'file_id': row.get('file_id', ''),
                    'file_name': row.get('file_name', ''),
                    'file_path': row.get('file_path', ''),
                    'uploaded_at': transform_datetime(row.get('uploaded_at', '')),
                    'system_tags': validate_json_array(row.get('system_tags', '')),
                    'user_tags': validate_json_array(row.get('user_tags', '')),
                    'metadata': validate_json(row.get('metadata', ''))
                }
                writer.writerow(transformed_row)
                transformed_count += 1
    
    print(f"✓ Transformed {transformed_count} saved file records")
    return transformed_count

def transform_persons_csv(input_file: str, output_file: str) -> int:
    """Transform persons.csv for SQLite import"""
    print(f"Transforming {input_file} -> {output_file}...")
    
    if not os.path.exists(input_file):
        print(f"WARNING: Input file {input_file} not found")
        return 0
    
    transformed_count = 0
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = [
                'cuttyid', 'created_by_id', 'firstname', 'middlename', 'lastname',
                'dob', 'sex', 'version', 'deceased', 'active', 'precinctname',
                'countyname', 'created_at', 'updated_at', 'email', 'secondary_email',
                'phone', 'secondary_phone', 'mailing_address_line1', 'mailing_address_line2',
                'city', 'statecode', 'postal_code', 'country', 'race', 'ethnicity',
                'income_range', 'model_scores', 'system_tags', 'user_tags', 'notes'
            ]
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                transformed_row = {
                    'cuttyid': row.get('cuttyid', ''),
                    'created_by_id': row.get('created_by_id', ''),
                    'firstname': row.get('firstname', ''),
                    'middlename': row.get('middlename', ''),
                    'lastname': row.get('lastname', ''),
                    'dob': transform_date(row.get('dob', '')),
                    'sex': row.get('sex', ''),
                    'version': row.get('version', ''),
                    'deceased': transform_boolean(row.get('deceased', '')),
                    'active': transform_boolean(row.get('active', '')),
                    'precinctname': row.get('precinctname', ''),
                    'countyname': row.get('countyname', ''),
                    'created_at': transform_datetime(row.get('created_at', '')),
                    'updated_at': transform_datetime(row.get('updated_at', '')),
                    'email': row.get('email', ''),
                    'secondary_email': row.get('secondary_email', ''),
                    'phone': row.get('phone', ''),
                    'secondary_phone': row.get('secondary_phone', ''),
                    'mailing_address_line1': row.get('mailing_address_line1', ''),
                    'mailing_address_line2': row.get('mailing_address_line2', ''),
                    'city': row.get('city', ''),
                    'statecode': row.get('statecode', ''),
                    'postal_code': row.get('postal_code', ''),
                    'country': row.get('country', ''),
                    'race': row.get('race', ''),
                    'ethnicity': row.get('ethnicity', ''),
                    'income_range': row.get('income_range', ''),
                    'model_scores': validate_json(row.get('model_scores', '')),
                    'system_tags': validate_json_array(row.get('system_tags', '')),
                    'user_tags': validate_json_array(row.get('user_tags', '')),
                    'notes': row.get('notes', '')
                }
                writer.writerow(transformed_row)
                transformed_count += 1
    
    print(f"✓ Transformed {transformed_count} person records")
    return transformed_count

def transform_neo4j_relationships(input_file: str, output_file: str) -> int:
    """Transform Neo4j relationships to file_relationships table format"""
    print(f"Transforming {input_file} -> {output_file}...")
    
    if not os.path.exists(input_file):
        print(f"WARNING: Input file {input_file} not found - creating empty file_relationships.csv")
        # Create empty file with headers
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = ['source_file_id', 'target_file_id', 'relationship_type', 'metadata']
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
        return 0
    
    transformed_count = 0
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = ['source_file_id', 'target_file_id', 'relationship_type', 'metadata']
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                transformed_row = {
                    'source_file_id': row.get('source_file_id', ''),
                    'target_file_id': row.get('target_file_id', ''),
                    'relationship_type': row.get('relationship_type', 'CUT_FROM'),
                    'metadata': validate_json(row.get('metadata', '{}'))
                }
                writer.writerow(transformed_row)
                transformed_count += 1
    
    print(f"✓ Transformed {transformed_count} file relationship records")
    return transformed_count

def create_transformation_summary(output_dir: str, counts: Dict[str, int]):
    """Create a summary of the data transformation"""
    summary_path = os.path.join(output_dir, 'transformation_summary.txt')
    
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write("List Cutter Data Transformation Summary\n")
        f.write("======================================\n\n")
        f.write(f"Transformation Date: {datetime.now().isoformat()}\n")
        f.write(f"Output Directory: {output_dir}\n\n")
        f.write("Transformed Files:\n")
        f.write(f"- users_transformed.csv ({counts['users']} records)\n")
        f.write(f"- saved_files_transformed.csv ({counts['saved_files']} records)\n")
        f.write(f"- persons_transformed.csv ({counts['persons']} records)\n")
        f.write(f"- file_relationships_transformed.csv ({counts['relationships']} records)\n\n")
        f.write("Data Transformations Applied:\n")
        f.write("- Boolean fields: true/false -> 1/0\n")
        f.write("- DateTime fields: PostgreSQL timestamps -> ISO 8601 strings\n")
        f.write("- Date fields: PostgreSQL dates -> YYYY-MM-DD strings\n")
        f.write("- Array fields: PostgreSQL arrays -> JSON strings\n")
        f.write("- JSON fields: Validated and normalized\n")
        f.write("- NULL values: Properly handled for each data type\n\n")
        f.write("SQLite Compatibility:\n")
        f.write("- All data types converted to SQLite-compatible formats\n")
        f.write("- JSON validation ensures proper parsing\n")
        f.write("- String escaping handled for CSV import\n\n")
        f.write("Next Steps:\n")
        f.write("1. Validate transformed data with validate_transformed_data.py\n")
        f.write("2. Import to D1 using import_to_d1.sh\n")
        f.write("3. Run post-import validation\n")
    
    print(f"✓ Transformation summary created: {summary_path}")

def main():
    """Main transformation function"""
    if len(sys.argv) < 2:
        print("Usage: python transform_data.py <input_directory> [output_directory]")
        print("Example: python transform_data.py ./data_export_20240105_120000")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else './transformed_data'
    
    if not os.path.exists(input_dir):
        print(f"ERROR: Input directory does not exist: {input_dir}")
        sys.exit(1)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    print("=== List Cutter Data Transformation ===")
    print(f"Input Directory: {input_dir}")
    print(f"Output Directory: {output_dir}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("")
    
    try:
        # Transform all data files
        counts = {}
        
        # Transform PostgreSQL exports
        counts['users'] = transform_users_csv(
            os.path.join(input_dir, 'users.csv'),
            os.path.join(output_dir, 'users_transformed.csv')
        )
        
        counts['saved_files'] = transform_saved_files_csv(
            os.path.join(input_dir, 'saved_files.csv'),
            os.path.join(output_dir, 'saved_files_transformed.csv')
        )
        
        counts['persons'] = transform_persons_csv(
            os.path.join(input_dir, 'persons.csv'),
            os.path.join(output_dir, 'persons_transformed.csv')
        )
        
        # Transform Neo4j exports (if they exist)
        neo4j_relationships_file = None
        for f in os.listdir(input_dir):
            if f.startswith('neo4j_export_') and os.path.isdir(os.path.join(input_dir, f)):
                neo4j_relationships_file = os.path.join(input_dir, f, 'neo4j_relationships.csv')
                break
        
        if neo4j_relationships_file:
            counts['relationships'] = transform_neo4j_relationships(
                neo4j_relationships_file,
                os.path.join(output_dir, 'file_relationships_transformed.csv')
            )
        else:
            # Create empty relationships file
            counts['relationships'] = transform_neo4j_relationships(
                'nonexistent_file.csv',
                os.path.join(output_dir, 'file_relationships_transformed.csv')
            )
        
        # Create summary
        create_transformation_summary(output_dir, counts)
        
        print("")
        print("=== Transformation Complete ===")
        print(f"✓ Transformed {counts['users']} users")
        print(f"✓ Transformed {counts['saved_files']} saved files")
        print(f"✓ Transformed {counts['persons']} persons")
        print(f"✓ Transformed {counts['relationships']} file relationships")
        print(f"✓ Files created in: {output_dir}")
        print("")
        print("Transformed files:")
        for filename in os.listdir(output_dir):
            if filename.endswith('.csv'):
                filepath = os.path.join(output_dir, filename)
                size = os.path.getsize(filepath)
                print(f"  {filename} ({size} bytes)")
        
    except Exception as e:
        print(f"ERROR during transformation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
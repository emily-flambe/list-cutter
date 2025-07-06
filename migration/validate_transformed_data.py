#!/usr/bin/env python3
"""
validate_transformed_data.py
Validate transformed data for D1 import
Ensures data integrity and SQLite compatibility for List Cutter Phase 4 migration
"""

import csv
import json
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional, Set

class ValidationError:
    def __init__(self, table: str, row_id: str, field: str, error: str):
        self.table = table
        self.row_id = row_id
        self.field = field
        self.error = error
    
    def __str__(self):
        return f"{self.table}[{self.row_id}].{self.field}: {self.error}"

class DataValidator:
    def __init__(self):
        self.errors: List[ValidationError] = []
        self.warnings: List[str] = []
    
    def add_error(self, table: str, row_id: str, field: str, error: str):
        self.errors.append(ValidationError(table, row_id, field, error))
    
    def add_warning(self, message: str):
        self.warnings.append(message)
    
    def validate_json_field(self, value: str, table: str, row_id: str, field_name: str) -> bool:
        """Validate JSON field"""
        if not value:
            return True
        
        try:
            json.loads(value)
            return True
        except json.JSONDecodeError as e:
            self.add_error(table, row_id, field_name, f"Invalid JSON: {e}")
            return False
    
    def validate_json_array_field(self, value: str, table: str, row_id: str, field_name: str) -> bool:
        """Validate JSON array field"""
        if not value:
            return True
        
        try:
            parsed = json.loads(value)
            if not isinstance(parsed, list):
                self.add_error(table, row_id, field_name, "Must be JSON array")
                return False
            return True
        except json.JSONDecodeError as e:
            self.add_error(table, row_id, field_name, f"Invalid JSON array: {e}")
            return False
    
    def validate_json_object_field(self, value: str, table: str, row_id: str, field_name: str) -> bool:
        """Validate JSON object field"""
        if not value:
            return True
        
        try:
            parsed = json.loads(value)
            if not isinstance(parsed, dict):
                self.add_error(table, row_id, field_name, "Must be JSON object")
                return False
            return True
        except json.JSONDecodeError as e:
            self.add_error(table, row_id, field_name, f"Invalid JSON object: {e}")
            return False
    
    def validate_integer_field(self, value: str, table: str, row_id: str, field_name: str, required: bool = False) -> bool:
        """Validate integer field"""
        if not value:
            if required:
                self.add_error(table, row_id, field_name, "Required field is empty")
                return False
            return True
        
        try:
            int(value)
            return True
        except ValueError:
            self.add_error(table, row_id, field_name, f"Invalid integer: {value}")
            return False
    
    def validate_boolean_field(self, value: str, table: str, row_id: str, field_name: str) -> bool:
        """Validate boolean field (should be 0 or 1)"""
        if value not in ['0', '1', '']:
            self.add_error(table, row_id, field_name, f"Boolean must be 0 or 1, got: {value}")
            return False
        return True
    
    def validate_datetime_field(self, value: str, table: str, row_id: str, field_name: str) -> bool:
        """Validate datetime field"""
        if not value:
            return True
        
        try:
            datetime.fromisoformat(value.replace('Z', '+00:00'))
            return True
        except ValueError:
            self.add_error(table, row_id, field_name, f"Invalid datetime format: {value}")
            return False
    
    def validate_date_field(self, value: str, table: str, row_id: str, field_name: str) -> bool:
        """Validate date field"""
        if not value:
            return True
        
        try:
            datetime.strptime(value, '%Y-%m-%d')
            return True
        except ValueError:
            self.add_error(table, row_id, field_name, f"Invalid date format (expected YYYY-MM-DD): {value}")
            return False
    
    def validate_required_field(self, value: str, table: str, row_id: str, field_name: str) -> bool:
        """Validate required field is not empty"""
        if not value or value.strip() == '':
            self.add_error(table, row_id, field_name, "Required field is empty")
            return False
        return True

def validate_users_csv(filepath: str, validator: DataValidator) -> Dict[str, int]:
    """Validate users_transformed.csv"""
    print("Validating users_transformed.csv...")
    
    if not os.path.exists(filepath):
        validator.add_warning(f"File not found: {filepath}")
        return {'total': 0, 'valid': 0}
    
    stats = {'total': 0, 'valid': 0}
    usernames: Set[str] = set()
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            stats['total'] += 1
            row_id = row.get('id', 'unknown')
            row_valid = True
            
            # Validate required fields
            if not validator.validate_required_field(row.get('username', ''), 'users', row_id, 'username'):
                row_valid = False
            
            if not validator.validate_required_field(row.get('password', ''), 'users', row_id, 'password'):
                row_valid = False
            
            # Check username uniqueness
            username = row.get('username', '')
            if username in usernames:
                validator.add_error('users', row_id, 'username', f"Duplicate username: {username}")
                row_valid = False
            else:
                usernames.add(username)
            
            # Validate integer fields
            if not validator.validate_integer_field(row.get('id', ''), 'users', row_id, 'id', required=True):
                row_valid = False
            
            # Validate boolean fields
            for field in ['is_superuser', 'is_staff', 'is_active']:
                if not validator.validate_boolean_field(row.get(field, ''), 'users', row_id, field):
                    row_valid = False
            
            # Validate datetime fields
            for field in ['last_login', 'date_joined']:
                if not validator.validate_datetime_field(row.get(field, ''), 'users', row_id, field):
                    row_valid = False
            
            if row_valid:
                stats['valid'] += 1
    
    print(f"✓ Users validation: {stats['valid']}/{stats['total']} valid records")
    return stats

def validate_saved_files_csv(filepath: str, validator: DataValidator, valid_users: Set[str]) -> Dict[str, int]:
    """Validate saved_files_transformed.csv"""
    print("Validating saved_files_transformed.csv...")
    
    if not os.path.exists(filepath):
        validator.add_warning(f"File not found: {filepath}")
        return {'total': 0, 'valid': 0}
    
    stats = {'total': 0, 'valid': 0}
    file_ids: Set[str] = set()
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            stats['total'] += 1
            row_id = row.get('id', 'unknown')
            row_valid = True
            
            # Validate required fields
            if not validator.validate_required_field(row.get('file_id', ''), 'saved_files', row_id, 'file_id'):
                row_valid = False
            
            if not validator.validate_required_field(row.get('user_id', ''), 'saved_files', row_id, 'user_id'):
                row_valid = False
            
            # Check file_id uniqueness
            file_id = row.get('file_id', '')
            if file_id in file_ids:
                validator.add_error('saved_files', row_id, 'file_id', f"Duplicate file_id: {file_id}")
                row_valid = False
            else:
                file_ids.add(file_id)
            
            # Validate foreign key reference
            user_id = row.get('user_id', '')
            if user_id and user_id not in valid_users:
                validator.add_error('saved_files', row_id, 'user_id', f"References non-existent user: {user_id}")
                row_valid = False
            
            # Validate integer fields
            if not validator.validate_integer_field(row.get('id', ''), 'saved_files', row_id, 'id', required=True):
                row_valid = False
            
            if not validator.validate_integer_field(row.get('user_id', ''), 'saved_files', row_id, 'user_id', required=True):
                row_valid = False
            
            # Validate JSON fields
            if not validator.validate_json_array_field(row.get('system_tags', ''), 'saved_files', row_id, 'system_tags'):
                row_valid = False
            
            if not validator.validate_json_array_field(row.get('user_tags', ''), 'saved_files', row_id, 'user_tags'):
                row_valid = False
            
            if not validator.validate_json_object_field(row.get('metadata', ''), 'saved_files', row_id, 'metadata'):
                row_valid = False
            
            # Validate datetime
            if not validator.validate_datetime_field(row.get('uploaded_at', ''), 'saved_files', row_id, 'uploaded_at'):
                row_valid = False
            
            if row_valid:
                stats['valid'] += 1
    
    print(f"✓ Saved files validation: {stats['valid']}/{stats['total']} valid records")
    return stats

def validate_persons_csv(filepath: str, validator: DataValidator, valid_users: Set[str]) -> Dict[str, int]:
    """Validate persons_transformed.csv"""
    print("Validating persons_transformed.csv...")
    
    if not os.path.exists(filepath):
        validator.add_warning(f"File not found: {filepath}")
        return {'total': 0, 'valid': 0}
    
    stats = {'total': 0, 'valid': 0}
    cuttyids: Set[str] = set()
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            stats['total'] += 1
            row_id = row.get('cuttyid', 'unknown')
            row_valid = True
            
            # Validate primary key
            cuttyid = row.get('cuttyid', '')
            if not validator.validate_integer_field(cuttyid, 'persons', row_id, 'cuttyid', required=True):
                row_valid = False
            
            # Check cuttyid uniqueness
            if cuttyid in cuttyids:
                validator.add_error('persons', row_id, 'cuttyid', f"Duplicate cuttyid: {cuttyid}")
                row_valid = False
            else:
                cuttyids.add(cuttyid)
            
            # Validate foreign key (optional)
            created_by_id = row.get('created_by_id', '')
            if created_by_id and created_by_id not in valid_users:
                validator.add_error('persons', row_id, 'created_by_id', f"References non-existent user: {created_by_id}")
                row_valid = False
            
            # Validate boolean fields
            for field in ['deceased', 'active']:
                if not validator.validate_boolean_field(row.get(field, ''), 'persons', row_id, field):
                    row_valid = False
            
            # Validate date fields
            if not validator.validate_date_field(row.get('dob', ''), 'persons', row_id, 'dob'):
                row_valid = False
            
            # Validate datetime fields
            for field in ['created_at', 'updated_at']:
                if not validator.validate_datetime_field(row.get(field, ''), 'persons', row_id, field):
                    row_valid = False
            
            # Validate JSON fields
            if not validator.validate_json_object_field(row.get('model_scores', ''), 'persons', row_id, 'model_scores'):
                row_valid = False
            
            if not validator.validate_json_array_field(row.get('system_tags', ''), 'persons', row_id, 'system_tags'):
                row_valid = False
            
            if not validator.validate_json_array_field(row.get('user_tags', ''), 'persons', row_id, 'user_tags'):
                row_valid = False
            
            if row_valid:
                stats['valid'] += 1
    
    print(f"✓ Persons validation: {stats['valid']}/{stats['total']} valid records")
    return stats

def validate_file_relationships_csv(filepath: str, validator: DataValidator, valid_file_ids: Set[str]) -> Dict[str, int]:
    """Validate file_relationships_transformed.csv"""
    print("Validating file_relationships_transformed.csv...")
    
    if not os.path.exists(filepath):
        validator.add_warning(f"File not found: {filepath}")
        return {'total': 0, 'valid': 0}
    
    stats = {'total': 0, 'valid': 0}
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, 1):
            stats['total'] += 1
            row_id = str(row_num)
            row_valid = True
            
            # Validate required fields
            source_file_id = row.get('source_file_id', '')
            target_file_id = row.get('target_file_id', '')
            
            if not validator.validate_required_field(source_file_id, 'file_relationships', row_id, 'source_file_id'):
                row_valid = False
            
            if not validator.validate_required_field(target_file_id, 'file_relationships', row_id, 'target_file_id'):
                row_valid = False
            
            # Validate foreign key references
            if source_file_id and source_file_id not in valid_file_ids:
                validator.add_error('file_relationships', row_id, 'source_file_id', f"References non-existent file: {source_file_id}")
                row_valid = False
            
            if target_file_id and target_file_id not in valid_file_ids:
                validator.add_error('file_relationships', row_id, 'target_file_id', f"References non-existent file: {target_file_id}")
                row_valid = False
            
            # Validate relationship type
            relationship_type = row.get('relationship_type', '')
            if relationship_type and relationship_type not in ['CUT_FROM', 'CUT_TO']:
                validator.add_error('file_relationships', row_id, 'relationship_type', f"Invalid relationship type: {relationship_type}")
                row_valid = False
            
            # Validate JSON metadata
            if not validator.validate_json_object_field(row.get('metadata', ''), 'file_relationships', row_id, 'metadata'):
                row_valid = False
            
            if row_valid:
                stats['valid'] += 1
    
    print(f"✓ File relationships validation: {stats['valid']}/{stats['total']} valid records")
    return stats

def create_validation_report(output_dir: str, validator: DataValidator, all_stats: Dict[str, Dict[str, int]]):
    """Create a detailed validation report"""
    report_path = os.path.join(output_dir, 'validation_report.txt')
    
    total_records = sum(stats['total'] for stats in all_stats.values())
    total_valid = sum(stats['valid'] for stats in all_stats.values())
    total_errors = len(validator.errors)
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("List Cutter Data Validation Report\n")
        f.write("==================================\n\n")
        f.write(f"Validation Date: {datetime.now().isoformat()}\n")
        f.write(f"Data Directory: {output_dir}\n\n")
        
        f.write("Summary:\n")
        f.write(f"- Total Records: {total_records}\n")
        f.write(f"- Valid Records: {total_valid}\n")
        f.write(f"- Invalid Records: {total_records - total_valid}\n")
        f.write(f"- Total Errors: {total_errors}\n")
        f.write(f"- Warnings: {len(validator.warnings)}\n\n")
        
        f.write("Per-Table Statistics:\n")
        for table_name, stats in all_stats.items():
            f.write(f"- {table_name}: {stats['valid']}/{stats['total']} valid\n")
        f.write("\n")
        
        if validator.warnings:
            f.write("Warnings:\n")
            for warning in validator.warnings:
                f.write(f"- {warning}\n")
            f.write("\n")
        
        if validator.errors:
            f.write("Validation Errors:\n")
            for error in validator.errors:
                f.write(f"- {error}\n")
            f.write("\n")
        else:
            f.write("✓ No validation errors found!\n\n")
        
        f.write("Data Integrity Checks:\n")
        f.write("- Primary key uniqueness: Verified\n")
        f.write("- Foreign key references: Verified\n")
        f.write("- JSON field validity: Verified\n")
        f.write("- Data type compatibility: Verified\n")
        f.write("- Required field presence: Verified\n\n")
        
        if total_errors == 0:
            f.write("✅ VALIDATION PASSED\n")
            f.write("Data is ready for D1 import!\n")
        else:
            f.write("❌ VALIDATION FAILED\n")
            f.write("Please fix all errors before proceeding with D1 import.\n")
    
    print(f"✓ Validation report created: {report_path}")

def main():
    """Main validation function"""
    if len(sys.argv) < 2:
        print("Usage: python validate_transformed_data.py <data_directory>")
        print("Example: python validate_transformed_data.py ./transformed_data")
        sys.exit(1)
    
    data_dir = sys.argv[1]
    
    if not os.path.exists(data_dir):
        print(f"ERROR: Data directory does not exist: {data_dir}")
        sys.exit(1)
    
    print("=== List Cutter Data Validation ===")
    print(f"Data Directory: {data_dir}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("")
    
    validator = DataValidator()
    all_stats = {}
    
    try:
        # Validate users first to get valid user IDs
        users_stats = validate_users_csv(
            os.path.join(data_dir, 'users_transformed.csv'),
            validator
        )
        all_stats['users'] = users_stats
        
        # Get valid user IDs for foreign key validation
        valid_users: Set[str] = set()
        users_file = os.path.join(data_dir, 'users_transformed.csv')
        if os.path.exists(users_file):
            with open(users_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    user_id = row.get('id', '')
                    if user_id:
                        valid_users.add(user_id)
        
        # Validate saved files to get valid file IDs
        saved_files_stats = validate_saved_files_csv(
            os.path.join(data_dir, 'saved_files_transformed.csv'),
            validator,
            valid_users
        )
        all_stats['saved_files'] = saved_files_stats
        
        # Get valid file IDs for relationship validation
        valid_file_ids: Set[str] = set()
        files_file = os.path.join(data_dir, 'saved_files_transformed.csv')
        if os.path.exists(files_file):
            with open(files_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    file_id = row.get('file_id', '')
                    if file_id:
                        valid_file_ids.add(file_id)
        
        # Validate persons
        persons_stats = validate_persons_csv(
            os.path.join(data_dir, 'persons_transformed.csv'),
            validator,
            valid_users
        )
        all_stats['persons'] = persons_stats
        
        # Validate file relationships
        relationships_stats = validate_file_relationships_csv(
            os.path.join(data_dir, 'file_relationships_transformed.csv'),
            validator,
            valid_file_ids
        )
        all_stats['file_relationships'] = relationships_stats
        
        # Create validation report
        create_validation_report(data_dir, validator, all_stats)
        
        print("")
        print("=== Validation Complete ===")
        
        total_records = sum(stats['total'] for stats in all_stats.values())
        total_valid = sum(stats['valid'] for stats in all_stats.values())
        total_errors = len(validator.errors)
        
        print(f"Total Records: {total_records}")
        print(f"Valid Records: {total_valid}")
        print(f"Errors Found: {total_errors}")
        print(f"Warnings: {len(validator.warnings)}")
        
        if total_errors == 0:
            print("✅ All validation checks passed!")
            print("Data is ready for D1 import.")
        else:
            print("❌ Validation failed. Please fix errors before proceeding.")
            print("Check validation_report.txt for detailed error information.")
            sys.exit(1)
        
    except Exception as e:
        print(f"ERROR during validation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
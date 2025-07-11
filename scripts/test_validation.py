#!/usr/bin/env python3
"""
Test script for migration validation tools
==========================================

This script provides basic unit tests and integration tests for the migration
validation functionality.

Usage:
    python3 test_validation.py
"""

import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch, MagicMock
import sys
from pathlib import Path

# Add the scripts directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from validate_migration import (
    ValidationConfig,
    FileValidationResult,
    BatchValidationResult,
    ValidationReport,
    DatabaseConnector,
    FileValidator,
    MigrationValidator,
    ReportGenerator
)


class TestValidationConfig(unittest.TestCase):
    """Test ValidationConfig dataclass"""
    
    def test_config_creation(self):
        """Test creating a validation configuration"""
        config = ValidationConfig(
            postgres_dsn="postgresql://test:test@localhost:5432/test",
            d1_api_endpoint="https://api.cloudflare.com/test",
            d1_api_token="test-token",
            r2_api_endpoint="https://api.cloudflare.com/r2",
            r2_api_token="r2-token",
            workers_api_endpoint="https://test.workers.dev",
            workers_api_token="workers-token",
            django_media_root="/tmp/media"
        )
        
        self.assertEqual(config.postgres_dsn, "postgresql://test:test@localhost:5432/test")
        self.assertEqual(config.batch_size, 100)  # Default value
        self.assertEqual(config.max_workers, 10)  # Default value


class TestFileValidationResult(unittest.TestCase):
    """Test FileValidationResult dataclass"""
    
    def test_result_creation(self):
        """Test creating a file validation result"""
        result = FileValidationResult(
            file_id="test-file-123",
            file_name="test.csv",
            user_id="user-456",
            status="success"
        )
        
        self.assertEqual(result.file_id, "test-file-123")
        self.assertEqual(result.status, "success")
        self.assertEqual(len(result.errors), 0)
        self.assertEqual(len(result.warnings), 0)
    
    def test_result_with_errors(self):
        """Test result with errors and warnings"""
        result = FileValidationResult(
            file_id="test-file-123",
            file_name="test.csv",
            user_id="user-456",
            status="failed"
        )
        
        result.errors.append("File not found in R2")
        result.warnings.append("Checksum could not be verified")
        
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(len(result.warnings), 1)
        self.assertEqual(result.status, "failed")


class TestBatchValidationResult(unittest.TestCase):
    """Test BatchValidationResult dataclass"""
    
    def test_batch_result_creation(self):
        """Test creating a batch validation result"""
        result = BatchValidationResult(
            batch_id="batch-123",
            total_files=10,
            validated_files=8,
            successful_files=6,
            failed_files=2,
            warning_files=0
        )
        
        self.assertEqual(result.batch_id, "batch-123")
        self.assertEqual(result.total_files, 10)
        self.assertEqual(result.successful_files, 6)
    
    def test_batch_duration_calculation(self):
        """Test batch duration calculation"""
        from datetime import datetime, timezone, timedelta
        
        result = BatchValidationResult(
            batch_id="batch-123",
            total_files=10,
            validated_files=10,
            successful_files=10,
            failed_files=0,
            warning_files=0
        )
        
        # Set end time 5 seconds after start time
        result.end_time = result.start_time + timedelta(seconds=5)
        
        self.assertAlmostEqual(result.duration, 5.0, places=1)


class TestValidationReport(unittest.TestCase):
    """Test ValidationReport dataclass"""
    
    def test_report_creation(self):
        """Test creating a validation report"""
        config = ValidationConfig(
            postgres_dsn="test",
            d1_api_endpoint="test",
            d1_api_token="test",
            r2_api_endpoint="test",
            r2_api_token="test",
            workers_api_endpoint="test",
            workers_api_token="test",
            django_media_root="/tmp"
        )
        
        report = ValidationReport(
            validation_id="test-validation-123",
            config=config
        )
        
        self.assertEqual(report.validation_id, "test-validation-123")
        self.assertEqual(report.total_files, 0)
        self.assertEqual(len(report.batches), 0)
    
    def test_success_rate_calculation(self):
        """Test success rate calculation"""
        config = ValidationConfig(
            postgres_dsn="test",
            d1_api_endpoint="test",
            d1_api_token="test",
            r2_api_endpoint="test",
            r2_api_token="test",
            workers_api_endpoint="test",
            workers_api_token="test",
            django_media_root="/tmp"
        )
        
        report = ValidationReport(
            validation_id="test-validation-123",
            config=config,
            total_files=100,
            successful_files=95,
            failed_files=5
        )
        
        self.assertEqual(report.success_rate, 95.0)
        
        # Test with zero files
        report.total_files = 0
        report.successful_files = 0
        self.assertEqual(report.success_rate, 0.0)


class TestDatabaseConnector(unittest.TestCase):
    """Test DatabaseConnector class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.config = ValidationConfig(
            postgres_dsn="postgresql://test:test@localhost:5432/test",
            d1_api_endpoint="https://api.cloudflare.com/test",
            d1_api_token="test-token",
            r2_api_endpoint="https://api.cloudflare.com/r2",
            r2_api_token="r2-token",
            workers_api_endpoint="https://test.workers.dev",
            workers_api_token="workers-token",
            django_media_root="/tmp/media"
        )
        self.connector = DatabaseConnector(self.config)
    
    @patch('validate_migration.psycopg2.connect')
    def test_postgres_connection(self, mock_connect):
        """Test PostgreSQL connection"""
        mock_connect.return_value = Mock()
        
        result = self.connector.connect_postgres()
        
        self.assertTrue(result)
        mock_connect.assert_called_once_with(self.config.postgres_dsn)
    
    @patch('validate_migration.psycopg2.connect')
    def test_postgres_connection_failure(self, mock_connect):
        """Test PostgreSQL connection failure"""
        mock_connect.side_effect = Exception("Connection failed")
        
        result = self.connector.connect_postgres()
        
        self.assertFalse(result)
    
    @patch('validate_migration.requests.post')
    def test_d1_query(self, mock_post):
        """Test D1 database query"""
        mock_response = Mock()
        mock_response.json.return_value = {"results": [{"id": "test-id", "name": "test"}]}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response
        
        result = self.connector.query_d1_database("SELECT * FROM files")
        
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "test-id")
        
        # Verify request was made correctly
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], self.config.d1_api_endpoint)
        self.assertIn('Authorization', kwargs['headers'])
        self.assertEqual(kwargs['json']['sql'], "SELECT * FROM files")


class TestFileValidator(unittest.TestCase):
    """Test FileValidator class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.config = ValidationConfig(
            postgres_dsn="postgresql://test:test@localhost:5432/test",
            d1_api_endpoint="https://api.cloudflare.com/test",
            d1_api_token="test-token",
            r2_api_endpoint="https://api.cloudflare.com/r2",
            r2_api_token="r2-token",
            workers_api_endpoint="https://test.workers.dev",
            workers_api_token="workers-token",
            django_media_root="/tmp/media"
        )
        self.validator = FileValidator(self.config)
    
    def test_checksum_calculation(self):
        """Test file checksum calculation"""
        # Create a temporary file with known content
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write("test content")
            temp_file = f.name
        
        try:
            checksum = self.validator.calculate_file_checksum(temp_file)
            
            # Expected SHA-256 of "test content"
            expected = "1eebdf4fdc9fc7bf283031b93f9aef3338de9052f584369fcb5808d5d0a3de"
            self.assertIsNotNone(checksum)
            self.assertIsInstance(checksum, str)
            self.assertEqual(len(checksum), 64)  # SHA-256 length
            
        finally:
            os.unlink(temp_file)
    
    def test_checksum_calculation_missing_file(self):
        """Test checksum calculation with missing file"""
        checksum = self.validator.calculate_file_checksum("/nonexistent/file.txt")
        self.assertIsNone(checksum)
    
    @patch('validate_migration.requests.Session.head')
    def test_r2_file_verification(self, mock_head):
        """Test R2 file existence verification"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.headers = {
            'Content-Length': '1024',
            'ETag': '"test-etag"'
        }
        mock_head.return_value = mock_response
        
        exists, size, etag = self.validator.verify_r2_file_exists("test-file", "test-user")
        
        self.assertTrue(exists)
        self.assertEqual(size, 1024)
        self.assertEqual(etag, "test-etag")
    
    @patch('validate_migration.requests.Session.head')
    def test_r2_file_not_found(self, mock_head):
        """Test R2 file not found"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_head.return_value = mock_response
        
        exists, size, etag = self.validator.verify_r2_file_exists("test-file", "test-user")
        
        self.assertFalse(exists)
        self.assertIsNone(size)
        self.assertIsNone(etag)
    
    @patch('validate_migration.requests.Session.get')
    def test_workers_api_access(self, mock_get):
        """Test Workers API access"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        result = self.validator.test_workers_api_access("test-file", "test-user")
        
        self.assertTrue(result)
    
    @patch('validate_migration.requests.Session.get')
    def test_workers_api_access_failure(self, mock_get):
        """Test Workers API access failure"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        
        result = self.validator.test_workers_api_access("test-file", "test-user")
        
        self.assertFalse(result)


class TestReportGenerator(unittest.TestCase):
    """Test ReportGenerator class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.config = ValidationConfig(
            postgres_dsn="test",
            d1_api_endpoint="test",
            d1_api_token="test",
            r2_api_endpoint="test",
            r2_api_token="test",
            workers_api_endpoint="test",
            workers_api_token="test",
            django_media_root="/tmp"
        )
        
        self.report = ValidationReport(
            validation_id="test-validation-123",
            config=self.config,
            total_files=10,
            successful_files=8,
            failed_files=2,
            warning_files=0
        )
    
    def test_json_report_generation(self):
        """Test JSON report generation"""
        json_output = ReportGenerator.generate_json_report(self.report)
        
        # Verify it's valid JSON
        data = json.loads(json_output)
        
        self.assertEqual(data['validation_id'], "test-validation-123")
        self.assertEqual(data['total_files'], 10)
        self.assertEqual(data['successful_files'], 8)
        self.assertEqual(data['failed_files'], 2)
    
    def test_csv_report_generation(self):
        """Test CSV report generation"""
        # Add some file results
        file_result = FileValidationResult(
            file_id="test-file-123",
            file_name="test.csv",
            user_id="user-456",
            status="success"
        )
        
        batch_result = BatchValidationResult(
            batch_id="batch-123",
            total_files=1,
            validated_files=1,
            successful_files=1,
            failed_files=0,
            warning_files=0
        )
        batch_result.file_results.append(file_result)
        
        self.report.batches.append(batch_result)
        
        csv_output = ReportGenerator.generate_csv_report(self.report)
        
        lines = csv_output.strip().split('\n')
        self.assertEqual(len(lines), 2)  # Header + 1 data row
        
        # Check header
        self.assertTrue(lines[0].startswith('file_id,file_name,user_id'))
        
        # Check data row
        self.assertTrue(lines[1].startswith('test-file-123,test.csv,user-456'))
    
    def test_human_readable_report_generation(self):
        """Test human-readable report generation"""
        human_output = ReportGenerator.generate_human_readable_report(self.report)
        
        self.assertIn("FILE MIGRATION VALIDATION REPORT", human_output)
        self.assertIn("test-validation-123", human_output)
        self.assertIn("Total Files: 10", human_output)
        self.assertIn("Successful: 8", human_output)
        self.assertIn("Failed: 2", human_output)


class TestIntegration(unittest.TestCase):
    """Integration tests for the validation system"""
    
    def setUp(self):
        """Set up integration test fixtures"""
        self.config = ValidationConfig(
            postgres_dsn="postgresql://test:test@localhost:5432/test",
            d1_api_endpoint="https://api.cloudflare.com/test",
            d1_api_token="test-token",
            r2_api_endpoint="https://api.cloudflare.com/r2",
            r2_api_token="r2-token",
            workers_api_endpoint="https://test.workers.dev",
            workers_api_token="workers-token",
            django_media_root="/tmp/media"
        )
    
    @patch('validate_migration.DatabaseConnector.connect_postgres')
    @patch('validate_migration.DatabaseConnector.get_migration_batches')
    @patch('validate_migration.DatabaseConnector.get_file_migrations')
    @patch('validate_migration.DatabaseConnector.get_postgres_files')
    @patch('validate_migration.DatabaseConnector.get_d1_files')
    def test_migration_validator_full_flow(self, mock_d1_files, mock_postgres_files, 
                                         mock_file_migrations, mock_batches, mock_connect):
        """Test full migration validation flow"""
        # Mock database connections and data
        mock_connect.return_value = True
        mock_batches.return_value = [{"batch_id": "batch-123", "total_files": 1}]
        mock_file_migrations.return_value = [{"file_id": "file-123", "batch_id": "batch-123"}]
        mock_postgres_files.return_value = [
            {
                "file_id": "file-123",
                "file_name": "test.csv",
                "file_path": "test.csv",
                "user_id": 1,
                "username": "testuser"
            }
        ]
        mock_d1_files.return_value = [
            {
                "id": "file-123",
                "filename": "test.csv",
                "user_id": "user-123"
            }
        ]
        
        # Mock file validator
        with patch.object(FileValidator, 'validate_file') as mock_validate:
            mock_validate.return_value = FileValidationResult(
                file_id="file-123",
                file_name="test.csv",
                user_id="user-123",
                status="success",
                postgres_record_exists=True,
                d1_record_exists=True,
                r2_accessible=True,
                workers_api_accessible=True
            )
            
            validator = MigrationValidator(self.config)
            report = validator.validate_full_migration()
            
            # Verify report structure
            self.assertEqual(len(report.batches), 1)
            self.assertEqual(report.batches[0].batch_id, "batch-123")
            self.assertEqual(report.total_files, 1)
            self.assertEqual(report.successful_files, 1)
            self.assertEqual(report.failed_files, 0)


def run_tests():
    """Run all tests"""
    unittest.main(verbosity=2)


if __name__ == '__main__':
    run_tests()
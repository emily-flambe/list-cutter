"""
Tests for D1 Database Service
Tests the D1 service layer with SQLite compatibility
"""

import unittest
import tempfile
import os
import json
from datetime import datetime
from unittest.mock import patch, MagicMock

from db.d1_service import (
    D1DatabaseService,
    User,
    SavedFile,
    Person,
    FileRelationship
)


class TestD1Models(unittest.TestCase):
    """Test D1 data model classes"""
    
    def test_user_model(self):
        """Test User model creation and conversion"""
        user = User(
            id=1,
            username="testuser",
            email="test@example.com",
            first_name="Test",
            last_name="User",
            is_active=True,
            is_staff=False
        )
        
        # Test to_dict conversion
        user_dict = user.to_dict()
        self.assertEqual(user_dict['username'], "testuser")
        self.assertEqual(user_dict['is_active'], 1)  # Boolean to int
        self.assertEqual(user_dict['is_staff'], 0)
        
        # Test from_dict conversion
        reconstructed = User.from_dict(user_dict)
        self.assertEqual(reconstructed.username, "testuser")
        self.assertTrue(reconstructed.is_active)  # Int to boolean
        self.assertFalse(reconstructed.is_staff)
    
    def test_saved_file_model(self):
        """Test SavedFile model creation and JSON handling"""
        saved_file = SavedFile(
            id=1,
            user_id=1,
            file_id="test-file-123",
            file_name="test.csv",
            file_path="/path/to/test.csv",
            system_tags=["uploaded", "csv"],
            user_tags=["important"],
            metadata={"size": 1024, "type": "csv"}
        )
        
        # Test to_dict conversion
        file_dict = saved_file.to_dict()
        self.assertEqual(file_dict['file_id'], "test-file-123")
        self.assertEqual(file_dict['system_tags'], '["uploaded", "csv"]')  # JSON string
        self.assertEqual(file_dict['metadata'], '{"size": 1024, "type": "csv"}')
        
        # Test from_dict conversion
        reconstructed = SavedFile.from_dict(file_dict)
        self.assertEqual(reconstructed.file_id, "test-file-123")
        self.assertEqual(reconstructed.system_tags, ["uploaded", "csv"])  # Back to list
        self.assertEqual(reconstructed.metadata, {"size": 1024, "type": "csv"})
    
    def test_person_model(self):
        """Test Person model creation and complex field handling"""
        person = Person(
            cuttyid=12345,
            created_by_id=1,
            firstname="John",
            lastname="Doe",
            email="john@example.com",
            active=True,
            deceased=False,
            model_scores={"match_score": 0.95},
            system_tags=["voter", "verified"],
            user_tags=["important_contact"]
        )
        
        # Test to_dict conversion
        person_dict = person.to_dict()
        self.assertEqual(person_dict['cuttyid'], 12345)
        self.assertEqual(person_dict['active'], 1)  # Boolean to int
        self.assertEqual(person_dict['deceased'], 0)
        self.assertEqual(person_dict['model_scores'], '{"match_score": 0.95}')
        
        # Test from_dict conversion
        reconstructed = Person.from_dict(person_dict)
        self.assertEqual(reconstructed.cuttyid, 12345)
        self.assertTrue(reconstructed.active)
        self.assertFalse(reconstructed.deceased)
        self.assertEqual(reconstructed.model_scores, {"match_score": 0.95})
    
    def test_file_relationship_model(self):
        """Test FileRelationship model"""
        relationship = FileRelationship(
            source_file_id="file1",
            target_file_id="file2",
            relationship_type="CUT_FROM",
            metadata={"operation": "filter", "rows_removed": 100}
        )
        
        # Test to_dict conversion
        rel_dict = relationship.to_dict()
        self.assertEqual(rel_dict['source_file_id'], "file1")
        self.assertEqual(rel_dict['target_file_id'], "file2")
        self.assertEqual(rel_dict['relationship_type'], "CUT_FROM")
        self.assertEqual(rel_dict['metadata'], '{"operation": "filter", "rows_removed": 100}')
        
        # Test from_dict conversion
        reconstructed = FileRelationship.from_dict(rel_dict)
        self.assertEqual(reconstructed.source_file_id, "file1")
        self.assertEqual(reconstructed.metadata, {"operation": "filter", "rows_removed": 100})


class TestD1DatabaseService(unittest.TestCase):
    """Test D1 Database Service operations"""
    
    def setUp(self):
        """Set up test database"""
        # Create temporary SQLite database for testing
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        self.temp_db.close()
        
        self.service = D1DatabaseService(self.temp_db.name)
        
        # Create test schema
        self._create_test_schema()
    
    def tearDown(self):
        """Clean up test database"""
        self.service.close()
        os.unlink(self.temp_db.name)
    
    def _create_test_schema(self):
        """Create test database schema"""
        schema_sql = """
        -- Simple test schema
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            first_name TEXT,
            last_name TEXT,
            is_active INTEGER DEFAULT 1,
            is_staff INTEGER DEFAULT 0,
            is_superuser INTEGER DEFAULT 0,
            last_login TEXT,
            date_joined TEXT DEFAULT (datetime('now'))
        );
        
        CREATE TABLE saved_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            file_id TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            system_tags TEXT DEFAULT '[]',
            user_tags TEXT DEFAULT '[]',
            metadata TEXT DEFAULT '{}',
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        
        CREATE TABLE persons (
            cuttyid INTEGER PRIMARY KEY,
            created_by_id INTEGER,
            firstname TEXT,
            lastname TEXT,
            email TEXT,
            active INTEGER DEFAULT 1,
            deceased INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            model_scores TEXT DEFAULT '{}',
            system_tags TEXT DEFAULT '[]',
            user_tags TEXT DEFAULT '[]',
            FOREIGN KEY (created_by_id) REFERENCES users(id)
        );
        
        CREATE TABLE file_relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file_id TEXT NOT NULL,
            target_file_id TEXT NOT NULL,
            relationship_type TEXT DEFAULT 'CUT_FROM',
            created_at TEXT DEFAULT (datetime('now')),
            metadata TEXT DEFAULT '{}'
        );
        """
        
        conn = self.service.get_connection()
        conn.executescript(schema_sql)
        conn.commit()
    
    def test_user_operations(self):
        """Test user CRUD operations"""
        # Create user
        user = User(
            username="testuser",
            password="testpass",
            email="test@example.com",
            first_name="Test",
            last_name="User"
        )
        
        user_id = self.service.create_user(user)
        self.assertIsInstance(user_id, int)
        self.assertGreater(user_id, 0)
        
        # Get user by ID
        retrieved_user = self.service.get_user_by_id(user_id)
        self.assertIsNotNone(retrieved_user)
        self.assertEqual(retrieved_user.username, "testuser")
        self.assertEqual(retrieved_user.email, "test@example.com")
        
        # Get user by username
        user_by_username = self.service.get_user_by_username("testuser")
        self.assertIsNotNone(user_by_username)
        self.assertEqual(user_by_username.id, user_id)
        
        # Test non-existent user
        non_existent = self.service.get_user_by_id(99999)
        self.assertIsNone(non_existent)
    
    def test_saved_file_operations(self):
        """Test saved file CRUD operations"""
        # Create test user first
        user = User(username="fileuser", password="pass", email="file@test.com")
        user_id = self.service.create_user(user)
        
        # Create saved file
        saved_file = SavedFile(
            user_id=user_id,
            file_id="test-file-123",
            file_name="test.csv",
            file_path="/tmp/test.csv",
            system_tags=["uploaded"],
            user_tags=["important"],
            metadata={"size": 1024}
        )
        
        file_db_id = self.service.create_saved_file(saved_file)
        self.assertIsInstance(file_db_id, int)
        
        # Get saved file by file_id
        retrieved_file = self.service.get_saved_file_by_id("test-file-123")
        self.assertIsNotNone(retrieved_file)
        self.assertEqual(retrieved_file.file_name, "test.csv")
        self.assertEqual(retrieved_file.system_tags, ["uploaded"])
        self.assertEqual(retrieved_file.metadata, {"size": 1024})
        
        # Get saved files by user
        user_files = self.service.get_saved_files_by_user(user_id)
        self.assertEqual(len(user_files), 1)
        self.assertEqual(user_files[0].file_id, "test-file-123")
        
        # Delete saved file
        success = self.service.delete_saved_file("test-file-123")
        self.assertTrue(success)
        
        # Verify deletion
        deleted_file = self.service.get_saved_file_by_id("test-file-123")
        self.assertIsNone(deleted_file)
    
    def test_person_operations(self):
        """Test person CRUD operations"""
        # Create test user first
        user = User(username="personuser", password="pass", email="person@test.com")
        user_id = self.service.create_user(user)
        
        # Create person
        person = Person(
            cuttyid=12345,
            created_by_id=user_id,
            firstname="John",
            lastname="Doe",
            email="john@example.com",
            model_scores={"match": 0.95},
            system_tags=["verified"]
        )
        
        created_cuttyid = self.service.create_person(person)
        self.assertEqual(created_cuttyid, 12345)
        
        # Get person by cuttyid
        retrieved_person = self.service.get_person_by_cuttyid(12345)
        self.assertIsNotNone(retrieved_person)
        self.assertEqual(retrieved_person.firstname, "John")
        self.assertEqual(retrieved_person.lastname, "Doe")
        self.assertEqual(retrieved_person.model_scores, {"match": 0.95})
        
        # Get persons by user
        user_persons = self.service.get_persons_by_user(user_id)
        self.assertEqual(len(user_persons), 1)
        self.assertEqual(user_persons[0].cuttyid, 12345)
        
        # Search persons
        search_results = self.service.search_persons(user_id, "John")
        self.assertEqual(len(search_results), 1)
        self.assertEqual(search_results[0].firstname, "John")
        
        # Update person
        success = self.service.update_person(12345, {"email": "newemail@example.com"})
        self.assertTrue(success)
        
        # Verify update
        updated_person = self.service.get_person_by_cuttyid(12345)
        self.assertEqual(updated_person.email, "newemail@example.com")
    
    def test_file_relationship_operations(self):
        """Test file relationship operations"""
        # Create test user and files
        user = User(username="reluser", password="pass", email="rel@test.com")
        user_id = self.service.create_user(user)
        
        file1 = SavedFile(
            user_id=user_id, file_id="file1", file_name="original.csv", file_path="/tmp/original.csv"
        )
        file2 = SavedFile(
            user_id=user_id, file_id="file2", file_name="filtered.csv", file_path="/tmp/filtered.csv"
        )
        
        self.service.create_saved_file(file1)
        self.service.create_saved_file(file2)
        
        # Create file relationship
        rel_id = self.service.create_file_relationship(
            "file1", "file2", "CUT_FROM", {"operation": "filter"}
        )
        self.assertIsInstance(rel_id, int)
        
        # Get file lineage
        lineage = self.service.get_file_lineage("file2")
        self.assertEqual(lineage["cut_from"], ["file1"])
        self.assertEqual(lineage["cut_to"], [])
        
        lineage_file1 = self.service.get_file_lineage("file1")
        self.assertEqual(lineage_file1["cut_from"], [])
        self.assertEqual(lineage_file1["cut_to"], ["file2"])
        
        # Get file relationship tree
        tree = self.service.get_file_relationship_tree("file1")
        self.assertEqual(tree["file_id"], "file1")
        self.assertEqual(tree["descendants"], ["file2"])
        self.assertEqual(tree["ancestors"], [])
    
    def test_json_validation(self):
        """Test JSON field validation"""
        # Create test user
        user = User(username="jsonuser", password="pass", email="json@test.com")
        user_id = self.service.create_user(user)
        
        # Test valid JSON in saved file
        valid_file = SavedFile(
            user_id=user_id,
            file_id="valid-json",
            file_name="test.csv",
            file_path="/tmp/test.csv",
            system_tags=["tag1", "tag2"],  # Valid list
            metadata={"key": "value"}  # Valid dict
        )
        
        file_id = self.service.create_saved_file(valid_file)
        self.assertIsInstance(file_id, int)
        
        # Retrieve and verify JSON parsing
        retrieved = self.service.get_saved_file_by_id("valid-json")
        self.assertEqual(retrieved.system_tags, ["tag1", "tag2"])
        self.assertEqual(retrieved.metadata, {"key": "value"})


class TestD1Integration(unittest.TestCase):
    """Test D1 integration scenarios"""
    
    @patch('db.d1_service.subprocess.run')
    def test_wrangler_integration(self, mock_subprocess):
        """Test integration with Wrangler CLI (mocked)"""
        # Mock successful wrangler response
        mock_subprocess.return_value.returncode = 0
        mock_subprocess.return_value.stdout = '[{"results": [{"count": 5}], "success": true}]'
        
        service = D1DatabaseService()
        # This would normally test actual wrangler integration
        # For now, just verify the service can be created
        self.assertIsNotNone(service)
    
    def test_data_type_conversions(self):
        """Test critical data type conversions for SQLite compatibility"""
        # Test boolean conversions
        self.assertEqual(User(is_active=True).to_dict()['is_active'], 1)
        self.assertEqual(User(is_active=False).to_dict()['is_active'], 0)
        
        # Test JSON serialization
        saved_file = SavedFile(
            system_tags=["tag1", "tag2"],
            metadata={"nested": {"key": "value"}}
        )
        file_dict = saved_file.to_dict()
        self.assertEqual(file_dict['system_tags'], '["tag1", "tag2"]')
        self.assertIn('"nested"', file_dict['metadata'])
        
        # Test round-trip conversion
        reconstructed = SavedFile.from_dict(file_dict)
        self.assertEqual(reconstructed.system_tags, ["tag1", "tag2"])
        self.assertEqual(reconstructed.metadata["nested"]["key"], "value")


if __name__ == '__main__':
    unittest.main()
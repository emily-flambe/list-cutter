"""
Tests for Hybrid Database Service
Tests the service layer that can use either Django ORM or D1
"""

import unittest
from unittest.mock import patch, MagicMock, Mock
from django.test import TestCase
from django.contrib.auth.models import User as DjangoUser
from django.utils import timezone

from db.hybrid_service import HybridDatabaseService
from db.d1_service import User as D1User, SavedFile as D1SavedFile
from list_cutter.models import SavedFile as DjangoSavedFile
from contacts.models import Person as DjangoPerson


class TestHybridServiceConfiguration(unittest.TestCase):
    """Test hybrid service configuration and feature flags"""
    
    @patch('db.hybrid_service.settings')
    def test_feature_flag_initialization(self, mock_settings):
        """Test feature flag configuration"""
        # Mock settings
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': True}
        mock_settings.PHASE_4_FEATURES = {
            'use_d1_for_users': True,
            'use_d1_for_files': False,
            'use_d1_for_persons': True,
            'use_d1_for_relationships': False
        }
        
        service = HybridDatabaseService()
        
        # Test feature flag methods
        self.assertTrue(service._use_d1_for_users())
        self.assertFalse(service._use_d1_for_files())
        self.assertTrue(service._use_d1_for_persons())
        self.assertFalse(service._use_d1_for_relationships())
    
    @patch('db.hybrid_service.settings')
    def test_d1_disabled_configuration(self, mock_settings):
        """Test configuration when D1 is disabled"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {
            'use_d1_for_users': True,  # Should be ignored when D1 is disabled
            'use_d1_for_files': True,
            'use_d1_for_persons': True,
            'use_d1_for_relationships': True
        }
        
        service = HybridDatabaseService()
        
        # All should return False when D1 is disabled
        self.assertFalse(service._use_d1_for_users())
        self.assertFalse(service._use_d1_for_files())
        self.assertFalse(service._use_d1_for_persons())
        self.assertFalse(service._use_d1_for_relationships())


class TestHybridServiceUserOperations(TestCase):
    """Test user operations with both Django ORM and D1"""
    
    def setUp(self):
        """Set up test data"""
        self.django_user = DjangoUser.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
    
    @patch('db.hybrid_service.settings')
    def test_get_user_by_id_django(self, mock_settings):
        """Test getting user by ID using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_users': False}
        
        service = HybridDatabaseService()
        user_data = service.get_user_by_id(self.django_user.id)
        
        self.assertIsNotNone(user_data)
        self.assertEqual(user_data['username'], 'testuser')
        self.assertEqual(user_data['email'], 'test@example.com')
        self.assertEqual(user_data['first_name'], 'Test')
        self.assertEqual(user_data['last_name'], 'User')
        self.assertTrue(user_data['is_active'])
    
    @patch('db.hybrid_service.settings')
    @patch('db.hybrid_service.D1DatabaseService')
    def test_get_user_by_id_d1(self, mock_d1_service_class, mock_settings):
        """Test getting user by ID using D1"""
        # Mock settings for D1 usage
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': True}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_users': True}
        
        # Mock D1 service
        mock_d1_service = MagicMock()
        mock_d1_service_class.return_value = mock_d1_service
        
        # Mock D1 user response
        mock_d1_user = D1User(
            id=1,
            username='testuser',
            email='test@example.com',
            first_name='Test',
            last_name='User'
        )
        mock_d1_service.get_user_by_id.return_value = mock_d1_user
        
        service = HybridDatabaseService()
        user_data = service.get_user_by_id(1)
        
        self.assertIsNotNone(user_data)
        self.assertEqual(user_data['username'], 'testuser')
        mock_d1_service.get_user_by_id.assert_called_once_with(1)
    
    @patch('db.hybrid_service.settings')
    def test_get_user_by_username_django(self, mock_settings):
        """Test getting user by username using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_users': False}
        
        service = HybridDatabaseService()
        user_data = service.get_user_by_username('testuser')
        
        self.assertIsNotNone(user_data)
        self.assertEqual(user_data['id'], self.django_user.id)
        self.assertEqual(user_data['username'], 'testuser')
    
    def test_get_nonexistent_user(self):
        """Test getting non-existent user returns None"""
        with patch('db.hybrid_service.settings') as mock_settings:
            mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
            mock_settings.PHASE_4_FEATURES = {'use_d1_for_users': False}
            
            service = HybridDatabaseService()
            user_data = service.get_user_by_id(99999)
            
            self.assertIsNone(user_data)


class TestHybridServiceFileOperations(TestCase):
    """Test saved file operations with both Django ORM and D1"""
    
    def setUp(self):
        """Set up test data"""
        self.django_user = DjangoUser.objects.create_user(
            username='fileuser',
            email='file@example.com',
            password='filepass123'
        )
        
        self.django_file = DjangoSavedFile.objects.create(
            user=self.django_user,
            file_id='test-file-123',
            file_name='test.csv',
            file_path='/tmp/test.csv',
            system_tags=['uploaded'],
            user_tags=['important'],
            metadata={'size': 1024}
        )
    
    @patch('db.hybrid_service.settings')
    def test_get_saved_file_django(self, mock_settings):
        """Test getting saved file using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_files': False}
        
        service = HybridDatabaseService()
        file_data = service.get_saved_file_by_id('test-file-123')
        
        self.assertIsNotNone(file_data)
        self.assertEqual(file_data['file_id'], 'test-file-123')
        self.assertEqual(file_data['file_name'], 'test.csv')
        self.assertEqual(file_data['user_id'], self.django_user.id)
        self.assertEqual(file_data['system_tags'], ['uploaded'])
        self.assertEqual(file_data['metadata'], {'size': 1024})
    
    @patch('db.hybrid_service.settings')
    @patch('db.hybrid_service.D1DatabaseService')
    def test_get_saved_file_d1(self, mock_d1_service_class, mock_settings):
        """Test getting saved file using D1"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': True}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_files': True}
        
        # Mock D1 service
        mock_d1_service = MagicMock()
        mock_d1_service_class.return_value = mock_d1_service
        
        # Mock D1 saved file response
        mock_d1_file = D1SavedFile(
            id=1,
            user_id=1,
            file_id='test-file-123',
            file_name='test.csv',
            file_path='/tmp/test.csv',
            system_tags=['uploaded'],
            metadata={'size': 1024}
        )
        mock_d1_service.get_saved_file_by_id.return_value = mock_d1_file
        
        service = HybridDatabaseService()
        file_data = service.get_saved_file_by_id('test-file-123')
        
        self.assertIsNotNone(file_data)
        self.assertEqual(file_data['file_id'], 'test-file-123')
        mock_d1_service.get_saved_file_by_id.assert_called_once_with('test-file-123')
    
    @patch('db.hybrid_service.settings')
    def test_get_saved_files_by_user_django(self, mock_settings):
        """Test getting saved files by user using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_files': False}
        
        service = HybridDatabaseService()
        files_data = service.get_saved_files_by_user(self.django_user.id)
        
        self.assertEqual(len(files_data), 1)
        self.assertEqual(files_data[0]['file_id'], 'test-file-123')
        self.assertEqual(files_data[0]['user_id'], self.django_user.id)
    
    @patch('db.hybrid_service.settings')
    @patch('db.hybrid_service.DjangoUser')
    def test_create_saved_file_django(self, mock_django_user, mock_settings):
        """Test creating saved file using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_files': False}
        
        # Mock Django user
        mock_user = MagicMock()
        mock_user.id = self.django_user.id
        mock_django_user.objects.get.return_value = mock_user
        
        service = HybridDatabaseService()
        
        with patch('db.hybrid_service.DjangoSavedFile') as mock_saved_file:
            mock_instance = MagicMock()
            mock_instance.id = 123
            mock_saved_file.objects.create.return_value = mock_instance
            
            file_id = service.create_saved_file(
                user_id=self.django_user.id,
                file_id='new-file-456',
                file_name='new.csv',
                file_path='/tmp/new.csv',
                system_tags=['uploaded'],
                user_tags=[],
                metadata={}
            )
            
            self.assertEqual(file_id, 123)
            mock_saved_file.objects.create.assert_called_once()
    
    @patch('db.hybrid_service.settings')
    def test_delete_saved_file_django(self, mock_settings):
        """Test deleting saved file using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_files': False}
        
        service = HybridDatabaseService()
        success = service.delete_saved_file('test-file-123')
        
        self.assertTrue(success)
        
        # Verify file was deleted
        with self.assertRaises(DjangoSavedFile.DoesNotExist):
            DjangoSavedFile.objects.get(file_id='test-file-123')


class TestHybridServicePersonOperations(TestCase):
    """Test person operations with both Django ORM and D1"""
    
    def setUp(self):
        """Set up test data"""
        self.django_user = DjangoUser.objects.create_user(
            username='personuser',
            email='person@example.com',
            password='personpass123'
        )
        
        self.django_person = DjangoPerson.objects.create(
            cuttyid=12345,
            created_by=self.django_user,
            firstname='John',
            lastname='Doe',
            email='john@example.com',
            active=True,
            deceased=False,
            model_scores={'match_score': 0.95},
            system_tags=['verified'],
            user_tags=['important']
        )
    
    @patch('db.hybrid_service.settings')
    def test_get_person_django(self, mock_settings):
        """Test getting person using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_persons': False}
        
        service = HybridDatabaseService()
        person_data = service.get_person_by_cuttyid(12345)
        
        self.assertIsNotNone(person_data)
        self.assertEqual(person_data['cuttyid'], 12345)
        self.assertEqual(person_data['firstname'], 'John')
        self.assertEqual(person_data['lastname'], 'Doe')
        self.assertEqual(person_data['created_by_id'], self.django_user.id)
        self.assertTrue(person_data['active'])
        self.assertFalse(person_data['deceased'])
    
    @patch('db.hybrid_service.settings')
    def test_get_persons_by_user_django(self, mock_settings):
        """Test getting persons by user using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_persons': False}
        
        service = HybridDatabaseService()
        persons_data = service.get_persons_by_user(self.django_user.id)
        
        self.assertEqual(len(persons_data), 1)
        self.assertEqual(persons_data[0]['cuttyid'], 12345)
        self.assertEqual(persons_data[0]['firstname'], 'John')
    
    @patch('db.hybrid_service.settings')
    def test_search_persons_django(self, mock_settings):
        """Test searching persons using Django ORM"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_persons': False}
        
        service = HybridDatabaseService()
        
        # Search by first name
        results = service.search_persons(self.django_user.id, 'John')
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['firstname'], 'John')
        
        # Search by last name
        results = service.search_persons(self.django_user.id, 'Doe')
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['lastname'], 'Doe')
        
        # Search by email
        results = service.search_persons(self.django_user.id, 'john@example.com')
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['email'], 'john@example.com')
        
        # Search with no results
        results = service.search_persons(self.django_user.id, 'nonexistent')
        self.assertEqual(len(results), 0)


class TestHybridServiceRelationshipOperations(TestCase):
    """Test file relationship operations with both Neo4j and D1"""
    
    def setUp(self):
        """Set up test data"""
        self.django_user = DjangoUser.objects.create_user(
            username='reluser',
            email='rel@example.com',
            password='relpass123'
        )
        
        # Create test files
        self.file1 = DjangoSavedFile.objects.create(
            user=self.django_user,
            file_id='file1',
            file_name='original.csv',
            file_path='/tmp/original.csv'
        )
        
        self.file2 = DjangoSavedFile.objects.create(
            user=self.django_user,
            file_id='file2',
            file_name='filtered.csv',
            file_path='/tmp/filtered.csv'
        )
    
    @patch('db.hybrid_service.settings')
    @patch('db.hybrid_service.SavedFileNode')
    def test_get_file_lineage_neo4j(self, mock_saved_file_node, mock_settings):
        """Test getting file lineage using Neo4j"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_relationships': False}
        
        # Mock Neo4j node
        mock_node = MagicMock()
        mock_node.file_id = 'file1'
        
        # Mock relationships
        mock_cut_from_rel = MagicMock()
        mock_cut_from_rel.file_id = 'source_file'
        mock_node.CUT_FROM.all.return_value = [mock_cut_from_rel]
        
        mock_cut_to_rel = MagicMock()
        mock_cut_to_rel.file_id = 'file2'
        mock_node.CUT_TO.all.return_value = [mock_cut_to_rel]
        
        mock_saved_file_node.nodes.get.return_value = mock_node
        
        service = HybridDatabaseService()
        lineage = service.get_file_lineage('file1')
        
        self.assertEqual(lineage['cut_from'], ['source_file'])
        self.assertEqual(lineage['cut_to'], ['file2'])
    
    @patch('db.hybrid_service.settings')
    @patch('db.hybrid_service.D1DatabaseService')
    def test_get_file_lineage_d1(self, mock_d1_service_class, mock_settings):
        """Test getting file lineage using D1"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': True}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_relationships': True}
        
        # Mock D1 service
        mock_d1_service = MagicMock()
        mock_d1_service_class.return_value = mock_d1_service
        
        # Mock lineage response
        mock_lineage = {
            'cut_from': ['source_file'],
            'cut_to': ['target_file']
        }
        mock_d1_service.get_file_lineage.return_value = mock_lineage
        
        service = HybridDatabaseService()
        lineage = service.get_file_lineage('file1')
        
        self.assertEqual(lineage['cut_from'], ['source_file'])
        self.assertEqual(lineage['cut_to'], ['target_file'])
        mock_d1_service.get_file_lineage.assert_called_once_with('file1')


class TestHybridServiceErrorHandling(TestCase):
    """Test error handling in hybrid service"""
    
    @patch('db.hybrid_service.settings')
    def test_database_connection_error(self, mock_settings):
        """Test handling of database connection errors"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_users': False}
        
        service = HybridDatabaseService()
        
        # Test with invalid user ID
        user_data = service.get_user_by_id(-1)
        self.assertIsNone(user_data)
    
    @patch('db.hybrid_service.settings')
    @patch('db.hybrid_service.D1DatabaseService')
    def test_d1_service_unavailable(self, mock_d1_service_class, mock_settings):
        """Test handling when D1 service is unavailable"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': True}
        mock_settings.PHASE_4_FEATURES = {'use_d1_for_users': True}
        
        # Mock D1 service initialization failure
        mock_d1_service_class.side_effect = Exception("D1 service unavailable")
        
        # Service should still initialize but d1_service will be None
        service = HybridDatabaseService()
        
        # This should fall back to Django behavior since d1_service is None
        self.assertFalse(service._use_d1_for_users())


if __name__ == '__main__':
    unittest.main()
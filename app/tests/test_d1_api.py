"""
Tests for D1-compatible API endpoints
Tests the Phase 4 API views that use the hybrid database service
"""

import json
import tempfile
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken


class TestPhase4APIEndpoints(APITestCase):
    """Test Phase 4 D1-compatible API endpoints"""
    
    def setUp(self):
        """Set up test environment"""
        self.client = APIClient()
        
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Get JWT token
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)
        
        # Set authorization header
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
    
    def test_phase4_health_check(self):
        """Test Phase 4 health check endpoint"""
        with patch('list_cutter.views_d1.settings') as mock_settings:
            mock_settings.PHASE_4_FEATURES = {
                'use_d1_for_users': False,
                'use_d1_for_files': True,
                'use_d1_for_persons': False,
                'use_d1_for_relationships': True
            }
            mock_settings.D1_DATABASE_CONFIG = {
                'use_d1': True,
                'database_name': 'test-db'
            }
            
            url = '/api/v2/list_cutter/health/'
            response = self.client.get(url)
            
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            data = response.json()
            
            self.assertEqual(data['phase'], 4)
            self.assertEqual(data['status'], 'active')
            self.assertIn('feature_flags', data)
            self.assertIn('d1_database', data)
            self.assertTrue(data['d1_database']['enabled'])
    
    @patch('list_cutter.views_d1.db_service')
    def test_upload_file_d1(self, mock_db_service):
        """Test file upload using D1 hybrid service"""
        # Mock the hybrid service
        mock_db_service.create_saved_file.return_value = 123
        
        # Create a test file
        test_file_content = "name,age\nJohn,30\nJane,25"
        test_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        test_file.write(test_file_content.encode())
        test_file.close()
        
        url = '/api/v2/list_cutter/upload/'
        
        with open(test_file.name, 'rb') as f:
            response = self.client.post(url, {
                'file': f
            }, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertEqual(data['message'], 'File uploaded successfully')
        self.assertIn('file_id', data)
        self.assertIn('file_name', data)
        self.assertIn('file_path', data)
        
        # Verify the hybrid service was called
        mock_db_service.create_saved_file.assert_called_once()
        
        # Clean up
        import os
        os.unlink(test_file.name)
    
    @patch('list_cutter.views_d1.db_service')
    def test_list_saved_files_d1(self, mock_db_service):
        """Test listing saved files using D1 hybrid service"""
        # Mock the hybrid service response
        mock_files = [
            {
                'file_id': 'file1',
                'file_name': 'test1.csv',
                'file_path': '/tmp/test1.csv',
                'uploaded_at': '2024-01-15T10:30:00',
                'system_tags': ['uploaded'],
                'user_tags': ['important'],
                'metadata': {'size': 1024}
            },
            {
                'file_id': 'file2',
                'file_name': 'test2.csv',
                'file_path': '/tmp/test2.csv',
                'uploaded_at': '2024-01-15T11:00:00',
                'system_tags': ['uploaded', 'processed'],
                'user_tags': [],
                'metadata': {'size': 2048}
            }
        ]
        mock_db_service.get_saved_files_by_user.return_value = mock_files
        
        url = '/api/v2/list_cutter/list_saved_files/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertIn('files', data)
        self.assertEqual(len(data['files']), 2)
        
        file1 = data['files'][0]
        self.assertEqual(file1['file_id'], 'file1')
        self.assertEqual(file1['file_name'], 'test1.csv')
        self.assertEqual(file1['system_tags'], ['uploaded'])
        self.assertEqual(file1['metadata'], {'size': 1024})
        
        # Verify the hybrid service was called with correct parameters
        mock_db_service.get_saved_files_by_user.assert_called_once_with(self.user.id, 100, 0)
    
    @patch('list_cutter.views_d1.db_service')
    @patch('os.path.exists')
    @patch('os.remove')
    def test_delete_file_d1(self, mock_remove, mock_exists, mock_db_service):
        """Test file deletion using D1 hybrid service"""
        # Mock file exists
        mock_exists.return_value = True
        
        # Mock the hybrid service responses
        mock_file_data = {
            'file_id': 'test-file-123',
            'user_id': self.user.id,
            'file_path': '/tmp/test.csv'
        }
        mock_db_service.get_saved_file_by_id.return_value = mock_file_data
        mock_db_service.delete_saved_file.return_value = True
        
        url = '/api/v2/list_cutter/delete/test-file-123/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify the hybrid service was called
        mock_db_service.get_saved_file_by_id.assert_called_once_with('test-file-123')
        mock_db_service.delete_saved_file.assert_called_once_with('test-file-123')
        
        # Verify file was removed from filesystem
        mock_remove.assert_called_once_with('/tmp/test.csv')
    
    @patch('list_cutter.views_d1.db_service')
    def test_delete_file_not_found(self, mock_db_service):
        """Test deleting non-existent file"""
        # Mock file not found
        mock_db_service.get_saved_file_by_id.return_value = None
        
        url = '/api/v2/list_cutter/delete/nonexistent-file/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertEqual(data['error'], 'File not found.')
    
    @patch('list_cutter.views_d1.db_service')
    def test_delete_file_wrong_user(self, mock_db_service):
        """Test deleting file that belongs to another user"""
        # Mock file belonging to different user
        mock_file_data = {
            'file_id': 'test-file-123',
            'user_id': 999,  # Different user ID
            'file_path': '/tmp/test.csv'
        }
        mock_db_service.get_saved_file_by_id.return_value = mock_file_data
        
        url = '/api/v2/list_cutter/delete/test-file-123/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertEqual(data['error'], 'File not found.')
    
    @patch('list_cutter.views_d1.db_service')
    def test_save_generated_file_with_lineage(self, mock_db_service):
        """Test saving generated file with lineage tracking"""
        # Mock the hybrid service
        mock_db_service.create_saved_file.return_value = 456
        mock_db_service.create_file_relationship.return_value = 789
        
        # Create test file content
        test_file_content = "filtered_name,filtered_age\nJohn,30"
        test_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        test_file.write(test_file_content.encode())
        test_file.close()
        
        url = '/api/v2/list_cutter/save_generated_file/'
        
        with open(test_file.name, 'rb') as f:
            response = self.client.post(url, {
                'file': f,
                'file_name': 'filtered_data.csv',
                'metadata': json.dumps({'operation': 'filter', 'rows_removed': 1}),
                'original_file_id': 'original-file-123'
            }, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        
        self.assertEqual(data['message'], 'File saved successfully.')
        self.assertIn('file_id', data)
        self.assertIn('file_path', data)
        
        # Verify saved file creation
        mock_db_service.create_saved_file.assert_called_once()
        
        # Verify file relationship creation
        mock_db_service.create_file_relationship.assert_called_once()
        args, kwargs = mock_db_service.create_file_relationship.call_args
        self.assertEqual(args[0], 'original-file-123')  # source_file_id
        self.assertEqual(args[2], 'CUT_FROM')  # relationship_type
        
        # Clean up
        import os
        os.unlink(test_file.name)
    
    @patch('list_cutter.views_d1.db_service')
    def test_fetch_file_lineage_d1(self, mock_db_service):
        """Test fetching file lineage using hybrid service"""
        # Mock the hybrid service responses
        mock_lineage = {
            'cut_from': ['source-file-1', 'source-file-2'],
            'cut_to': ['target-file-1']
        }
        mock_db_service.get_file_lineage.return_value = mock_lineage
        
        # Mock file data for node creation
        mock_files = {
            'current-file': {'file_name': 'current.csv'},
            'source-file-1': {'file_name': 'source1.csv'},
            'source-file-2': {'file_name': 'source2.csv'},
            'target-file-1': {'file_name': 'target1.csv'}
        }
        
        def mock_get_saved_file_by_id(file_id):
            return mock_files.get(file_id)
        
        mock_db_service.get_saved_file_by_id.side_effect = mock_get_saved_file_by_id
        
        url = '/api/v2/list_cutter/fetch_file_lineage/current-file/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertIn('nodes', data)
        self.assertIn('edges', data)
        
        # Verify nodes
        node_ids = [node['file_id'] for node in data['nodes']]
        self.assertIn('current-file', node_ids)
        self.assertIn('source-file-1', node_ids)
        self.assertIn('target-file-1', node_ids)
        
        # Verify edges
        self.assertEqual(len(data['edges']), 3)  # 2 cut_from + 1 cut_to
        
        # Check edge types
        edge_types = [edge['type'] for edge in data['edges']]
        self.assertIn('CUT_FROM', edge_types)
        self.assertIn('CUT_TO', edge_types)
    
    @patch('list_cutter.views_d1.db_service')
    def test_fetch_file_tree_d1(self, mock_db_service):
        """Test fetching complete file relationship tree"""
        # Mock the hybrid service response
        mock_tree = {
            'file_id': 'root-file',
            'ancestors': ['ancestor-1', 'ancestor-2'],
            'descendants': ['descendant-1', 'descendant-2']
        }
        mock_db_service.get_file_relationship_tree.return_value = mock_tree
        
        # Mock file data
        mock_files = {
            'root-file': {'file_name': 'root.csv'},
            'ancestor-1': {'file_name': 'ancestor1.csv'},
            'descendant-1': {'file_name': 'descendant1.csv'}
        }
        
        def mock_get_saved_file_by_id(file_id):
            return mock_files.get(file_id)
        
        mock_db_service.get_saved_file_by_id.side_effect = mock_get_saved_file_by_id
        
        url = '/api/v2/list_cutter/fetch_file_tree/root-file/?max_depth=3'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertEqual(data['file_id'], 'root-file')
        self.assertIn('tree', data)
        self.assertIn('nodes', data)
        
        # Verify tree structure
        self.assertEqual(data['tree']['file_id'], 'root-file')
        self.assertEqual(data['tree']['ancestors'], ['ancestor-1', 'ancestor-2'])
        self.assertEqual(data['tree']['descendants'], ['descendant-1', 'descendant-2'])
        
        # Verify the service was called with correct max_depth
        mock_db_service.get_file_relationship_tree.assert_called_once_with('root-file', 3)
    
    @patch('list_cutter.views_d1.db_service')
    def test_update_tags_d1(self, mock_db_service):
        """Test updating file tags using hybrid service"""
        # Mock file data
        mock_file_data = {
            'file_id': 'test-file-123',
            'user_id': self.user.id,
            'user_tags': ['existing_tag']
        }
        mock_db_service.get_saved_file_by_id.return_value = mock_file_data
        
        url = '/api/v2/list_cutter/update_tags/test-file-123/'
        response = self.client.patch(url, {
            'user_tags': ['new_tag', 'another_tag']
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['message'], 'Tags updated successfully.')
        
        # Verify the service was called
        mock_db_service.get_saved_file_by_id.assert_called_once_with('test-file-123')
    
    def test_authentication_required(self):
        """Test that endpoints require authentication"""
        # Remove authentication
        self.client.credentials()
        
        endpoints = [
            '/api/v2/list_cutter/upload/',
            '/api/v2/list_cutter/list_saved_files/',
            '/api/v2/list_cutter/delete/test-file/',
            '/api/v2/list_cutter/save_generated_file/',
            '/api/v2/list_cutter/update_tags/test-file/',
            '/api/v2/list_cutter/fetch_saved_file/test-file/',
            '/api/v2/list_cutter/fetch_file_lineage/test-file/',
            '/api/v2/list_cutter/fetch_file_tree/test-file/'
        ]
        
        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                if 'upload' in endpoint or 'save_generated' in endpoint:
                    response = self.client.post(endpoint)
                elif 'update_tags' in endpoint:
                    response = self.client.patch(endpoint)
                elif 'delete' in endpoint:
                    response = self.client.delete(endpoint)
                else:
                    response = self.client.get(endpoint)
                
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TestPhase4FeatureFlags(APITestCase):
    """Test feature flag behavior in Phase 4 endpoints"""
    
    def setUp(self):
        """Set up test environment"""
        self.client = APIClient()
        
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Get JWT token
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)
        
        # Set authorization header
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
    
    @patch('list_cutter.views_d1.settings')
    def test_feature_flags_in_health_check(self, mock_settings):
        """Test that health check reports feature flag status"""
        mock_settings.PHASE_4_FEATURES = {
            'use_d1_for_users': True,
            'use_d1_for_files': False,
            'use_d1_for_persons': True,
            'use_d1_for_relationships': False
        }
        mock_settings.D1_DATABASE_CONFIG = {
            'use_d1': True,
            'database_name': 'test-db'
        }
        
        url = '/api/v2/list_cutter/health/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertEqual(data['feature_flags']['use_d1_for_users'], True)
        self.assertEqual(data['feature_flags']['use_d1_for_files'], False)
        self.assertEqual(data['feature_flags']['use_d1_for_persons'], True)
        self.assertEqual(data['feature_flags']['use_d1_for_relationships'], False)
    
    @patch('list_cutter.views_d1.settings')
    @patch('list_cutter.views_d1.db_service')
    def test_d1_disabled_fallback(self, mock_db_service, mock_settings):
        """Test fallback behavior when D1 is disabled"""
        mock_settings.D1_DATABASE_CONFIG = {'use_d1': False}
        mock_settings.PHASE_4_FEATURES = {
            'use_d1_for_users': False,
            'use_d1_for_files': False,
            'use_d1_for_persons': False,
            'use_d1_for_relationships': False
        }
        
        url = '/api/v2/list_cutter/health/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertEqual(data['d1_database']['enabled'], False)
        self.assertEqual(data['d1_database']['status'], 'disabled')


class TestPhase4ErrorHandling(APITestCase):
    """Test error handling in Phase 4 endpoints"""
    
    def setUp(self):
        """Set up test environment"""
        self.client = APIClient()
        
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Get JWT token
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)
        
        # Set authorization header
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
    
    @patch('list_cutter.views_d1.db_service')
    def test_database_error_handling(self, mock_db_service):
        """Test handling of database errors"""
        # Mock database error
        mock_db_service.get_saved_files_by_user.side_effect = Exception("Database connection failed")
        
        url = '/api/v2/list_cutter/list_saved_files/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        data = response.json()
        self.assertEqual(data['error'], 'Failed to retrieve files.')
    
    @patch('list_cutter.views_d1.db_service')
    def test_file_upload_error_handling(self, mock_db_service):
        """Test handling of file upload errors"""
        # Mock service error
        mock_db_service.create_saved_file.side_effect = Exception("Storage error")
        
        # Create test file
        test_file_content = "name,age\nJohn,30"
        test_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        test_file.write(test_file_content.encode())
        test_file.close()
        
        url = '/api/v2/list_cutter/upload/'
        
        with open(test_file.name, 'rb') as f:
            response = self.client.post(url, {
                'file': f
            }, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        data = response.json()
        self.assertEqual(data['error'], 'File upload failed. Please try again.')
        
        # Clean up
        import os
        os.unlink(test_file.name)
    
    def test_invalid_file_upload(self):
        """Test upload with invalid file"""
        url = '/api/v2/list_cutter/upload/'
        
        # No file provided
        response = self.client.post(url, {}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertEqual(data['error'], 'No file uploaded')
    
    def test_file_size_limit(self):
        """Test file size limit enforcement"""
        # Create a large test file (mock size check)
        with patch.dict('os.environ', {'MAX_FILE_SIZE': '100'}):  # 100 bytes limit
            large_content = "x" * 200  # 200 bytes
            test_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
            test_file.write(large_content.encode())
            test_file.close()
            
            url = '/api/v2/list_cutter/upload/'
            
            with open(test_file.name, 'rb') as f:
                response = self.client.post(url, {
                    'file': f
                }, format='multipart')
            
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            data = response.json()
            self.assertIn('File size exceeds', data['error'])
            
            # Clean up
            import os
            os.unlink(test_file.name)


if __name__ == '__main__':
    unittest.main()
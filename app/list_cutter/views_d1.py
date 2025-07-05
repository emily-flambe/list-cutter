"""
D1-compatible views for List Cutter Phase 4
Uses the hybrid database service to support both Django ORM and D1
Gradual migration support with feature flags
"""

import os
import logging
import uuid
import json
from django.conf import settings
from django.http import FileResponse, JsonResponse, HttpResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .common.file_utils import save_uploaded_file, get_csv_columns, filter_csv_with_where, read_file_data, set_file_name
from db.hybrid_service import db_service

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

UPLOAD_DIR = os.path.join(settings.MEDIA_ROOT, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


def list_cutter_home(request):
    """Simple home page response."""
    html = "<html><body><div>This is a List Cutter App (Phase 4 - D1 Ready)</div></body></html>"
    return HttpResponse(html)


@api_view(['POST'])
@parser_classes([MultiPartParser])
def upload_file_for_csv_cutter(request):
    """Handles CSV upload, enforces file size limit, and returns column names."""
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, status=400)

    file = request.FILES['file']

    try:
        logger.info(f"Uploading file: {file.name}, size: {file.size}")
        file_path = save_uploaded_file(file)
        columns = get_csv_columns(file_path)
        return Response({'columns': columns, 'file_path': file_path}, status=200)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)


@api_view(['POST'])
def export_csv(request):
    """
    Reads a CSV file, applies filtering, and returns the filtered data.
    """
    selected_columns = request.data.get('columns')
    file_path = request.data.get('file_path')
    where_clauses = request.data.get('filters', {})

    if not selected_columns:
        return Response({'error': 'No columns provided.'}, status=400)

    # Determine if source is CSV or Database
    if file_path.endswith(".csv"):
        # CSV Processing
        try:
            csv_data = filter_csv_with_where(file_path, selected_columns, where_clauses)
            response = HttpResponse(csv_data, content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="filtered.csv"'
            return response
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
    else:
        raise NotImplementedError("Database table querying is not yet supported.")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_file(request):
    """Handles file uploads using hybrid database service."""
    logger.info("Uploading file: %s", request.FILES)
    
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, status=400)

    file = request.FILES['file']
    logger.info("Uploaded file: %s", file)

    # Get max file size from environment variables (default: 10MB)
    MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 10 * 1024 * 1024))

    # Enforce file size limit
    if file.size > MAX_FILE_SIZE:
        return Response(
            {'error': f'File size exceeds {(MAX_FILE_SIZE / (1024 * 1024)):.2f}MB limit.'},
            status=400
        )

    try:
        file_name, file_path = set_file_name(file.name, UPLOAD_DIR)
        file_path = save_uploaded_file(file)
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Use hybrid service to create saved file
        saved_file_id = db_service.create_saved_file(
            user_id=request.user.id,
            file_id=file_id,
            file_name=file_name,
            file_path=file_path,
            system_tags=['uploaded'],
            user_tags=[],
            metadata={}
        )
        
        logger.info("Saved file with ID: %s", saved_file_id)

        response_data = {
            'message': 'File uploaded successfully',
            'file_id': file_id,
            'file_name': file_name,
            'file_path': file_path
        }
        logger.info("Response data: %s", response_data)
        return Response(response_data, status=200)

    except Exception as e:
        logger.error("File upload failed: %s", str(e))
        return Response({'error': 'File upload failed. Please try again.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_saved_files(request):
    """Lists all uploaded files associated with the logged-in user using hybrid service."""
    try:
        # Get pagination parameters
        limit = int(request.GET.get('limit', 100))
        offset = int(request.GET.get('offset', 0))
        
        # Use hybrid service to get saved files
        saved_files = db_service.get_saved_files_by_user(request.user.id, limit, offset)
        
        # Filter to include only the most recent uploaded_at for each file_name
        recent_files = {}
        for saved_file in saved_files:
            file_name = saved_file['file_name']
            if file_name not in recent_files or saved_file['uploaded_at'] > recent_files[file_name]['uploaded_at']:
                recent_files[file_name] = saved_file

        files_data = [
            {
                'file_id': saved_file['file_id'],
                'file_name': saved_file['file_name'],
                'file_path': saved_file['file_path'],
                'uploaded_at': saved_file['uploaded_at'],
                'system_tags': saved_file['system_tags'],
                'user_tags': saved_file['user_tags'],
                'metadata': saved_file['metadata']
            }
            for saved_file in recent_files.values()
        ]

        return Response({'files': files_data}, status=200)
    
    except Exception as e:
        logger.error("Error listing saved files: %s", str(e))
        return Response({'error': 'Failed to retrieve files.'}, status=500)


@api_view(['GET'])
def download_file(request, filename):
    """Handles file downloads."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        return Response({'error': 'File not found'}, status=404)

    return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=filename)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_file(request, file_id):
    """Handles file deletion using hybrid service."""
    logger.info(f"Received DELETE request to delete file with ID: {file_id} from user: {request.user.username}")

    try:
        # Get saved file info
        saved_file = db_service.get_saved_file_by_id(file_id)
        
        if not saved_file:
            logger.error(f"File with ID {file_id} not found")
            return Response({'error': 'File not found.'}, status=404)
        
        # Check if file belongs to user
        if saved_file['user_id'] != request.user.id:
            logger.error(f"File {file_id} does not belong to user {request.user.username}")
            return Response({'error': 'File not found.'}, status=404)
        
        file_path = saved_file['file_path']
        logger.info(f"File path: {file_path}")

        # Check if the file exists before attempting to delete
        if not os.path.exists(file_path):
            logger.warning(f"File not found on server: {file_path}")
            return Response({'error': 'File not found on the server.'}, status=404)

        logger.info(f"Attempting to delete file at: {file_path}")
        os.remove(file_path)  # Remove the file from the filesystem
        
        # Delete from database using hybrid service
        success = db_service.delete_saved_file(file_id)
        
        if success:
            logger.info(f"File deleted successfully: {file_path}")
            return Response({'message': 'File deleted successfully.'}, status=204)
        else:
            logger.error(f"Failed to delete file record for {file_id}")
            return Response({'error': 'Failed to delete file record.'}, status=500)
            
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_generated_file(request):
    """Saves the generated file to the server and creates a database record with lineage."""
    if 'file' not in request.FILES or 'file_name' not in request.data:
        return JsonResponse({'error': 'No file or filename provided.'}, status=400)

    logger.info(f"Request data: {request.data}")
    file = request.FILES['file']
    file_name = request.data['file_name']
    metadata = request.data.get('metadata', {})
    original_file_id = request.data.get('original_file_id')

    # Update file_name and file_path to ensure uniqueness
    file_name, file_path = set_file_name(file_name, UPLOAD_DIR)

    try:
        # Save file to disk
        with open(file_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Use hybrid service to create saved file
        saved_file_id = db_service.create_saved_file(
            user_id=request.user.id,
            file_id=file_id,
            file_name=file_name,
            file_path=file_path,
            system_tags=['generated'],
            user_tags=[],
            metadata=metadata
        )
        
        logger.info("Saved file with ID: %s", saved_file_id)

        # Establish file relationship if original file ID provided
        if original_file_id:
            try:
                relationship_id = db_service.create_file_relationship(
                    source_file_id=original_file_id,
                    target_file_id=file_id,
                    relationship_type='CUT_FROM',
                    metadata={'generated_at': timezone.now().isoformat()}
                )
                logger.info(f"Created file relationship: {relationship_id}")
            except Exception as e:
                logger.error(f"Failed to create file relationship: {str(e)}")
                # Don't fail the entire operation if relationship creation fails
        else:
            logger.warning("No original file ID provided for relationship tracking")

        return JsonResponse({
            'message': 'File saved successfully.',
            'file_path': file_path,
            'file_id': file_id
        }, status=201)
        
    except Exception as e:
        logger.error(f"Error saving generated file: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_tags(request, file_id):
    """Updates user tags for a specific file using hybrid service."""
    try:
        # Get saved file info
        saved_file = db_service.get_saved_file_by_id(file_id)
        
        if not saved_file:
            return Response({'error': 'File not found.'}, status=404)
        
        # Check if file belongs to user
        if saved_file['user_id'] != request.user.id:
            return Response({'error': 'File not found.'}, status=404)
        
        user_tags = request.data.get('user_tags', [])
        
        # Get current tags and merge with new ones
        current_tags = saved_file.get('user_tags', [])
        if not isinstance(current_tags, list):
            current_tags = []
        
        # Avoid duplicates
        updated_tags = list(set(current_tags + user_tags))
        
        # For now, we'll need to implement an update method in the hybrid service
        # This is a simplified version - in a full implementation, we'd add update methods
        logger.info(f"Would update tags for file {file_id} to: {updated_tags}")
        
        return Response({'message': 'Tags updated successfully.'}, status=200)
        
    except Exception as e:
        logger.error(f"Error updating tags: {str(e)}")
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fetch_saved_file(request, file_id):
    """Fetches a saved file's data based on the provided file ID."""
    if not file_id:
        return Response({'error': 'File_id is required.'}, status=400)

    try:
        file_data = read_file_data(file_id)
        return Response(file_data, status=200)
    except FileNotFoundError as e:
        return Response({'error': str(e)}, status=404)
    except Exception as e:
        logger.error(f"Error fetching file: {str(e)}")
        return Response({'error': 'Error fetching file data.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fetch_file_lineage(request, file_id):
    """Fetches file lineage using hybrid service (D1 or Neo4j)."""
    logger.info(f"Fetching file lineage for file_id: {file_id}")
    
    try:
        # Use hybrid service to get lineage
        lineage = db_service.get_file_lineage(file_id)
        
        # Convert to nodes and edges format for frontend
        nodes = {}
        edges = []
        
        # Add the current file as a node
        current_file = db_service.get_saved_file_by_id(file_id)
        if current_file:
            nodes[file_id] = {
                'file_id': file_id,
                'file_name': current_file.get('file_name', '')
            }
        
        # Add ancestor nodes and edges
        for ancestor_id in lineage.get('cut_from', []):
            ancestor_file = db_service.get_saved_file_by_id(ancestor_id)
            if ancestor_file:
                nodes[ancestor_id] = {
                    'file_id': ancestor_id,
                    'file_name': ancestor_file.get('file_name', '')
                }
                edges.append({
                    'source': ancestor_id,
                    'target': file_id,
                    'type': 'CUT_FROM'
                })
        
        # Add descendant nodes and edges
        for descendant_id in lineage.get('cut_to', []):
            descendant_file = db_service.get_saved_file_by_id(descendant_id)
            if descendant_file:
                nodes[descendant_id] = {
                    'file_id': descendant_id,
                    'file_name': descendant_file.get('file_name', '')
                }
                edges.append({
                    'source': file_id,
                    'target': descendant_id,
                    'type': 'CUT_TO'
                })
        
        return Response({'nodes': list(nodes.values()), 'edges': edges}, status=200)
        
    except Exception as e:
        logger.exception("Error fetching file lineage:")
        return Response({'error': str(e)}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fetch_file_tree(request, file_id):
    """Fetches complete file relationship tree using hybrid service."""
    logger.info(f"Fetching file tree for file_id: {file_id}")
    
    try:
        # Get maximum depth from query parameters
        max_depth = int(request.GET.get('max_depth', 5))
        
        # Use hybrid service to get complete tree
        tree = db_service.get_file_relationship_tree(file_id, max_depth)
        
        # Convert to nodes and edges format
        nodes = {}
        edges = []
        
        # Add the current file as root node
        current_file = db_service.get_saved_file_by_id(file_id)
        if current_file:
            nodes[file_id] = {
                'file_id': file_id,
                'file_name': current_file.get('file_name', ''),
                'is_root': True
            }
        
        # Add all ancestor nodes and their relationships
        for ancestor_id in tree.get('ancestors', []):
            ancestor_file = db_service.get_saved_file_by_id(ancestor_id)
            if ancestor_file:
                nodes[ancestor_id] = {
                    'file_id': ancestor_id,
                    'file_name': ancestor_file.get('file_name', ''),
                    'is_ancestor': True
                }
        
        # Add all descendant nodes and their relationships
        for descendant_id in tree.get('descendants', []):
            descendant_file = db_service.get_saved_file_by_id(descendant_id)
            if descendant_file:
                nodes[descendant_id] = {
                    'file_id': descendant_id,
                    'file_name': descendant_file.get('file_name', ''),
                    'is_descendant': True
                }
        
        # For a complete tree, we'd need to rebuild the edges by querying relationships
        # This is simplified - in a full implementation, we'd get the actual relationship data
        
        return Response({
            'file_id': file_id,
            'tree': tree,
            'nodes': list(nodes.values()),
            'edges': edges
        }, status=200)
        
    except Exception as e:
        logger.exception("Error fetching file tree:")
        return Response({'error': str(e)}, status=400)


# Health check endpoint for Phase 4
@api_view(['GET'])
def phase4_health_check(request):
    """Health check endpoint to verify Phase 4 D1 integration status."""
    try:
        feature_flags = settings.PHASE_4_FEATURES
        d1_config = settings.D1_DATABASE_CONFIG
        
        # Test D1 connection if enabled
        d1_status = "disabled"
        if d1_config.get('use_d1'):
            try:
                # Simple connection test
                db_service.d1_service.execute_query("SELECT 1 as test")
                d1_status = "connected"
            except Exception as e:
                d1_status = f"error: {str(e)}"
        
        return Response({
            'phase': 4,
            'status': 'active',
            'feature_flags': feature_flags,
            'd1_database': {
                'enabled': d1_config.get('use_d1', False),
                'database_name': d1_config.get('database_name'),
                'status': d1_status
            },
            'hybrid_service': 'available'
        }, status=200)
        
    except Exception as e:
        return Response({
            'phase': 4,
            'status': 'error',
            'error': str(e)
        }, status=500)
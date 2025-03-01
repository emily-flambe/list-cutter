import os
import logging
from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.http import HttpResponse
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from django.utils import timezone
import uuid
import json
from .common.file_utils import save_uploaded_file, get_csv_columns, filter_csv_with_where, read_file_data, set_file_name
from .models import SavedFile
from .graph_models import SavedFileNode

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

UPLOAD_DIR = os.path.join(settings.MEDIA_ROOT, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

def list_cutter_home(request):
    """Simple home page response."""
    html = "<html><body><div>This is a List Cutter App (lol)</div></body></html>"
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
    
    TODO: Handle database table queries in the future.
    For now, this function only supports CSV files.
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
        # TODO: Implement database query handling in the future.
        # For now, raise an error since the frontend should only send CSV files.
        raise NotImplementedError("Database table querying is not yet supported.")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_file(request):
    """Handles file uploads, enforces file size limit, and saves metadata in the database."""
    logger.info("Uploading file: %s", request.FILES)
    # Ensure a file is provided
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, status=400)

    file = request.FILES['file']
    # print file path to console
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
        # Save file path to disk. This will be the full path to the file.
        file_path = save_uploaded_file(file)

        # Save file metadata in the database
        saved_file = SavedFile.objects.create(
            user=request.user,
            file_path=file_path,
            file_name=file_name,
            file_id=uuid.uuid4(),
            system_tags=['uploaded'],
            uploaded_at=timezone.now()
        )
        logger.info("Saved file: %s", saved_file)

        # Create a SavedFileNode with the same file_id as the SavedFile object
        saved_file_node = SavedFileNode(
            file_id=saved_file.file_id,
            file_name=saved_file.file_name,
            file_path=saved_file.file_path,
            metadata=json.dumps(saved_file.metadata) if saved_file.metadata else ""
        )
        saved_file_node.save()
        logger.info("Saved file node: %s", saved_file_node)

        response_data = {
            'message': 'File uploaded successfully',
            'file_id': saved_file.file_id,
            'file_name': saved_file.file_name,
            'file_path': saved_file.file_path
        }
        logger.info("Response data: %s", response_data)
        return Response(
            {'message': 'File uploaded successfully', 'file_id': saved_file.file_id, 'file_name': saved_file.file_name, 'file_path': saved_file.file_path},
            status=200
        )

    except Exception as e:
        logger.error("File upload failed: %s", str(e))
        return Response({'error': 'File upload failed. Please try again.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_saved_files(request):
    """Lists all uploaded files associated with the logged-in user."""
    # Fetch SavedFile objects for the logged-in user
    uploaded_files = SavedFile.objects.filter(user=request.user)

    # Prepare the response data, filtering to include only the most recent uploaded_at for each file_name
    recent_files = {}
    for uploaded_file in uploaded_files:
        if uploaded_file.file_name not in recent_files or uploaded_file.uploaded_at > recent_files[uploaded_file.file_name].uploaded_at:
            recent_files[uploaded_file.file_name] = uploaded_file

    files_data = [
        {
            'file_id': getattr(uploaded_file, 'file_id', None),
            'file_name': uploaded_file.file_name,
            'file_path': uploaded_file.file_path,
            'uploaded_at': uploaded_file.uploaded_at,
            'system_tags': uploaded_file.system_tags,
            'user_tags': uploaded_file.user_tags,
            'metadata': uploaded_file.metadata
        }
        for uploaded_file in recent_files.values()
    ]

    return Response({'files': files_data}, status=200)

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
    """Handles file deletion."""
    logger.info(f"Received DELETE request to delete file with ID: {file_id} from user: {request.user.username}")

    try:
        uploaded_file = SavedFile.objects.get(file_id=file_id, user=request.user)
        file_path = uploaded_file.file_path  # Get the file path from the database
        logger.info(f"File path: {file_path}")

        # Check if the file exists before attempting to delete
        if not os.path.exists(file_path):
            logger.warning(f"File not found on server: {file_path}")
            return Response({'error': 'File not found on the server.'}, status=404)

        logger.info(f"Attempting to delete file at: {file_path}")
        os.remove(file_path)  # Remove the file from the filesystem
        uploaded_file.delete()  # Delete the record from the database
        logger.info(f"File deleted successfully: {file_path}")
        return Response({'message': 'File deleted successfully.'}, status=204)
    except SavedFile.DoesNotExist:
        logger.error(f"File with ID {file_id} not found for user: {request.user.username}")
        return Response({'error': 'File not found.'}, status=404)
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_generated_file(request):
    """Saves the generated file to the server and creates a database record."""
    if 'file' not in request.FILES or 'file_name' not in request.data:
        return JsonResponse({'error': 'No file or filename provided.'}, status=400)

    logger.info(f"Request data: {request.data}")
    file = request.FILES['file']
    file_name = request.data['file_name']
    metadata = request.data['metadata']
    original_file_id = request.data.get('original_file_id')

    # Update file_name and file_path to ensure uniqueness
    file_name, file_path = set_file_name(file_name, UPLOAD_DIR)

    try:
        with open(file_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        # Store file metadata in the database
        saved_file = SavedFile.objects.create(
            user=request.user,
            file_name=file_name,
            file_path=file_path,
            file_id=uuid.uuid4(),
            system_tags=['generated'],
            uploaded_at=timezone.now(),
            metadata=metadata
        )
        logger.info("Saved file: %s", saved_file)

        # Create a SavedFileNode and establish a CUT_FROM relationship
        saved_file_node = SavedFileNode(
            file_id=saved_file.file_id,
            file_name=file_name,
            file_path=file_path,
            metadata=metadata
        )
        saved_file_node.save()
        logger.info("Saved file node: %s", saved_file_node)
        logger.info("Updating relationships...")
        # Establish CUT_FROM and CUT_TO relationships
        if original_file_id:
            original_file_node = SavedFileNode.nodes.get(file_id=original_file_id)
            # This syntax looks wrong (to me), but it's correct! CUT_FROM is a RelationshipFrom and CUT_TO is a RelationshipTo. Graph models, idk man
            original_file_node.CUT_FROM.connect(saved_file_node)
            original_file_node.CUT_TO.connect(saved_file_node)
            logger.info("Relationships updated successfully.")
        else:
            return JsonResponse({'error': 'Original file ID must be included in the request.'}, status=400)

        return JsonResponse({'message': 'File saved successfully.', 'file_path': file_path, 'file_id': saved_file.file_id}, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_tags(request, file_id):
    """Updates user tags for a specific file."""
    try:
        uploaded_file = SavedFile.objects.get(file_id=file_id, user=request.user)
        user_tags = request.data.get('user_tags', [])
        # Ensure user_tags is a list before concatenation
        uploaded_file.user_tags = list(uploaded_file.user_tags) if uploaded_file.user_tags else []
        uploaded_file.user_tags = list(set(uploaded_file.user_tags + user_tags))  # Avoid duplicates
        uploaded_file.save()
        return Response({'message': 'Tags updated successfully.'}, status=200)
    except SavedFile.DoesNotExist:
        return Response({'error': 'File not found.'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fetch_saved_file(request, file_id):
    """Fetches a saved file's data based on the provided file path."""

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
    from neomodel import db
    
    logger.info(f"Fetching file lineage for file_id: {file_id}")
    
    try:
        query = """
        MATCH p = (ancestor:SavedFileNode)-[:CUT_TO*]->(file:SavedFileNode {file_id: $file_id})
        RETURN nodes(p) AS chain, relationships(p) AS rels
        UNION
        MATCH p = (ancestor:SavedFileNode)-[:CUT_FROM*]->(file:SavedFileNode {file_id: $file_id})
        RETURN nodes(p) AS chain, relationships(p) AS rels
        """
        # Run the query using the global db connection.
        results, meta = db.cypher_query(query, {"file_id": file_id})
        
        nodes = {}
        edges = []
        # Each row in results is a tuple (chain, rels)
        for row in results:
            chain, rels = row
            for node in chain:
                nodes[node['file_id']] = {
                    'file_id': node['file_id'],
                    'file_name': node.get('file_name', '')
                }
            for rel in rels:
                edges.append({
                    'source': rel.start_node['file_id'],
                    'target': rel.end_node['file_id'],
                    'type': rel.__class__.__name__  # adjust as needed
                })

        return Response({'nodes': list(nodes.values()), 'edges': edges}, status=200)
    except Exception as e:
        logger.exception("Error fetching file lineage:")
        return Response({'error': str(e)}, status=400)

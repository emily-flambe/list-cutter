import os
import logging
from django.conf import settings
from django.http import FileResponse
from django.http import HttpResponse
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes

from .common.file_utils import save_uploaded_file, get_csv_columns, filter_csv_with_where
from .models import UploadedFile 

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

    # Ensure a file is provided
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, status=400)

    file = request.FILES['file']

    # Get max file size from environment variables (default: 10MB)
    MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 10 * 1024 * 1024))

    # Enforce file size limit
    if file.size > MAX_FILE_SIZE:
        return Response(
            {'error': f'File size exceeds {(MAX_FILE_SIZE / (1024 * 1024)):.2f}MB limit.'},
            status=400
        )

    try:
        # Save file path to disk. This will be the full path to the file.
        file_path = save_uploaded_file(file)

        # Store file metadata in the database
        uploaded_file = UploadedFile.objects.create(
            user=request.user,
            file_name=file.name,
            file_path=file_path
        )

        return Response(
            {'message': 'File uploaded successfully', 'file_id': uploaded_file.id},
            status=200
        )

    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        return Response({'error': 'File upload failed. Please try again.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_uploaded_files(request):
    """Lists all uploaded files associated with the logged-in user."""
    # Fetch UploadedFile objects for the logged-in user
    uploaded_files = UploadedFile.objects.filter(user=request.user)

    # Prepare the response data, filtering to include only the most recent uploaded_at for each file_name
    recent_files = {}
    for uploaded_file in uploaded_files:
        if uploaded_file.file_name not in recent_files or uploaded_file.uploaded_at > recent_files[uploaded_file.file_name].uploaded_at:
            recent_files[uploaded_file.file_name] = uploaded_file

    files_data = [
        {
            'id': uploaded_file.id,
            'file_name': uploaded_file.file_name,
            'file_path': uploaded_file.file_path,
            'uploaded_at': uploaded_file.uploaded_at,
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

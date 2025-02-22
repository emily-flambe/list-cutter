import os
import logging
from django.http import HttpResponse
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .common.file_utils import save_uploaded_file, get_csv_columns, filter_csv_columns

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def list_cutter_home(request):
    """Simple home page response."""
    html = "<html><body><div>This is a List Cutter App (lol)</div></body></html>"
    return HttpResponse(html)

@api_view(['POST'])
@parser_classes([MultiPartParser])
def upload_file(request):
    """Handles CSV upload, enforces file size limit, and returns column names."""
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, status=400)

    file = request.FILES['file']

    try:
        file_path = save_uploaded_file(file)
        columns = get_csv_columns(file_path)
        return Response({'columns': columns, 'file_path': file_path}, status=200)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
def export_csv(request):
    """
    Reads a CSV, filters it to only include requested columns, and returns the filtered CSV.
    """
    selected_columns = request.data.get('columns')
    file_path = request.data.get('file_path')

    logger.info(f"Received file_path: {file_path}")

    if not selected_columns:
        return Response({'error': 'No columns provided.'}, status=400)
    
    if not file_path or not os.path.exists(file_path):
        return Response({'error': 'CSV file not found.'}, status=400)

    try:
        csv_data = filter_csv_columns(file_path, selected_columns)
        response = HttpResponse(csv_data, content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="filtered.csv"'
        return response
    except ValueError as e:
        return Response({'error': str(e)}, status=400)

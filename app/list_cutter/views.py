import os
import pandas as pd
from django.conf import settings
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.http import HttpResponse
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

UPLOAD_DIR = os.path.join(settings.MEDIA_ROOT, 'uploads')  # Temporary storage

# Ensure the directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


def list_cutter_home(request):

    html = "<html><body><div>This is a List Cutter App</div></body></html>"
    return HttpResponse(html)

@api_view(['POST'])
@parser_classes([MultiPartParser])
def upload_file(request):
    """Handle CSV upload, return column names, and delete file"""
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, status=400)

    file = request.FILES['file']
    file_path = os.path.join(UPLOAD_DIR, file.name)

    try:
        # Save the file temporarily
        with open(file_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        # Read CSV and extract column names
        df = pd.read_csv(file_path)
        columns = df.columns.tolist()

        return Response({'columns': columns}, status=200)

    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
def export_csv(request):
    """
    Expects a JSON payload with keys:
      - "columns": list of column names to include
      - "file_path": the path to the uploaded CSV file
    Reads the CSV, filters it to only include the requested columns,
    returns the filtered CSV.
    """
    selected_columns = request.data.get('columns')
    file_path = request.data.get('file_path')
    
    # Log the received file path
    logger.info(f"Received file_path: {file_path}")
    
    if not selected_columns:
        logger.error("No columns provided in the request.")
        return Response({'error': 'No columns provided.'}, status=400)
    
    if not file_path or not os.path.exists(file_path):
        logger.error(f"CSV file not found at path: {file_path}")
        return Response({'error': 'CSV file not found.'}, status=400)
    
    try:
        logger.info(f"Attempting to read CSV file at: {file_path}")
        df = pd.read_csv(file_path)
    except Exception as e:
        logger.exception("Could not read CSV file.")
        return Response({'error': f'Could not read CSV file: {str(e)}'}, status=500)
    
    # Validate and filter the selected columns
    valid_columns = [col for col in selected_columns if col in df.columns]
    if not valid_columns:
        logger.error("None of the selected columns are valid.")
        return Response({'error': 'None of the selected columns are valid.'}, status=400)
    
    filtered_df = df[valid_columns]
    csv_data = filtered_df.to_csv(index=False)
    
    # Prepare the response as a downloadable CSV
    response = HttpResponse(csv_data, content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="filtered.csv"'
    
    logger.info("Filtered CSV generated successfully.")
    return response

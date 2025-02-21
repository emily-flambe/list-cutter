import os
import pandas as pd
from django.conf import settings
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.http import HttpResponse

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

        # Delete file after processing
        os.remove(file_path)

        return Response({'columns': columns}, status=200)

    except Exception as e:
        return Response({'error': str(e)}, status=400)


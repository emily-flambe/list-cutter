import os
import pandas as pd
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(settings.MEDIA_ROOT, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Load file size limit from environment variables (default 10MB)
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 10 * 1024 * 1024))

def save_uploaded_file(file):
    """Saves an uploaded file to the UPLOAD_DIR after validating its size."""
    if file.size > MAX_FILE_SIZE:
        raise ValueError(f'File size exceeds {(MAX_FILE_SIZE / (1024 * 1024)):.2f}MB limit')

    file_path = os.path.join(UPLOAD_DIR, file.name)
    with open(file_path, 'wb+') as destination:
        for chunk in file.chunks():
            destination.write(chunk)

    return file_path

def get_csv_columns(file_path):
    """Reads a CSV file and returns its column names."""
    try:
        df = pd.read_csv(file_path)
        return df.columns.tolist()
    except Exception as e:
        raise ValueError(f"Could not read CSV file: {str(e)}")

def filter_csv_columns(file_path, selected_columns):
    """Filters a CSV file to only include selected columns and returns CSV content."""
    try:
        df = pd.read_csv(file_path)
        valid_columns = [col for col in selected_columns if col in df.columns]

        if not valid_columns:
            raise ValueError("None of the selected columns are valid.")

        filtered_df = df[valid_columns]
        return filtered_df.to_csv(index=False)
    except Exception as e:
        raise ValueError(f"Error processing CSV: {str(e)}")

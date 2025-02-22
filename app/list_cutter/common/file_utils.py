import os
import pandas as pd
import logging
from django.conf import settings
import re
import csv
from typing import Dict

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

def parse_where_clause(value, condition):
    """Parses and evaluates SQL-like WHERE conditions on CSV data."""
    match = re.match(r'([<>!=]=?|BETWEEN|IN)\s*(.+)', condition, re.IGNORECASE)
    if not match:
        raise ValueError(f"Invalid WHERE clause format: {condition}")

    operator, expression = match.groups()
    
    try:
        value = float(value)  # Try treating it as a number
    except ValueError:
        value = str(value).strip()

    if operator.upper() == "BETWEEN":
        lower, upper = map(float, expression.split("AND"))
        return lower <= value <= upper
    elif operator.upper() == "IN":
        values = [v.strip().strip("'\"") for v in expression.split(",")]
        return str(value) in values
    elif operator == ">":
        return float(value) > float(expression)
    elif operator == "<":
        return float(value) < float(expression)
    elif operator == ">=":
        return float(value) >= float(expression)
    elif operator == "<=":
        return float(value) <= float(expression)
    elif operator == "!=":
        return str(value) != str(expression)
    elif operator == "=" or operator == "==":
        return str(value) == str(expression)

    return True  # Default (no filtering)

def filter_csv_with_where(file_path, selected_columns, where_clauses: Dict[str, str]):
    """Filters a CSV file based on selected columns and SQL-like WHERE clauses."""
    output_rows = []

    with open(file_path, "r", newline="") as infile:
        reader = csv.DictReader(infile)
        output_rows.append(selected_columns)  # Write header

        for row in reader:
            include = True
            for col, where_clause in where_clauses.items():
                if col in row:
                    try:
                        if not parse_where_clause(row[col], where_clause):
                            include = False
                            break
                    except ValueError:
                        include = False
                        break

            if include:
                output_rows.append([row[col] for col in selected_columns])

    return "\n".join([",".join(row) for row in output_rows])

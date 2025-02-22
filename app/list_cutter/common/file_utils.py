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
    # If no condition is provided, include all values
    if not condition or condition.strip() == "":
        return True

    match = re.match(r'([<>!=]=?|BETWEEN|IN)\s*(.+)', condition, re.IGNORECASE)
    if not match:
        raise ValueError(f"Invalid WHERE clause format: {condition}")

    operator, expression = match.groups()
    
    # Try converting value to float if possible
    try:
        num_value = float(value)
    except ValueError:
        num_value = str(value).strip()  # Ensure proper string comparison

    if operator.upper() == "BETWEEN":
        # Extract and parse BETWEEN values
        bounds = expression.replace("AND", "").split()
        if len(bounds) != 2:
            raise ValueError(f"Invalid BETWEEN clause: {condition}")
        lower, upper = map(float, bounds)
        return lower <= num_value <= upper if isinstance(num_value, (int, float)) else False

    elif operator.upper() == "IN":
        # Extract values from IN clause (handles both single and multiple values)
        values = re.findall(r"'(.*?)'|\"(.*?)\"|(\S+)", expression)
        values = {v[0] or v[1] or v[2] for v in values if any(v)}  # Convert to set

        return str(num_value) in values  # Ensure exact string matching

    elif operator == ">":
        return num_value > float(expression) if isinstance(num_value, (int, float)) else False
    elif operator == "<":
        return num_value < float(expression) if isinstance(num_value, (int, float)) else False
    elif operator == ">=":
        return num_value >= float(expression) if isinstance(num_value, (int, float)) else False
    elif operator == "<=":
        return num_value <= float(expression) if isinstance(num_value, (int, float)) else False
    elif operator == "!=":
        return str(num_value) != expression.strip("'\"")  # Strip quotes for string comparison
    elif operator == "=" or operator == "==":
        return str(num_value) == expression.strip("'\"")  # Strip quotes for string comparison

    return True

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

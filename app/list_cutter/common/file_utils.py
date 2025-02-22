import os
import pandas as pd
import logging
from django.conf import settings
import re
import csv
from typing import Dict
import logging

logging.basicConfig(level=logging.DEBUG)  # Set global log level to DEBUG
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Ensure your specific logger is also at DEBUG level


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
    if not condition or condition.strip() == "":
        logger.debug(f"Empty filter for value '{value}', including all rows.")
        return True  # No condition = include all rows

    match = re.match(r'([<>!=]=?|BETWEEN|IN)\s*(.+)', condition, re.IGNORECASE)
    if not match:
        logger.error(f"Invalid WHERE clause format: {condition}")
        raise ValueError(f"Invalid WHERE clause format: {condition}")

    operator, expression = match.groups()

    # Convert value to float if possible
    try:
        num_value = float(value)
    except ValueError:
        num_value = None
        value = str(value).strip()  # Ensure clean string comparisons

    logger.debug(f"Filtering: Column Value='{value}', Condition='{condition}'")

    if operator.upper() == "BETWEEN":
        bounds = expression.replace("AND", "").split()
        if len(bounds) != 2:
            logger.error(f"Invalid BETWEEN clause: {condition}")
            raise ValueError(f"Invalid BETWEEN clause: {condition}")
        lower, upper = map(float, bounds)
        result = lower <= num_value <= upper if num_value is not None else False
        logger.debug(f"BETWEEN filter: {lower} <= {num_value} <= {upper} → {result}")
        return result

    elif operator.upper() == "IN":
        # ✅ Fix: Remove parentheses, properly extract values
        expression = expression.strip("()")  # Remove outer parentheses
        values = [v.strip().strip("'\"") for v in expression.split(",")]  # Split & clean values
        
        values_set = set(values)  # Convert to set for faster lookup
        logger.debug(f"IN Clause Parsed Values (Fixed): {values_set}")
        
        result = str(value) in values_set
        logger.debug(f"Checking if '{value}' is in {values_set} → {result}")
        return result

    elif operator == ">":
        result = num_value > float(expression) if num_value is not None else False
    elif operator == "<":
        result = num_value < float(expression) if num_value is not None else False
    elif operator == ">=":
        result = num_value >= float(expression) if num_value is not None else False
    elif operator == "<=":
        result = num_value <= float(expression) if num_value is not None else False
    elif operator == "!=":
        result = value != expression.strip("'\"")  # Strip quotes for string comparison
    elif operator == "=" or operator == "==":
        result = value == expression.strip("'\"")  # Strip quotes for string comparison
    else:
        result = True  # Default (no filtering)

    logger.debug(f"Filter Result: '{value}' {operator} '{expression}' → {result}")
    return result

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

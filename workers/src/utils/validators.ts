import { ApiError } from '../middleware/error';

export function validateFileUpload(file: File): void {
  if (!file) {
    throw new ApiError(400, 'No file uploaded');
  }
  
  const validExtensions = ['.csv', '.txt'];
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!validExtensions.includes(extension)) {
    throw new ApiError(400, 'Invalid file type. Only CSV and TXT files are allowed.');
  }
}

export function validateColumns(
  requestedColumns: string[], 
  availableColumns: string[]
): string[] {
  const validColumns = requestedColumns.filter(col => 
    availableColumns.includes(col)
  );
  
  if (validColumns.length === 0) {
    throw new ApiError(400, 'None of the selected columns are valid.');
  }
  
  return validColumns;
}

export function validateFileSize(size: number, maxSize: number): void {
  if (size > maxSize) {
    throw new ApiError(400, `File size exceeds ${(maxSize / (1024 * 1024)).toFixed(2)}MB limit`);
  }
}

export function generateFileId(): string {
  return crypto.randomUUID();
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}
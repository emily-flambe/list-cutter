import type { Env, ExportRequest } from '../../types';
import { parseCsv, generateCsv } from '../../services/csv/parser';
import { applyFilters } from '../../services/csv/filter';
import { validateColumns } from '../../utils/validators';
import { ApiError } from '../../middleware/error';

export async function handleExportCsv(
  request: Request, 
  env: Env
): Promise<Response> {
  const body = await request.json() as ExportRequest;
  const { columns: selectedColumns, file_path, filters = {} } = body;
  
  if (!selectedColumns || selectedColumns.length === 0) {
    throw new ApiError(400, 'No columns provided.');
  }

  try {
    const file = await env.R2_BUCKET.get(file_path);
    if (!file) {
      throw new ApiError(404, 'File not found');
    }

    const content = await file.text();
    const records = parseCsv(content);

    if (records.length === 0) {
      throw new ApiError(400, 'CSV file is empty or invalid');
    }

    const availableColumns = records[0] ? Object.keys(records[0]) : [];
    const validColumns = validateColumns(selectedColumns, availableColumns);

    const filteredRecords = applyFilters(records, filters);

    const outputRecords = filteredRecords.map(row => {
      const newRow: Record<string, unknown> = {};
      for (const col of validColumns) {
        if (col in row) {
          newRow[col] = row[col];
        }
      }
      return newRow;
    });

    const csvOutput = generateCsv(outputRecords, validColumns);

    return new Response(csvOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="filtered.csv"'
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Export CSV error:', error);
    throw new ApiError(400, `Error processing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
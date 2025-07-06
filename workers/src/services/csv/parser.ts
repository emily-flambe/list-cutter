import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { ApiError } from '../../middleware/error';

export function parseCsv(content: string): Record<string, string>[] {
  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true
    });
    return records;
  } catch (error) {
    throw new ApiError(400, `Could not parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getCsvColumns(content: string): string[] {
  const records = parseCsv(content);
  return records.length > 0 && records[0] ? Object.keys(records[0]) : [];
}

export function generateCsv(
  records: Record<string, unknown>[],
  columns?: string[]
): string {
  const options: {
    header: boolean;
    columns?: string[];
  } = {
    header: true
  };
  
  if (columns) {
    options.columns = columns;
  }
  
  return stringify(records, options);
}
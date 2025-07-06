import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { getSavedFileById } from '../../models/saved_file';
import { getFileFromR2 } from '../../services/storage/r2';
import { parseCsv } from '../../services/csv/parser';
import { ApiError } from '../../middleware/error';

export async function handleFetchSavedFile(
  request: Request,
  env: Env,
  fileId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    
    // Get file metadata
    const savedFile = await getSavedFileById(env, fileId, user.user_id);
    if (!savedFile) {
      throw new ApiError(404, 'File not found');
    }

    // Get file content from R2
    const file = await getFileFromR2(env, savedFile.file_path);
    if (!file) {
      throw new ApiError(404, 'File content not found');
    }

    const content = await file.text();
    
    // For CSV files, parse and return structured data
    if (savedFile.file_name.toLowerCase().endsWith('.csv')) {
      try {
        const records = parseCsv(content);
        const columns = records.length > 0 && records[0] ? Object.keys(records[0]) : [];
        
        return new Response(JSON.stringify({
          file_id: savedFile.file_id,
          file_name: savedFile.file_name,
          columns,
          data: records,
          metadata: savedFile.metadata
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        // If CSV parsing fails, return raw content
        return new Response(JSON.stringify({
          file_id: savedFile.file_id,
          file_name: savedFile.file_name,
          content,
          metadata: savedFile.metadata
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // For non-CSV files, return raw content
    return new Response(JSON.stringify({
      file_id: savedFile.file_id,
      file_name: savedFile.file_name,
      content,
      metadata: savedFile.metadata
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Fetch saved file error:', error);
    throw new ApiError(500, 'Error fetching file data');
  }
}
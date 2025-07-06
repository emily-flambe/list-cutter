import type { Env } from '../../types';
import { getCsvColumns } from '../../services/csv/parser';
import { validateFileUpload, validateFileSize, generateFileId } from '../../utils/validators';
import { ApiError } from '../../middleware/error';

export async function handleCsvCutterUpload(
  request: Request, 
  env: Env
): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  
  if (!file) {
    throw new ApiError(400, 'No file uploaded');
  }

  try {
    validateFileUpload(file);
    
    const maxFileSize = parseInt(env.MAX_FILE_SIZE || '10485760');
    validateFileSize(file.size, maxFileSize);

    const fileId = generateFileId();
    const fileName = `uploads/${fileId}_${file.name}`;
    
    const buffer = await file.arrayBuffer();
    const content = new TextDecoder().decode(buffer);
    
    const columns = getCsvColumns(content);
    
    await env.R2_BUCKET.put(fileName, buffer);
    
    return new Response(JSON.stringify({
      columns,
      file_path: fileName
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('CSV upload error:', error);
    throw new ApiError(400, `Could not read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
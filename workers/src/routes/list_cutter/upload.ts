import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { validateFileUpload, validateFileSize, generateFileId, sanitizeFileName } from '../../utils/validators';
import { saveFileToR2 } from '../../services/storage/r2';
import { createSavedFile } from '../../models/saved_file';
import { ApiError } from '../../middleware/error';

export async function handleUpload(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Verify authentication
    const user = await requireAuth(request, env);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      throw new ApiError(400, 'No file uploaded');
    }

    // Validate file
    validateFileUpload(file);
    
    const maxFileSize = parseInt(env.MAX_FILE_SIZE || '10485760');
    validateFileSize(file.size, maxFileSize);

    // Generate unique file path
    const fileId = generateFileId();
    const timestamp = Date.now();
    const sanitizedName = sanitizeFileName(file.name);
    const baseName = sanitizedName.replace(/\.[^/.]+$/, '');
    const extension = sanitizedName.split('.').pop();
    const fileName = `${baseName}_${timestamp}.${extension}`;
    const filePath = `uploads/${fileId}_${fileName}`;
    
    // Save to R2
    const buffer = await file.arrayBuffer();
    await saveFileToR2(env, filePath, buffer, file.type);
    
    // Save metadata to D1
    const savedFile = await createSavedFile(env, {
      user_id: user.id,
      file_name: fileName,
      file_path: filePath,
      system_tags: ['uploaded'],
      metadata: {
        original_name: file.name,
        file_size: file.size,
        content_type: file.type
      }
    });

    return new Response(JSON.stringify({
      message: 'File uploaded successfully',
      file_id: savedFile.file_id,
      file_name: savedFile.file_name,
      file_path: savedFile.file_path
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('File upload error:', error);
    throw new ApiError(500, 'File upload failed. Please try again.');
  }
}
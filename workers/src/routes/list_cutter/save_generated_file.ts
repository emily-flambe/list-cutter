import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { validateFileUpload, generateFileId, sanitizeFileName } from '../../utils/validators';
import { saveFileToR2 } from '../../services/storage/r2';
import { createSavedFile } from '../../models/saved_file';
import { createFileRelationship } from '../../models/file_lineage';
import { ApiError } from '../../middleware/error';


export async function handleSaveGeneratedFile(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileName = formData.get('file_name') as string | null;
    const metadataStr = formData.get('metadata') as string | null;
    const originalFileId = formData.get('original_file_id') as string | null;
    
    if (!file || !fileName) {
      throw new ApiError(400, 'No file or filename provided');
    }

    let metadata: Record<string, unknown> = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch (error) {
        throw new ApiError(400, 'Invalid metadata JSON');
      }
    }

    // Validate file
    validateFileUpload(file);

    // Generate unique file path
    const fileId = generateFileId();
    const timestamp = Date.now();
    const sanitizedName = sanitizeFileName(fileName);
    const baseName = sanitizedName.replace(/\.[^/.]+$/, '');
    const extension = sanitizedName.split('.').pop();
    const finalFileName = `${baseName}_${timestamp}.${extension}`;
    const filePath = `uploads/${fileId}_${finalFileName}`;
    
    // Save to R2
    const buffer = await file.arrayBuffer();
    await saveFileToR2(env, filePath, buffer, file.type);
    
    // Prepare system tags
    const systemTags = ['generated'];
    if (originalFileId) {
      systemTags.push('derived');
    }
    
    // Save metadata to D1
    const savedFile = await createSavedFile(env, {
      user_id: user.id,
      file_name: finalFileName,
      file_path: filePath,
      system_tags: systemTags,
      metadata: {
        ...metadata,
        original_file_id: originalFileId,
        generated_at: new Date().toISOString(),
        file_size: file.size,
        content_type: file.type
      }
    });

    // Create file relationship if this was generated from another file
    if (originalFileId) {
      await createFileRelationship(env, originalFileId, savedFile.file_id, 'CUT_FROM');
    }

    return new Response(JSON.stringify({
      message: 'File saved successfully',
      file_path: savedFile.file_path,
      file_id: savedFile.file_id
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Save generated file error:', error);
    throw new ApiError(500, 'Failed to save generated file');
  }
}
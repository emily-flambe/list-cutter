import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { getSavedFileById, deleteSavedFile } from '../../models/saved_file';
import { deleteFileFromR2 } from '../../services/storage/r2';
import { ApiError } from '../../middleware/error';

export async function handleDeleteFile(
  request: Request,
  env: Env,
  fileId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    
    // Get file metadata to ensure it exists and belongs to user
    const savedFile = await getSavedFileById(env, fileId, user.id);
    if (!savedFile) {
      throw new ApiError(404, 'File not found');
    }

    // Delete from R2 storage
    await deleteFileFromR2(env, savedFile.file_path);
    
    // Delete from database
    const deleted = await deleteSavedFile(env, fileId, user.id);
    if (!deleted) {
      throw new ApiError(404, 'File not found');
    }

    return new Response(JSON.stringify({
      message: 'File deleted successfully'
    }), {
      status: 204,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Delete file error:', error);
    throw new ApiError(500, 'Failed to delete file');
  }
}
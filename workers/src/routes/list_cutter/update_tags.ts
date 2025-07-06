import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { updateSavedFileTags } from '../../models/saved_file';
import { ApiError } from '../../middleware/error';

interface UpdateTagsRequest {
  user_tags: string[];
}

export async function handleUpdateTags(
  request: Request,
  env: Env,
  fileId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    
    const { user_tags } = await request.json() as UpdateTagsRequest;
    
    if (!Array.isArray(user_tags)) {
      throw new ApiError(400, 'user_tags must be an array');
    }

    const updatedFile = await updateSavedFileTags(env, fileId, user.user_id, user_tags);
    if (!updatedFile) {
      throw new ApiError(404, 'File not found');
    }

    return new Response(JSON.stringify({
      message: 'Tags updated successfully',
      user_tags: updatedFile.user_tags
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Update tags error:', error);
    throw new ApiError(500, 'Failed to update tags');
  }
}
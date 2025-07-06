import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { getCompleteLineage } from '../../models/file_lineage';
import { getSavedFileById } from '../../models/saved_file';
import { ApiError } from '../../middleware/error';

export async function handleFetchFileLineage(
  request: Request,
  env: Env,
  fileId: string
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    
    // Verify the file exists and belongs to the user
    const savedFile = await getSavedFileById(env, fileId, user.user_id);
    if (!savedFile) {
      throw new ApiError(404, 'File not found');
    }

    // Get the complete lineage graph
    const lineage = await getCompleteLineage(env, fileId, user.user_id);

    return new Response(JSON.stringify(lineage), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Fetch file lineage error:', error);
    throw new ApiError(500, 'Failed to retrieve file lineage');
  }
}
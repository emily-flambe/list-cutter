import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { getSavedFilesByUser } from '../../models/saved_file';
import { ApiError } from '../../middleware/error';

export async function handleListSavedFiles(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const user = await requireAuth(request, env);
    
    const files = await getSavedFilesByUser(env, user.id);

    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('List files error:', error);
    throw new ApiError(500, 'Failed to list files');
  }
}
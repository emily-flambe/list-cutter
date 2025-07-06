import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { getUserById } from '../../services/storage/d1';
import { ApiError } from '../../middleware/error';

export async function handleGetUser(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const jwtPayload = await requireAuth(request, env);
    
    // Get full user details from database
    const user = await getUserById(env, jwtPayload.user_id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return new Response(JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Get user error:', error);
    throw new ApiError(500, 'Failed to fetch user information');
  }
}
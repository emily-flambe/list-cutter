import type { Env, UserRegistration } from '../../types';
import { createUser } from '../../services/storage/d1';
import { signJWT } from '../../services/auth/jwt';
import { ApiError } from '../../middleware/error';

export async function handleRegister(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const userData = await request.json() as UserRegistration;
    
    // Validate required fields
    if (!userData.username || !userData.password || !userData.password2) {
      throw new ApiError(400, 'Username, password, and password confirmation are required');
    }

    // Create user
    const user = await createUser(env, userData);
    
    // Generate JWT token
    const token = await signJWT(user, env.JWT_SECRET);

    return new Response(JSON.stringify({
      detail: 'User created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Registration error:', error);
    throw new ApiError(400, 'Registration failed');
  }
}
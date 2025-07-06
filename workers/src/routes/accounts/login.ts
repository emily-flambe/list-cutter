import type { Env } from '../../types';
import { authenticateUser } from '../../services/storage/d1';
import { generateTokenPair } from '../../services/auth/jwt';
import { ApiError } from '../../middleware/error';

interface LoginRequest {
  username: string;
  password: string;
}

export async function handleLogin(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const { username, password } = await request.json() as LoginRequest;
    
    // Validate required fields
    if (!username || !password) {
      throw new ApiError(400, 'Username and password are required');
    }

    // Authenticate user
    const user = await authenticateUser(env, username, password);
    if (!user) {
      throw new ApiError(401, 'Invalid username or password');
    }
    
    // Generate JWT token pair
    const tokens = await generateTokenPair(user, env);

    return new Response(JSON.stringify({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      ...tokens
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Login error:', error);
    throw new ApiError(400, 'Login failed');
  }
}
import type { Env, User, UserRegistration } from '../../types';
import { ApiError } from '../../middleware/error';
import { hashPassword, verifyPassword } from '../auth/password';

export async function createUser(
  env: Env,
  userData: UserRegistration
): Promise<User> {
  const { username, email, password, password2 } = userData;

  // Validate passwords match
  if (password !== password2) {
    throw new ApiError(400, 'Passwords do not match');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }

  // Check if user already exists
  const existingUser = await env.DB.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).bind(username, email || null).first();

  if (existingUser) {
    throw new ApiError(400, 'User with this username or email already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Insert user
  await env.DB.prepare(
    'INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, username, email || null, hashedPassword, createdAt).run();

  return {
    id: userId,
    username,
    email: email || '',
    created_at: createdAt
  };
}

export async function authenticateUser(
  env: Env,
  username: string,
  password: string
): Promise<User | null> {
  // Get user from database
  const user = await env.DB.prepare(
    'SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?'
  ).bind(username).first();

  if (!user) {
    return null;
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password_hash as string);
  if (!isValidPassword) {
    return null;
  }

  return {
    id: user.id as string,
    username: user.username as string,
    email: user.email as string || '',
    created_at: user.created_at as string
  };
}

export async function getUserById(env: Env, userId: string): Promise<User | null> {
  const user = await env.DB.prepare(
    'SELECT id, username, email, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    return null;
  }

  return {
    id: user.id as string,
    username: user.username as string,
    email: user.email as string || '',
    created_at: user.created_at as string
  };
}
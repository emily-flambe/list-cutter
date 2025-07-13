import type { Env, User, UserRegistration } from '../../types';

/**
 * Authentication and user management functions for D1 database
 */

/**
 * Authenticate user with username and password
 * @param env Environment with D1 database binding
 * @param username Username to authenticate
 * @param password Plain text password to verify
 * @returns User object if authentication successful, null otherwise
 */
export async function authenticateUser(env: Env, username: string, password: string): Promise<User | null> {
  try {
    // Find user by username
    const result = await env.DB.prepare(`
      SELECT id, username, email, password_hash, is_active, created_at, last_login
      FROM users 
      WHERE username = ? AND is_active = 1
    `).bind(username).first();

    if (!result) {
      return null;
    }

    // Verify password hash (placeholder - would use bcrypt in real implementation)
    const passwordMatch = await verifyPassword(password, result.password_hash as string);
    if (!passwordMatch) {
      return null;
    }

    // Update last login timestamp
    await env.DB.prepare(`
      UPDATE users SET last_login = ? WHERE id = ?
    `).bind(new Date().toISOString(), result.id).run();

    return {
      id: result.id as string,
      username: result.username as string,
      email: result.email as string,
      created_at: result.created_at as string,
      is_active: Boolean(result.is_active),
      last_login: new Date().toISOString()
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Create new user account
 * @param env Environment with D1 database binding
 * @param userData User registration data
 * @returns Created user object
 * @throws Error if user creation fails
 */
export async function createUser(env: Env, userData: UserRegistration): Promise<User> {
  try {
    // Add detailed D1 database debugging
    console.log('🔍 createUser - D1 Database debugging:', {
      has_db_binding: !!env.DB,
      db_binding_constructor: env.DB?.constructor?.name,
      environment: env.ENVIRONMENT || 'development',
      username_attempting: userData.username,
      timestamp: new Date().toISOString()
    });

    // Validate passwords match
    if (userData.password !== userData.password2) {
      throw new Error('Passwords do not match');
    }

    // Validate password strength (basic)
    if (userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }


    // Log before attempting database query
    console.log('🔍 About to query D1 database for existing user...');
    
    // Check if username already exists
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE username = ?
    `).bind(userData.username).first();

    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check if email already exists (if provided)
    if (userData.email) {
      const existingEmail = await env.DB.prepare(`
        SELECT id FROM users WHERE email = ?
      `).bind(userData.email).first();

      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    // Hash password (placeholder - would use bcrypt in real implementation)
    const passwordHash = await hashPassword(userData.password);
    const now = new Date().toISOString();

    // Create user
    const result = await env.DB.prepare(`
      INSERT INTO users (username, email, password_hash, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
      RETURNING id, username, email, created_at
    `).bind(
      userData.username,
      userData.email || null,
      passwordHash,
      now
    ).first();

    if (!result) {
      throw new Error('Failed to create user');
    }

    return {
      id: result.id as string,
      username: result.username as string,
      email: result.email as string,
      created_at: result.created_at as string,
      is_active: true
    };
  } catch (error) {
    console.error('User creation error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('User creation failed');
  }
}

/**
 * Hash password for storage (placeholder implementation)
 * In production, use bcrypt or similar secure hashing
 */
async function hashPassword(password: string): Promise<string> {
  // This is a placeholder - use bcrypt in production!
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt-should-be-random');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Verify password against hash (placeholder implementation)
 * In production, use bcrypt.compare or similar secure verification
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // This is a placeholder - use bcrypt.compare in production!
  const computedHash = await hashPassword(password);
  return computedHash === hash;
}
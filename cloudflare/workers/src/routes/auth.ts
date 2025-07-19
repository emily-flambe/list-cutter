/**
 * Consolidated Authentication Routes
 * 
 * Combines all auth-related endpoints into a single file:
 * - Login/logout
 * - Registration
 * - Token refresh
 * - User profile
 * - Google OAuth
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { generateToken, validateToken, refreshAccessToken, blacklistToken } from '../services/auth/jwt';
import bcrypt from 'bcryptjs';

const auth = new Hono<{ Bindings: Env }>();

// Login endpoint
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Get user from database
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate tokens
    const tokens = await generateToken(
      { user_id: user.id, email: user.email },
      c.env.JWT_SECRET,
      c.env.AUTH_KV
    );

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      },
      tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// Register endpoint
auth.post('/register', async (c) => {
  try {
    const { email, password, username } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Check if user exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json({ error: 'User already exists' }, 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)'
    ).bind(email, passwordHash, username || email.split('@')[0]).run();

    const userId = result.meta.last_row_id;

    // Generate tokens
    const tokens = await generateToken(
      { user_id: userId, email },
      c.env.JWT_SECRET,
      c.env.AUTH_KV
    );

    return c.json({
      success: true,
      user: {
        id: userId,
        email,
        username: username || email.split('@')[0]
      },
      tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// Logout endpoint
auth.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    await blacklistToken(token, c.env.AUTH_KV);

    return c.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Logout failed' }, 500);
  }
});

// Refresh token endpoint
auth.post('/refresh', async (c) => {
  try {
    const { refresh_token } = await c.req.json();
    
    if (!refresh_token) {
      return c.json({ error: 'Refresh token required' }, 400);
    }

    const tokens = await refreshAccessToken(
      refresh_token,
      c.env.JWT_SECRET,
      c.env.AUTH_KV
    );

    return c.json({ success: true, tokens });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({ error: 'Token refresh failed' }, 401);
  }
});

// Get user profile endpoint
auth.get('/user', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);

    // Get user from database
    const user = await c.env.DB.prepare(
      'SELECT id, email, username, created_at FROM users WHERE id = ?'
    ).bind(payload.user_id).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Failed to get user' }, 500);
  }
});

// Google OAuth endpoints (simplified)
auth.get('/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return c.json({ error: 'OAuth not configured' }, 500);
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('openid email profile')}&` +
    `access_type=offline&` +
    `prompt=consent`;

  return c.redirect(authUrl);
});

auth.get('/google/callback', async (c) => {
  try {
    const code = c.req.query('code');
    
    if (!code) {
      return c.json({ error: 'No authorization code provided' }, 400);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: c.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    const { id_token } = await tokenResponse.json();

    // Decode and verify ID token (simplified - in production, verify signature)
    const payload = JSON.parse(atob(id_token.split('.')[1]));
    
    // Create or update user
    const email = payload.email;
    const user = await c.env.DB.prepare(
      'INSERT INTO users (email, username, google_id) VALUES (?, ?, ?) ' +
      'ON CONFLICT(email) DO UPDATE SET google_id = ?, updated_at = CURRENT_TIMESTAMP ' +
      'RETURNING id, email, username'
    ).bind(email, payload.name || email.split('@')[0], payload.sub, payload.sub).first();

    // Generate our own tokens
    const tokens = await generateToken(
      { user_id: user.id, email: user.email },
      c.env.JWT_SECRET,
      c.env.AUTH_KV
    );

    // Redirect to frontend with tokens
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
    return c.redirect(`${frontendUrl}/auth/callback?token=${tokens.access_token}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.json({ error: 'OAuth authentication failed' }, 500);
  }
});

export default auth;
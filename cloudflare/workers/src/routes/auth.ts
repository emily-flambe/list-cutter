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
import { generateToken, generateTokenPair, validateToken, refreshAccessToken, blacklistToken } from '../services/auth/jwt';
import { hashPassword, verifyPassword } from '../services/storage/d1';

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

    // Verify password (skip if user is OAuth-only)
    if (user.password_hash === 'OAUTH_USER') {
      return c.json({ error: 'Please use Google Sign-In for this account' }, 401);
    }
    
    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate tokens with role (use generateTokenPair)
    const tokens = await generateTokenPair(
      { 
        id: user.id,
        user_id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user' // Include role in token
      },
      c.env
    );

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || 'user' // Include role in response
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

    // Check if this is the first user
    const userCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first();
    
    const isFirstUser = userCount?.count === 0;
    const role = isFirstUser ? 'admin' : 'user';

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with role
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, username, role) VALUES (?, ?, ?, ?)'
    ).bind(email, passwordHash, username || email.split('@')[0], role).run();

    const userId = result.meta.last_row_id;

    // Generate tokens with role
    const tokens = await generateTokenPair(
      { 
        id: userId,
        user_id: userId,
        username: username || email.split('@')[0],
        email,
        role 
      },
      c.env
    );

    return c.json({
      success: true,
      user: {
        id: userId,
        email,
        username: username || email.split('@')[0],
        role // Include role in response
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

// Get user profile endpoint - fixed validateToken params
auth.get('/user', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await validateToken(token, c.env.JWT_SECRET);

    // Get user from database including role
    const user = await c.env.DB.prepare(
      'SELECT id, email, username, role, created_at FROM users WHERE id = ?'
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

// Test endpoint to verify route mounting
auth.get('/test-callback', async (c) => {
  return c.json({ message: 'Callback route is working', timestamp: new Date().toISOString() });
});

// Google OAuth endpoints (simplified)
auth.get('/google', async (c) => {
  try {
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const redirectUri = c.env.GOOGLE_REDIRECT_URI;
    
    console.log('OAuth config check:', { 
      hasClientId: !!clientId, 
      hasRedirectUri: !!redirectUri,
      clientId: clientId ? clientId.substring(0, 10) + '...' : 'undefined',
      redirectUri 
    });
    
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

    return c.json({
      success: true,
      authorization_url: authUrl
    });
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return c.json({ error: 'OAuth initiation failed' }, 500);
  }
});

auth.get('/google/callback', async (c) => {
  console.log('OAuth callback function entered');
  try {
    console.log('OAuth callback started');
    const code = c.req.query('code');
    
    if (!code) {
      console.log('No authorization code provided');
      return c.json({ error: 'No authorization code provided' }, 400);
    }

    console.log('Authorization code received, exchanging for tokens...');
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
      const errorBody = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorBody);
      throw new Error('Failed to exchange authorization code');
    }

    console.log('Token exchange successful');
    const tokenData = await tokenResponse.json();
    console.log('Token data keys:', Object.keys(tokenData));
    const { id_token } = tokenData;

    // Decode and verify ID token (simplified - in production, verify signature)
    const payload = JSON.parse(atob(id_token.split('.')[1]));
    
    // Check if this would be the first user
    const email = payload.email;
    const existingUser = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE email = ?'
    ).bind(email).first();
    
    let role = 'user';
    if (!existingUser) {
      const userCount = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM users'
      ).first();
      role = userCount?.count === 0 ? 'admin' : 'user';
    }

    // Create or update user with role (use placeholder for password_hash since it's NOT NULL)
    const user = await c.env.DB.prepare(
      'INSERT INTO users (email, username, google_id, role, password_hash) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(email) DO UPDATE SET google_id = ?, updated_at = CURRENT_TIMESTAMP ' +
      'RETURNING id, email, username, role'
    ).bind(email, payload.name || email.split('@')[0], payload.sub, role, 'OAUTH_USER', payload.sub).first();

    // Generate our own tokens with role (use generateTokenPair like main branch)
    const tokens = await generateTokenPair(
      { 
        id: user.id,
        user_id: user.id,  // JWT service expects user_id, not id
        email: user.email, 
        username: user.username,
        role: user.role || 'user' 
      },
      c.env
    );

    // Smart redirect like main branch - check Accept header and use proper base URL  
    const acceptHeader = c.req.header('Accept') || '';
    if (acceptHeader.includes('text/html')) {
      // Use FRONTEND_URL for development, fallback to request URL for production
      const baseUrl = c.env.FRONTEND_URL || new URL('/', c.req.url).origin;
      const redirectUrl = new URL('/', baseUrl);
      redirectUrl.searchParams.set('oauth_success', 'true');
      redirectUrl.searchParams.set('token', tokens.access_token);
      redirectUrl.searchParams.set('refresh_token', tokens.refresh_token);
      redirectUrl.searchParams.set('user_id', user.id.toString());
      
      return c.redirect(redirectUrl.toString());
    }

    // For API requests, return JSON
    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || 'user'
      },
      token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      message: 'Google OAuth authentication successful'
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    console.error('Error stack:', error.stack);
    return c.json({ 
      error: 'OAuth authentication failed',
      details: error.message,
      stack: error.stack 
    }, 500);
  }
});

export default auth;
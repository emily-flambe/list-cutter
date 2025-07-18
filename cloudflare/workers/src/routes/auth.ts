import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleLogin } from './accounts/login';
import { handleRegister } from './accounts/register';
import { handleRefresh } from './accounts/refresh';
import { handleLogout } from './accounts/logout';
import { Env } from '../types/env';
import googleOAuth from './auth/google-oauth';

const auth = new Hono<{ Bindings: Env }>();

// Simplified CORS for same-origin setup (frontend and API on same domain)
auth.use('*', cors({
  origin: (origin, c) => {
    // In development, allow all origins for OAuth testing
    const environment = c?.env?.ENVIRONMENT || 'development';
    if (environment === 'development') {
      return origin || '*';
    }
    
    // In production, allow specific origins including OAuth redirect domains
    const allowedOrigins = [
      'https://cutty.emilycogsdill.com',
      'https://list-cutter.emilycogsdill.com',
      'https://accounts.google.com', // For OAuth redirects
    ];
    return allowedOrigins.includes(origin || '') ? origin : false;
  },
  allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Simple test endpoint for connectivity verification
auth.get('/test', async (c) => {
  return c.json({
    status: 'success',
    message: 'Auth API is working',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// Health check endpoint for API connection test
auth.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    message: 'API connection successful',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development',
    version: c.env.API_VERSION || 'v1'
  });
});

// Database connection test endpoint
auth.get('/db-test', async (c) => {
  try {
    // Check if DB binding exists
    if (!c.env.DB) {
      return c.json({
        status: 'error',
        message: 'Database binding not found',
        details: {
          has_db_binding: false,
          environment: c.env.ENVIRONMENT || 'development'
        }
      }, 500);
    }

    // Get all tables in the database
    const tablesResult = await c.env.DB.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%' 
      AND name NOT LIKE 'd1_%'
      ORDER BY name
    `).all();
    
    // Get count from users table if it exists
    let usersCount = 0;
    try {
      const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
      usersCount = result?.count || 0;
    } catch (e) {
      // Users table might not exist
      console.log('Could not count users:', e);
    }
    
    return c.json({
      status: 'success',
      message: 'Database connection successful',
      details: {
        has_db_binding: true,
        environment: c.env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString(),
        tables: tablesResult.results.map(row => row.name),
        table_count: tablesResult.results.length,
        users_count: usersCount
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    return c.json({
      status: 'error',
      message: 'Database query failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        has_db_binding: !!c.env.DB,
        environment: c.env.ENVIRONMENT || 'development'
      }
    }, 500);
  }
});

auth.post('/login', async (c) => {
  return handleLogin(c.req.raw, c.env);
});

auth.post('/register', async (c) => {
  // Add debugging logs for D1 database connection
  console.log('🔍 Registration request - D1 Database debugging:', {
    has_db_binding: !!c.env.DB,
    db_binding_type: typeof c.env.DB,
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString()
  });
  
  return handleRegister(c.req.raw, c.env);
});

auth.post('/refresh', async (c) => {
  return handleRefresh(c.req.raw, c.env);
});

auth.post('/logout', async (c) => {
  return handleLogout(c.req.raw, c.env);
});

// Google OAuth routes
auth.route('/google', googleOAuth);

export default auth;
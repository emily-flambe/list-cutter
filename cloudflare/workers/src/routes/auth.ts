import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleLogin } from './accounts/login';
import { handleRegister } from './accounts/register';
import { handleRefresh } from './accounts/refresh';
import { handleLogout } from './accounts/logout';
import { Env } from '../types/env';

const auth = new Hono<{ Bindings: Env }>();

// Simplified CORS for same-origin setup (frontend and API on same domain)
auth.use('*', cors({
  origin: (origin, c) => {
    // In development, allow all origins
    const environment = c?.env?.ENVIRONMENT || 'development';
    if (environment === 'development') {
      return origin || '*';
    }
    
    // In production, only allow specific origins
    const allowedOrigins = ['https://cutty.emilycogsdill.com'];
    return allowedOrigins.includes(origin || '') ? origin : false;
  },
  allowMethods: ['POST', 'GET', 'OPTIONS'],
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

auth.post('/login', async (c) => {
  return handleLogin(c.req.raw, c.env);
});

auth.post('/register', async (c) => {
  return handleRegister(c.req.raw, c.env);
});

auth.post('/refresh', async (c) => {
  return handleRefresh(c.req.raw, c.env);
});

auth.post('/logout', async (c) => {
  return handleLogout(c.req.raw, c.env);
});

export default auth;
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleLogin } from './accounts/login';
import { handleRegister } from './accounts/register';
import { handleRefresh } from './accounts/refresh';
import { handleLogout } from './accounts/logout';
import { Env } from '../types/env';

const auth = new Hono<{ Bindings: Env }>();

// Environment-specific CORS configuration
auth.use('*', cors((c) => ({
  origin: c.env.CORS_ORIGIN || 'https://cutty.emilycogsdill.com',
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})));

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
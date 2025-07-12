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
  origin: ['http://localhost:5173', 'https://cutty.emilycogsdill.com', 'https://cutty-api.emily-cogsdill.workers.dev'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

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
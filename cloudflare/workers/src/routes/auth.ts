import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleLogin } from './accounts/login';
import { handleRegister } from './accounts/register';
import { handleRefresh } from './accounts/refresh';
import { handleLogout } from './accounts/logout';
import { Env } from '../types/env';

const auth = new Hono<{ Bindings: Env }>();

auth.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
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
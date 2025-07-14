import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleUser } from './accounts/user';
import { Env } from '../types';

const accounts = new Hono<{ Bindings: Env }>();

// CORS configuration for accounts endpoints
accounts.use('*', cors({
  origin: (origin, c) => {
    const environment = c?.env?.ENVIRONMENT || 'development';
    if (environment === 'development') {
      return origin || '*';
    }
    
    const allowedOrigins = ['https://cutty.emilycogsdill.com'];
    return allowedOrigins.includes(origin || '') ? origin : false;
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// User profile endpoint
accounts.get('/user', async (c) => {
  return handleUser(c.req.raw, c.env);
});

export default accounts;
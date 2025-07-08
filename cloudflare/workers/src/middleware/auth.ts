// Simple authentication middleware for R2 monitoring system
import type { Context } from 'hono';

export interface AuthContext {
  userId?: string;
  isAdmin?: boolean;
}

export async function authenticateRequest(c: Context): Promise<AuthContext | null> {
  // For now, implement a simple authentication check
  // In production, this would validate JWT tokens, API keys, etc.
  
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return null;
  }

  // Simple bearer token check for demo purposes
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Mock authentication - replace with real JWT validation
    if (token === 'demo-token') {
      return {
        userId: 'demo-user',
        isAdmin: false
      };
    }
    
    if (token === 'admin-token') {
      return {
        userId: 'admin-user',
        isAdmin: true
      };
    }
  }

  return null;
}

export function requireAuth() {
  return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
    const auth = await authenticateRequest(c);
    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    c.set('auth', auth);
    await next();
  };
}

export function requireAdmin() {
  return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
    const auth = await authenticateRequest(c);
    if (!auth || !auth.isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    c.set('auth', auth);
    await next();
  };
}
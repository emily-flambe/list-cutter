import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { CloudflareEnv } from '../../src/types/env';
import chat from '../../src/routes/chat';
import { createMockEnv } from '../utils/test-env';

describe('Chat Endpoint', () => {
  let app: Hono<{ Bindings: CloudflareEnv }>;
  let mockEnv: CloudflareEnv;

  beforeEach(() => {
    app = new Hono<{ Bindings: CloudflareEnv }>();
    mockEnv = createMockEnv() as CloudflareEnv;
    
    // Mount the chat routes with proper environment binding
    app.use('*', async (c, next) => {
      // Inject the mock environment into the context
      c.env = mockEnv;
      await next();
    });
    
    app.route('/api/v1/chat', chat);
    
    vi.clearAllMocks();
    
    // Mock global fetch for AI worker calls
    global.fetch = vi.fn();  
  });

  describe('POST /api/v1/chat', () => {
    it('should return a response for valid messages', async () => {
      // Mock successful AI worker response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'Hello! I\'m Cutty the Cuttlefish 🦑! I can help you generate synthetic data for testing!' })
      });

      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello Cutty! Can you help me generate some test data?'
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('reply');
      expect(data.data).toHaveProperty('timestamp');
      expect(data.data.reply).toContain('Cutty the Cuttlefish');
      
      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://ai.example.com/api/v1/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-ai-worker-key'
          })
        })
      );
    });

    it('should handle messages with special characters', async () => {
      // Mock successful AI worker response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'I can definitely help with data containing special characters!' })
      });

      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Can you help with data that includes special chars like @#$%?'
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.reply).toBeTruthy();
    });

    it('should return 400 for empty message', async () => {
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: ''
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error', 'Message is required');
    });

    it('should return 400 for missing message field', async () => {
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error', 'Message is required');
    });

    it('should return 400 for non-string message', async () => {
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 123
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error', 'Message is required');
    });

    it('should return 400 for message too long', async () => {
      const longMessage = 'a'.repeat(4001); // 4001 characters
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: longMessage
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error', 'Message too long (max 4000 characters)');
    });

    it('should handle message at max length', async () => {
      // Mock successful AI worker response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'I can help with long messages too!' })
      });

      const maxMessage = 'a'.repeat(4000); // Exactly 4000 characters
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: maxMessage
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should handle invalid JSON body', async () => {
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid request body');
    });

    it('should include error details in development environment', async () => {
      // Update the mock environment for this test
      mockEnv.ENVIRONMENT = 'development';
      
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid request body');
    });

    it('should not include error details in production environment', async () => {
      // Update the mock environment for this test
      mockEnv.ENVIRONMENT = 'production';
      
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid request body');
      expect(data).not.toHaveProperty('details');
    });

    it('should include timestamp in response', async () => {
      // Mock successful AI worker response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'The current time is included in my response timestamp!' })
      });

      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'What time is it?'
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.data).toHaveProperty('timestamp');
      
      // Verify timestamp is a valid ISO date string
      const timestamp = new Date(data.data.timestamp);
      expect(timestamp.toISOString()).toBe(data.data.timestamp);
    });
  });
});
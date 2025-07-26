import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import files from '../files';
import type { Env } from '../../types';

describe('Files API - List Endpoint', () => {
  let app: Hono<{ Bindings: Env }>;
  let mockEnv: Env;
  
  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.route('/api/v1/files', files);
    
    // Mock environment
    mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        all: vi.fn(),
        first: vi.fn(),
        run: vi.fn()
      },
      FILE_STORAGE: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn()
      },
      JWT_SECRET: 'test-secret',
      AUTH_KV: {} as any,
      MAX_FILE_SIZE: '52428800'
    } as any;
  });

  describe('GET /api/v1/files', () => {
    it('should return enhanced file list with metadata', async () => {
      const mockFiles = {
        results: [
          {
            id: 'file-1',
            filename: 'data.csv',
            original_filename: 'original-data.csv',
            file_size: 1024,
            mime_type: 'text/csv',
            created_at: '2025-01-20T10:00:00Z',
            upload_status: 'completed',
            tags: JSON.stringify(['synthetic-data']),
            r2_key: 'files/user-1/file-1/data.csv'
          },
          {
            id: 'file-2',
            filename: 'upload.csv',
            original_filename: 'upload.csv',
            file_size: 2048,
            mime_type: 'text/csv',
            created_at: '2025-01-20T11:00:00Z',
            upload_status: 'completed',
            tags: JSON.stringify(['upload']),
            r2_key: 'files/user-1/file-2/upload.csv'
          }
        ]
      };

      mockEnv.DB.all.mockResolvedValue(mockFiles);
      mockEnv.DB.first.mockResolvedValue({ total: 2 });

      // Mock validateToken to set userId
      vi.mock('../../services/auth/jwt', () => ({
        validateToken: vi.fn().mockResolvedValue({ user_id: 'user-1' })
      }));

      const req = new Request('http://localhost/api/v1/files', {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.files).toHaveLength(2);
      
      // Check enhanced metadata
      expect(data.files[0]).toEqual({
        id: 'file-1',
        filename: 'original-data.csv',
        size: 1024,
        mimeType: 'text/csv',
        createdAt: '2025-01-20T10:00:00Z',
        source: 'synthetic-data',
        status: 'completed'
      });
      
      expect(data.files[1].source).toBe('upload');
      
      // Check pagination
      expect(data.pagination).toEqual({
        total: 2,
        limit: 50,
        offset: 0
      });
    });

    it('should filter only CSV files by default', async () => {
      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.first.mockResolvedValue({ total: 0 });

      const req = new Request('http://localhost/api/v1/files', {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      await app.fetch(req, mockEnv);

      // Check that CSV filter was applied
      const prepareCall = mockEnv.DB.prepare.mock.calls[0][0];
      expect(prepareCall).toContain("mime_type IN ('text/csv', 'application/vnd.ms-excel', 'text/plain')");
    });

    it('should handle empty file list gracefully', async () => {
      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.first.mockResolvedValue({ total: 0 });

      const req = new Request('http://localhost/api/v1/files', {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.files).toEqual([]);
      expect(data.pagination.total).toBe(0);
    });

    it('should handle database errors with enhanced error response', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const req = new Request('http://localhost/api/v1/files', {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to list files');
      expect(data.message).toBe('Unable to retrieve your files. Please try again.');
      expect(data.code).toBe('FILE_LIST_ERROR');
    });

    it('should respect pagination parameters', async () => {
      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.first.mockResolvedValue({ total: 100 });

      const req = new Request('http://localhost/api/v1/files?limit=20&offset=40', {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      await app.fetch(req, mockEnv);

      // Check bind parameters include limit and offset
      const bindCall = mockEnv.DB.bind.mock.calls[0];
      expect(bindCall).toContain(20); // limit
      expect(bindCall).toContain(40); // offset
    });

    it('should handle malformed tags gracefully', async () => {
      const mockFiles = {
        results: [
          {
            id: 'file-1',
            filename: 'data.csv',
            original_filename: 'data.csv',
            file_size: 1024,
            mime_type: 'text/csv',
            created_at: '2025-01-20T10:00:00Z',
            tags: 'invalid-json',
            r2_key: 'files/user-1/file-1/data.csv'
          }
        ]
      };

      mockEnv.DB.all.mockResolvedValue(mockFiles);
      mockEnv.DB.first.mockResolvedValue({ total: 1 });

      const req = new Request('http://localhost/api/v1/files', {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      const res = await app.fetch(req, mockEnv);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.files[0].source).toBe('upload'); // Falls back to default
    });
  });
});
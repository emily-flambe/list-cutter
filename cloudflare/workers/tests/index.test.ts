import { describe, it, expect } from 'vitest';
import app from '../src/index';

const mockEnv = {
  ENVIRONMENT: 'test',
  API_VERSION: 'v1',
  CORS_ORIGIN: 'http://localhost:5173',
  MAX_FILE_SIZE: '52428800',
  JWT_ISSUER: 'list-cutter',
  JWT_AUDIENCE: 'list-cutter-api',
  JWT_SECRET: 'test-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  DB_ENCRYPTION_KEY: 'test-key'
};

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const req = new Request('http://localhost/health');
    const res = await app.request(req, mockEnv);
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json).toHaveProperty('status', 'healthy');
    expect(json).toHaveProperty('version');
    expect(json).toHaveProperty('environment');
    expect(json).toHaveProperty('timestamp');
  });
  
  it('should return 404 for unknown routes', async () => {
    const req = new Request('http://localhost/unknown');
    const res = await app.request(req, mockEnv);
    expect(res.status).toBe(404);
    
    const json = await res.json();
    expect(json).toHaveProperty('error', 'Not Found');
  });
});
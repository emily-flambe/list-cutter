import { describe, it, expect } from 'vitest';
import worker from '../src/index';

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
    const request = new Request('http://localhost/health');
    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json).toHaveProperty('status', 'healthy');
    expect(json).toHaveProperty('version', 'v1');
    expect(json).toHaveProperty('environment', 'test');
    expect(json).toHaveProperty('timestamp');
  });
  
  it('should return 404 for unknown routes', async () => {
    const request = new Request('http://localhost/unknown');
    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(404);
    
    const json = await response.json();
    expect(json).toHaveProperty('error', 'Not Found');
  });
});
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const request = new Request('http://localhost/health');
    const response = await worker.fetch(request);
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json).toHaveProperty('status', 'healthy');
    expect(json).toHaveProperty('version', 'v1');
    expect(json).toHaveProperty('environment', 'test');
    expect(json).toHaveProperty('timestamp');
  });
  
  it('should return 404 for unknown routes', async () => {
    const request = new Request('http://localhost/unknown');
    const response = await worker.fetch(request);
    expect(response.status).toBe(404);
    
    const json = await response.json();
    expect(json).toHaveProperty('error', 'Not Found');
  });
});
import { describe, it, expect } from 'vitest';

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const response = await fetch('http://example.com/health');
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json).toHaveProperty('status', 'healthy');
    expect(json).toHaveProperty('version', 'v1');
    expect(json).toHaveProperty('environment', 'test');
    expect(json).toHaveProperty('timestamp');
  });
  
  it('should return 404 for unknown routes', async () => {
    const response = await fetch('http://example.com/unknown');
    expect(response.status).toBe(404);
    
    const json = await response.json();
    expect(json).toHaveProperty('error', 'Not Found');
  });
});
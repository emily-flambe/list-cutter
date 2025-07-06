import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('Health endpoints', () => {
  it('should return healthy status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json).toHaveProperty('status', 'healthy');
    expect(json).toHaveProperty('version');
    expect(json).toHaveProperty('environment');
    expect(json).toHaveProperty('timestamp');
  });

  it('should return detailed health check', async () => {
    const res = await app.request('/api/v1/health/detailed');
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json).toHaveProperty('status');
    expect(json).toHaveProperty('checks');
    expect(json.checks).toHaveProperty('database');
    expect(json.checks).toHaveProperty('storage');
    expect(json.checks).toHaveProperty('memory');
    expect(json.checks).toHaveProperty('responseTime');
  });

  it('should return ready status', async () => {
    const res = await app.request('/api/v1/health/ready');
    // Status might be 200 or 503 depending on environment setup
    expect([200, 503]).toContain(res.status);
    
    const json = await res.json();
    expect(json).toHaveProperty('status');
    expect(json).toHaveProperty('timestamp');
  });

  it('should return alive status', async () => {
    const res = await app.request('/api/v1/health/live');
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json).toHaveProperty('status', 'alive');
    expect(json).toHaveProperty('timestamp');
  });
});
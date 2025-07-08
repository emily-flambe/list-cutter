import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const mockEnv = { ENVIRONMENT: 'test', API_VERSION: 'v1' };

describe('Core Function', () => {
  it('worker responds to requests', async () => {
    const request = new Request('http://localhost/health');
    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBeLessThan(500);
  });
});
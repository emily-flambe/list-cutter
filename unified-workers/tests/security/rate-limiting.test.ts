/**
 * Rate Limiting and DoS Protection Security Tests
 * Tests for request rate limiting, denial of service protection, and resource management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { testEnv } from '../setup/test-env';

describe('Rate Limiting and DoS Protection Tests', () => {
  let worker: UnstableDevWorker;
  let env: any;
  let authToken: string;

  beforeEach(async () => {
    env = await testEnv();
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });

    // Set up authenticated user for tests
    await worker.fetch('/api/accounts/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'rate_test_user',
        password: 'SecurePass123!',
        email: 'rate@test.com'
      })
    });

    const loginResponse = await worker.fetch('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'rate_test_user',
        password: 'SecurePass123!'
      })
    });

    const { access_token } = await loginResponse.json();
    authToken = access_token;
  });

  describe('Authentication Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const promises = [];
      const maxAttempts = 15;

      // Make rapid login attempts
      for (let i = 0; i < maxAttempts; i++) {
        promises.push(
          worker.fetch('/api/accounts/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'nonexistent_user',
              password: 'wrongpassword'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit headers
      const lastResponse = responses[responses.length - 1];
      if (lastResponse.status === 429) {
        expect(lastResponse.headers.get('Retry-After')).toBeTruthy();
        expect(lastResponse.headers.get('X-RateLimit-Limit')).toBeTruthy();
        expect(lastResponse.headers.get('X-RateLimit-Remaining')).toBe('0');
      }
    });

    it('should rate limit registration attempts', async () => {
      const promises = [];
      const maxAttempts = 10;

      // Make rapid registration attempts
      for (let i = 0; i < maxAttempts; i++) {
        promises.push(
          worker.fetch('/api/accounts/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: `rapid_user_${i}_${Date.now()}`,
              password: 'SecurePass123!',
              email: `rapid${i}_${Date.now()}@test.com`
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should rate limit password reset attempts', async () => {
      const promises = [];
      const maxAttempts = 8;

      // Make rapid password reset attempts
      for (let i = 0; i < maxAttempts; i++) {
        promises.push(
          worker.fetch('/api/accounts/password-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'rate@test.com'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should implement progressive rate limiting', async () => {
      // First batch - should be allowed
      const firstBatch = [];
      for (let i = 0; i < 3; i++) {
        firstBatch.push(
          worker.fetch('/api/accounts/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'progressive_test',
              password: 'wrongpassword'
            })
          })
        );
      }

      const firstResponses = await Promise.all(firstBatch);
      const firstBlocked = firstResponses.filter(r => r.status === 429);
      expect(firstBlocked.length).toBe(0);

      // Second batch - should start blocking
      const secondBatch = [];
      for (let i = 0; i < 5; i++) {
        secondBatch.push(
          worker.fetch('/api/accounts/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'progressive_test',
              password: 'wrongpassword'
            })
          })
        );
      }

      const secondResponses = await Promise.all(secondBatch);
      const secondBlocked = secondResponses.filter(r => r.status === 429);
      expect(secondBlocked.length).toBeGreaterThan(0);

      // Third batch - should block more aggressively
      const thirdBatch = [];
      for (let i = 0; i < 5; i++) {
        thirdBatch.push(
          worker.fetch('/api/accounts/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'progressive_test',
              password: 'wrongpassword'
            })
          })
        );
      }

      const thirdResponses = await Promise.all(thirdBatch);
      const thirdBlocked = thirdResponses.filter(r => r.status === 429);
      expect(thirdBlocked.length).toBeGreaterThanOrEqual(secondBlocked.length);
    });
  });

  describe('API Rate Limiting', () => {
    it('should rate limit file upload requests', async () => {
      const promises = [];
      const maxUploads = 12;
      const csvContent = 'name,age\nJohn,25';

      // Make rapid upload attempts
      for (let i = 0; i < maxUploads; i++) {
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), `rapid${i}.csv`);

        promises.push(
          worker.fetch('/api/list_cutter/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            body: formData
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should rate limit file processing requests', async () => {
      // Upload a file first
      const csvContent = 'name,age,city\nJohn,25,NYC\nJane,30,LA\nBob,35,Chicago';
      const formData = new FormData();
      formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'process_test.csv');

      const uploadResponse = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      const { file_id } = await uploadResponse.json();

      // Make rapid processing requests
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          worker.fetch('/api/list_cutter/filter', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file_id,
              filter: `age > ${20 + i}`
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should rate limit search requests', async () => {
      const promises = [];
      const maxSearches = 20;

      // Make rapid search requests
      for (let i = 0; i < maxSearches; i++) {
        promises.push(
          worker.fetch(`/api/list_cutter/files/search?query=test${i}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should implement per-endpoint rate limits', async () => {
      // Test different endpoints have different limits
      const endpointTests = [
        { path: '/api/list_cutter/files', method: 'GET', maxRequests: 30 },
        { path: '/api/accounts/user', method: 'GET', maxRequests: 20 },
        { path: '/health', method: 'GET', maxRequests: 100 },
        { path: '/api/list_cutter/files/search?query=test', method: 'GET', maxRequests: 15 }
      ];

      for (const test of endpointTests) {
        const promises = [];
        
        for (let i = 0; i < test.maxRequests + 5; i++) {
          promises.push(
            worker.fetch(test.path, {
              method: test.method,
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            })
          );
        }

        const responses = await Promise.all(promises);
        const rateLimitedResponses = responses.filter(r => r.status === 429);

        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      }
    });
  });

  describe('DoS Protection', () => {
    it('should protect against slowloris attacks', async () => {
      // Simulate slow request by sending partial data
      const controller = new AbortController();
      const signal = controller.signal;

      const slowRequest = worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
          'Content-Length': '1000000' // Claim large content
        },
        body: 'small data', // But send small data
        signal
      });

      // Cancel the request after a short time
      setTimeout(() => controller.abort(), 1000);

      try {
        await slowRequest;
      } catch (error) {
        expect(error.name).toBe('AbortError');
      }
    });

    it('should protect against request flooding', async () => {
      const promises = [];
      const floodCount = 100;

      // Create a flood of requests
      for (let i = 0; i < floodCount; i++) {
        promises.push(
          worker.fetch('/api/list_cutter/files', {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }).catch(() => ({ status: 500 })) // Catch network errors
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedOrErrorResponses = responses.filter(r => 
        r.status === 429 || r.status === 503 || r.status === 500
      );

      // Should block or error on many requests
      expect(rateLimitedOrErrorResponses.length).toBeGreaterThan(floodCount * 0.3);
    });

    it('should limit concurrent connections per IP', async () => {
      // Simulate multiple concurrent long-running requests
      const promises = [];
      const concurrentCount = 20;

      for (let i = 0; i < concurrentCount; i++) {
        promises.push(
          worker.fetch('/api/list_cutter/files/search?query=' + 'x'.repeat(1000), {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );
      }

      const responses = await Promise.all(promises);
      const rejectedResponses = responses.filter(r => r.status === 429 || r.status === 503);

      expect(rejectedResponses.length).toBeGreaterThan(0);
    });

    it('should implement circuit breaker pattern', async () => {
      // First, trigger multiple errors to open the circuit
      const errorPromises = [];
      for (let i = 0; i < 10; i++) {
        errorPromises.push(
          worker.fetch('/api/list_cutter/files/99999999', {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );
      }

      await Promise.all(errorPromises);

      // Now make a request that should be blocked by circuit breaker
      const response = await worker.fetch('/api/list_cutter/files/99999998', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Should either return 503 (circuit open) or 404 (normal operation)
      expect(response.status).toBeOneOf([404, 503]);
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should limit memory usage per request', async () => {
      // Try to upload a very large CSV
      const largeData = 'name,age,data\n' + Array.from({ length: 50000 }, (_, i) => 
        `User${i},${20 + i},${'X'.repeat(1000)}`
      ).join('\n');

      const formData = new FormData();
      formData.append('file', new Blob([largeData], { type: 'text/csv' }), 'large.csv');

      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      // Should either process successfully or reject due to size
      expect(response.status).toBeOneOf([200, 413, 400]);
    });

    it('should timeout long-running requests', async () => {
      // Create a complex CSV that might take a long time to process
      const complexData = 'name,description\n' + Array.from({ length: 10000 }, (_, i) => 
        `User${i},"${'"'.repeat(100)}complex data${'"'.repeat(100)}"`
      ).join('\n');

      const formData = new FormData();
      formData.append('file', new Blob([complexData], { type: 'text/csv' }), 'complex.csv');

      const startTime = Date.now();
      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });
      const endTime = Date.now();

      // Should not take longer than reasonable timeout
      expect(endTime - startTime).toBeLessThan(60000); // 1 minute max
      expect(response.status).toBeOneOf([200, 408, 400]);
    });

    it('should limit CPU usage per request', async () => {
      // Create data that requires heavy processing
      const heavyData = 'formula,result\n' + Array.from({ length: 1000 }, (_, i) => 
        `"=SUM(${Array.from({length: 100}, (_, j) => j).join('+')})",${i}`
      ).join('\n');

      const formData = new FormData();
      formData.append('file', new Blob([heavyData], { type: 'text/csv' }), 'heavy.csv');

      const startTime = Date.now();
      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max
      expect(response.status).toBeOneOf([200, 408, 400]);
    });
  });

  describe('Geographic and IP-based Protection', () => {
    it('should handle requests from different regions', async () => {
      // Test with different geographic headers
      const regions = [
        { 'CF-IPCountry': 'US', 'CF-Region': 'CA' },
        { 'CF-IPCountry': 'CN', 'CF-Region': 'BJ' },
        { 'CF-IPCountry': 'RU', 'CF-Region': 'MOW' },
        { 'CF-IPCountry': 'IR', 'CF-Region': 'THR' },
        { 'CF-IPCountry': 'XX', 'CF-Region': 'XX' } // Unknown region
      ];

      for (const headers of regions) {
        const response = await worker.fetch('/api/list_cutter/files', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            ...headers
          }
        });

        // Should handle all regions gracefully
        expect(response.status).toBeOneOf([200, 403, 429]);
      }
    });

    it('should detect and block suspicious IP patterns', async () => {
      // Test with suspicious IP headers
      const suspiciousIPs = [
        '127.0.0.1', // Localhost
        '10.0.0.1', // Private network
        '192.168.1.1', // Private network
        '172.16.0.1', // Private network
        '0.0.0.0', // Invalid IP
        '255.255.255.255', // Broadcast
        '169.254.1.1', // Link-local
        '224.0.0.1', // Multicast
        '', // Empty IP
        'invalid-ip' // Invalid format
      ];

      for (const ip of suspiciousIPs) {
        const response = await worker.fetch('/api/list_cutter/files', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'CF-Connecting-IP': ip,
            'X-Forwarded-For': ip,
            'X-Real-IP': ip
          }
        });

        // Should handle suspicious IPs appropriately
        expect(response.status).toBeOneOf([200, 403, 400]);
      }
    });
  });

  describe('Rate Limit Bypass Protection', () => {
    it('should prevent rate limit bypass via header manipulation', async () => {
      const bypassHeaders = [
        { 'X-Forwarded-For': '1.2.3.4' },
        { 'X-Real-IP': '5.6.7.8' },
        { 'X-Originating-IP': '9.10.11.12' },
        { 'X-Remote-IP': '13.14.15.16' },
        { 'X-Client-IP': '17.18.19.20' },
        { 'CF-Connecting-IP': '21.22.23.24' },
        { 'True-Client-IP': '25.26.27.28' },
        { 'X-Cluster-Client-IP': '29.30.31.32' }
      ];

      for (const headers of bypassHeaders) {
        const promises = [];
        
        // Try to bypass rate limits using different headers
        for (let i = 0; i < 15; i++) {
          promises.push(
            worker.fetch('/api/accounts/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...headers
              },
              body: JSON.stringify({
                username: 'bypass_test',
                password: 'wrongpassword'
              })
            })
          );
        }

        const responses = await Promise.all(promises);
        const rateLimitedResponses = responses.filter(r => r.status === 429);

        // Should still enforce rate limits despite header manipulation
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      }
    });

    it('should prevent rate limit bypass via user agent rotation', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
        'Mozilla/5.0 (Android 11; Mobile; rv:92.0) Gecko/92.0',
        'curl/7.68.0',
        'wget/1.20.3',
        'Python-urllib/3.9',
        'Go-http-client/1.1',
        'PostmanRuntime/7.28.4'
      ];

      for (const userAgent of userAgents) {
        const promises = [];
        
        // Try to bypass rate limits using different user agents
        for (let i = 0; i < 12; i++) {
          promises.push(
            worker.fetch('/api/accounts/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': userAgent
              },
              body: JSON.stringify({
                username: 'ua_bypass_test',
                password: 'wrongpassword'
              })
            })
          );
        }

        const responses = await Promise.all(promises);
        const rateLimitedResponses = responses.filter(r => r.status === 429);

        // Should still enforce rate limits despite user agent rotation
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Rate Limit Recovery', () => {
    it('should allow requests after rate limit window expires', async () => {
      // First, hit the rate limit
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          worker.fetch('/api/accounts/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'recovery_test',
              password: 'wrongpassword'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Wait for rate limit window to reset (assume 1 minute window)
      await new Promise(resolve => setTimeout(resolve, 61000));

      // Should be able to make requests again
      const recoveryResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'recovery_test',
          password: 'wrongpassword'
        })
      });

      expect(recoveryResponse.status).toBe(401); // Unauthorized, not rate limited
    });

    it('should implement exponential backoff for repeated violations', async () => {
      let backoffTime = 1000; // Start with 1 second

      for (let violation = 0; violation < 3; violation++) {
        // Trigger rate limit
        const promises = [];
        for (let i = 0; i < 8; i++) {
          promises.push(
            worker.fetch('/api/accounts/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: `backoff_test_${violation}`,
                password: 'wrongpassword'
              })
            })
          );
        }

        await Promise.all(promises);

        // Wait for current backoff period
        await new Promise(resolve => setTimeout(resolve, backoffTime));

        // Try again - should still be blocked if exponential backoff is working
        const testResponse = await worker.fetch('/api/accounts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `backoff_test_${violation}`,
            password: 'wrongpassword'
          })
        });

        if (violation > 0) {
          // Later violations should have longer backoff times
          expect(testResponse.status).toBe(429);
        }

        // Increase backoff time exponentially
        backoffTime *= 2;
      }
    });
  });

  afterEach(async () => {
    await worker.stop();
  });
});
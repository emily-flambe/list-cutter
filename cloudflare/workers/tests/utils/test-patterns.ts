/**
 * Common Test Patterns
 * 
 * Reusable test patterns and utilities for consistent testing across the application.
 */

import type { Env } from '../../src/types';
import { createMockEnv, createMockRequest, expectResponse } from './test-env';

/**
 * Test a route handler with different HTTP methods
 */
export async function testHTTPMethods(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>,
  path: string = '/',
  allowedMethods: string[] = ['GET'],
  env: Env = createMockEnv()
): Promise<void> {
  const allMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  
  for (const method of allMethods) {
    const request = createMockRequest(`https://test.example.com${path}`, { method });
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
    
    const response = await handler(request, env, ctx);
    
    if (allowedMethods.includes(method)) {
      expect(response.status).not.toBe(405); // Method Not Allowed
    } else {
      expect(response.status).toBe(405);
    }
  }
}

/**
 * Test CORS headers on a response
 */
export function expectCORSHeaders(response: Response): void {
  expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
  expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
}

/**
 * Test error response format consistency
 */
export async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedError?: string
): Promise<any> {
  expect(response.status).toBe(expectedStatus);
  
  const data = await expectResponse(response, expectedStatus);
  expect(data).toHaveProperty('error');
  expect(typeof data.error).toBe('string');
  
  if (expectedError) {
    expect(data.error).toContain(expectedError);
  }
  
  return data;
}

/**
 * Test success response format consistency
 */
export async function expectSuccessResponse(
  response: Response,
  expectedStatus: number = 200
): Promise<any> {
  expect(response.status).toBe(expectedStatus);
  
  const data = await expectResponse(response, expectedStatus);
  expect(data).not.toHaveProperty('error');
  
  return data;
}

/**
 * Test input validation patterns
 */
export async function testInputValidation(
  handler: (input: any) => Promise<any> | any,
  validInput: any,
  invalidInputs: Array<{ input: any; expectedError: string | RegExp }>
): Promise<void> {
  // Test valid input
  const validResult = await handler(validInput);
  expect(validResult).toBeDefined();
  
  // Test invalid inputs
  for (const { input, expectedError } of invalidInputs) {
    try {
      await handler(input);
      throw new Error(`Expected handler to throw for input: ${JSON.stringify(input)}`);
    } catch (error) {
      if (typeof expectedError === 'string') {
        expect((error as Error).message).toContain(expectedError);
      } else {
        expect((error as Error).message).toMatch(expectedError);
      }
    }
  }
}

/**
 * Test pagination patterns
 */
export interface PaginationTestCase {
  totalItems: number;
  pageSize: number;
  expectedPages: number;
}

export function testPagination(testCase: PaginationTestCase): void {
  const { totalItems, pageSize, expectedPages } = testCase;
  const actualPages = Math.ceil(totalItems / pageSize);
  
  expect(actualPages).toBe(expectedPages);
  
  // Test that last page isn't empty
  if (totalItems > 0) {
    const lastPageItems = totalItems % pageSize || pageSize;
    expect(lastPageItems).toBeGreaterThan(0);
    expect(lastPageItems).toBeLessThanOrEqual(pageSize);
  }
}

/**
 * Test rate limiting behavior
 */
export async function testRateLimit(
  makeRequest: () => Promise<Response>,
  maxRequests: number,
  timeWindow: number = 60000 // 1 minute default
): Promise<void> {
  const responses: Response[] = [];
  
  // Make requests up to the limit
  for (let i = 0; i < maxRequests; i++) {
    responses.push(await makeRequest());
  }
  
  // All requests within limit should succeed
  responses.forEach((response, index) => {
    expect(response.status).not.toBe(429); // Too Many Requests
  });
  
  // Request beyond limit should be rate limited
  const rateLimitedResponse = await makeRequest();
  expect(rateLimitedResponse.status).toBe(429);
  
  // Check rate limit headers
  expect(rateLimitedResponse.headers.get('X-RateLimit-Limit')).toBeTruthy();
  expect(rateLimitedResponse.headers.get('X-RateLimit-Remaining')).toBeTruthy();
  expect(rateLimitedResponse.headers.get('X-RateLimit-Reset')).toBeTruthy();
}

/**
 * Test caching behavior
 */
export async function testCaching(
  handler: () => Promise<Response>,
  expectedCacheControl?: string
): Promise<void> {
  const response = await handler();
  
  if (expectedCacheControl) {
    expect(response.headers.get('Cache-Control')).toBe(expectedCacheControl);
  } else {
    expect(response.headers.get('Cache-Control')).toBeTruthy();
  }
  
  // Test ETag if present
  const etag = response.headers.get('ETag');
  if (etag) {
    expect(etag).toMatch(/^".*"$/); // ETags should be quoted
  }
}

/**
 * Test database transaction patterns
 */
export async function testDatabaseTransaction(
  operation: () => Promise<any>,
  env: Env = createMockEnv()
): Promise<void> {
  // Mock database transaction methods
  const beginSpy = vi.spyOn(env.DB, 'prepare');
  
  await operation();
  
  // Verify transaction was used
  expect(beginSpy).toHaveBeenCalled();
}

/**
 * Generate test data with different patterns
 */
export const testDataPatterns = {
  email: {
    valid: ['test@example.com', 'user+tag@domain.co.uk', 'a@b.c'],
    invalid: ['invalid-email', '@domain.com', 'user@', 'user space@domain.com'],
  },
  
  username: {
    valid: ['testuser', 'test_user', 'test-user', 'user123'],
    invalid: ['', 'us', 'a'.repeat(51), 'user@name', 'user name'],
  },
  
  password: {
    valid: ['Password123!', 'MyStr0ngP@ss', 'C0mpl3x!Pass'],
    invalid: ['short', 'nouppercaseornumbers', 'NOLOWERCASEORNUMBERS', '12345678'],
  },
  
  url: {
    valid: ['https://example.com', 'http://localhost:3000', 'https://sub.domain.com/path'],
    invalid: ['not-a-url', 'ftp://invalid.com', 'javascript:alert(1)'],
  },
};

/**
 * Performance testing utilities
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  expectedMaxTime: number = 1000
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await operation();
  const duration = performance.now() - start;
  
  expect(duration).toBeLessThan(expectedMaxTime);
  
  return { result, duration };
}

/**
 * Memory usage testing (basic)
 */
export function testMemoryUsage<T>(
  operation: () => T,
  maxIncrease: number = 10 * 1024 * 1024 // 10MB default
): T {
  const initialMemory = (globalThis as any).process?.memoryUsage?.()?.heapUsed || 0;
  
  const result = operation();
  
  const finalMemory = (globalThis as any).process?.memoryUsage?.()?.heapUsed || 0;
  const memoryIncrease = finalMemory - initialMemory;
  
  if (initialMemory > 0) { // Only test if memory info is available
    expect(memoryIncrease).toBeLessThan(maxIncrease);
  }
  
  return result;
}
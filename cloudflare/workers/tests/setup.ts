import { beforeAll, afterAll, beforeEach } from 'vitest';

// Global test setup
beforeAll(() => {
  console.log('Starting test suite...');
});

afterAll(() => {
  console.log('Test suite completed.');
});

beforeEach(() => {
  // Reset any mocks or test data
});

// Add custom matchers if needed
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidJWT(): T;
    toBeValidUUID(): T;
  }
}
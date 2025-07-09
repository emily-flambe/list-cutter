import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { UnstableDevWorker } from 'wrangler';

// Global test environment
declare global {
  var testWorker: UnstableDevWorker;
  var testEnv: Env;
}

// Test environment configuration
export const TEST_ENV = {
  ENVIRONMENT: 'test',
  API_VERSION: 'v1',
  CORS_ORIGIN: 'http://localhost:5173',
  MAX_FILE_SIZE: '10485760', // 10MB for testing
  JWT_ISSUER: 'list-cutter-test',
  JWT_AUDIENCE: 'list-cutter-api-test',
  JWT_SECRET: 'test-secret-key-for-testing-only',
  JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing-only',
  RATE_LIMIT_REQUESTS: '100',
  RATE_LIMIT_WINDOW: '60',
} as const;

// Test utilities for authenticated requests
export async function generateTestToken(
  userId: string = 'test-user-123',
  username: string = 'testuser'
): Promise<string> {
  // This will be implemented with actual JWT generation
  // For now, return a mock token structure
  return `test.jwt.token.${userId}.${username}`;
}

export async function fetchAsUser(
  path: string,
  options: RequestInit = {},
  userId: string = 'test-user-123'
): Promise<Response> {
  const token = await generateTestToken(userId);
  
  const url = path.startsWith('http') ? path : `http://localhost:8787${path}`;
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': options.headers?.['Content-Type'] || 'application/json',
    },
  });
}

export async function uploadTestFile(
  filename: string = 'test.csv',
  content: string = 'name,age,city\nJohn,25,NYC\nJane,30,LA',
  userId: string = 'test-user-123'
): Promise<Response> {
  const blob = new Blob([content], { type: 'text/csv' });
  const formData = new FormData();
  formData.append('file', blob, filename);
  
  return fetchAsUser('/api/list_cutter/upload', {
    method: 'POST',
    body: formData,
  }, userId);
}

export async function createTestUser(
  username: string = 'testuser',
  email: string = 'test@example.com',
  password: string = 'testpass123'
): Promise<Response> {
  return fetch('http://localhost:8787/api/accounts/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password,
      password2: password,
    }),
  });
}

export async function loginTestUser(
  username: string = 'testuser',
  password: string = 'testpass123'
): Promise<Response> {
  return fetch('http://localhost:8787/api/accounts/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

// Test data generators
export function generateCSVData(rows: number = 100): string {
  const headers = 'name,age,city,country,email\n';
  const cities = ['NYC', 'LA', 'Chicago', 'Houston', 'Phoenix'];
  const countries = ['USA', 'Canada', 'UK', 'Germany', 'France'];
  
  const dataRows = Array.from({ length: rows }, (_, i) => {
    const name = `User${i + 1}`;
    const age = 20 + (i % 50);
    const city = cities[i % cities.length];
    const country = countries[i % countries.length];
    const email = `user${i + 1}@example.com`;
    return `${name},${age},${city},${country},${email}`;
  }).join('\n');
  
  return headers + dataRows;
}

export function generateLargeCSVData(rows: number = 10000): string {
  // For performance testing
  return generateCSVData(rows);
}

// Mock implementations for isolated testing
export function createMockD1Database() {
  const mockQueries = new Map<string, any>();
  
  return {
    prepare: vi.fn((query: string) => {
      const mockStatement = {
        bind: vi.fn((...params: any[]) => mockStatement),
        first: vi.fn(async () => mockQueries.get(query) || null),
        all: vi.fn(async () => ({ 
          results: mockQueries.get(query + '_all') || [],
          success: true,
          meta: {},
        })),
        run: vi.fn(async () => ({ 
          success: true, 
          meta: { last_row_id: Date.now() },
        })),
      };
      return mockStatement;
    }),
    batch: vi.fn(async (statements: any[]) => ({ 
      success: true,
      results: statements.map(() => ({ success: true })),
    })),
    dump: vi.fn(async () => new ArrayBuffer(0)),
    exec: vi.fn(async () => ({ success: true, results: [] })),
    
    // Test utilities
    setMockResult: (query: string, result: any) => {
      mockQueries.set(query, result);
    },
    setMockResults: (query: string, results: any[]) => {
      mockQueries.set(query + '_all', results);
    },
    clearMocks: () => {
      mockQueries.clear();
      vi.clearAllMocks();
    },
  };
}

export function createMockR2Bucket() {
  const mockFiles = new Map<string, { 
    body: ArrayBuffer | string;
    metadata?: Record<string, string>;
    size: number;
  }>();
  
  return {
    get: vi.fn(async (key: string) => {
      const file = mockFiles.get(key);
      if (!file) return null;
      
      return {
        body: file.body,
        metadata: file.metadata,
        size: file.size,
        arrayBuffer: async () => file.body instanceof ArrayBuffer 
          ? file.body 
          : new TextEncoder().encode(file.body as string),
        text: async () => file.body instanceof ArrayBuffer 
          ? new TextDecoder().decode(file.body)
          : file.body as string,
      };
    }),
    
    put: vi.fn(async (key: string, value: any, options?: any) => {
      const body = value instanceof ArrayBuffer ? value : String(value);
      const size = body instanceof ArrayBuffer ? body.byteLength : body.length;
      
      mockFiles.set(key, {
        body,
        metadata: options?.customMetadata || {},
        size,
      });
      
      return { success: true };
    }),
    
    delete: vi.fn(async (key: string) => {
      const existed = mockFiles.has(key);
      mockFiles.delete(key);
      return { success: true, existed };
    }),
    
    head: vi.fn(async (key: string) => {
      const file = mockFiles.get(key);
      if (!file) return null;
      
      return {
        size: file.size,
        metadata: file.metadata,
      };
    }),
    
    list: vi.fn(async (options?: any) => {
      const keys = Array.from(mockFiles.keys());
      const prefix = options?.prefix || '';
      const filteredKeys = keys.filter(key => key.startsWith(prefix));
      
      return {
        objects: filteredKeys.map(key => ({
          key,
          size: mockFiles.get(key)!.size,
          uploaded: new Date().toISOString(),
        })),
        truncated: false,
      };
    }),
    
    // Test utilities
    setMockFile: (key: string, content: string | ArrayBuffer, metadata?: Record<string, string>) => {
      const size = content instanceof ArrayBuffer ? content.byteLength : content.length;
      mockFiles.set(key, { body: content, metadata, size });
    },
    clearMocks: () => {
      mockFiles.clear();
      vi.clearAllMocks();
    },
  };
}

export function createMockKVNamespace() {
  const mockData = new Map<string, string>();
  
  return {
    get: vi.fn(async (key: string) => mockData.get(key) || null),
    put: vi.fn(async (key: string, value: string, options?: any) => {
      mockData.set(key, value);
      return undefined;
    }),
    delete: vi.fn(async (key: string) => {
      mockData.delete(key);
      return undefined;
    }),
    list: vi.fn(async (options?: any) => {
      const keys = Array.from(mockData.keys());
      const prefix = options?.prefix || '';
      const filteredKeys = keys.filter(key => key.startsWith(prefix));
      
      return {
        keys: filteredKeys.map(name => ({ name })),
        list_complete: true,
      };
    }),
    
    // Test utilities
    setMockValue: (key: string, value: string) => {
      mockData.set(key, value);
    },
    clearMocks: () => {
      mockData.clear();
      vi.clearAllMocks();
    },
  };
}

// Performance testing utilities
export function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve, reject) => {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      const duration = end - start;
      
      console.log(`⏱️  ${name}: ${duration.toFixed(2)}ms`);
      resolve({ result, duration });
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      console.log(`❌ ${name} failed after: ${duration.toFixed(2)}ms`);
      reject(error);
    }
  });
}

// Global test setup
beforeAll(async () => {
  console.log('🚀 Starting unified Workers test suite...');
  
  // Initialize global mocks
  globalThis.testEnv = {
    ...TEST_ENV,
    DB: createMockD1Database(),
    FILE_STORAGE: createMockR2Bucket(),
    AUTH_TOKENS: createMockKVNamespace(),
    CACHE: createMockKVNamespace(),
  };
});

afterAll(async () => {
  console.log('✅ Unified Workers test suite completed.');
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Reset mock data
  if (globalThis.testEnv?.DB?.clearMocks) {
    globalThis.testEnv.DB.clearMocks();
  }
  if (globalThis.testEnv?.FILE_STORAGE?.clearMocks) {
    globalThis.testEnv.FILE_STORAGE.clearMocks();
  }
  if (globalThis.testEnv?.AUTH_TOKENS?.clearMocks) {
    globalThis.testEnv.AUTH_TOKENS.clearMocks();
  }
  if (globalThis.testEnv?.CACHE?.clearMocks) {
    globalThis.testEnv.CACHE.clearMocks();
  }
});

afterEach(() => {
  // Clean up after each test
  vi.restoreAllMocks();
});

// Custom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidJWT(): T;
    toBeValidUUID(): T;
    toBeWithinRange(min: number, max: number): T;
    toHaveValidCSVStructure(): T;
  }
}

// Implement custom matchers (these would be extended in actual implementation)
expect.extend({
  toBeValidJWT(received: string) {
    const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = typeof received === 'string' && jwtPattern.test(received);
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be a valid JWT`
        : `Expected ${received} to be a valid JWT`,
    };
  },
  
  toBeValidUUID(received: string) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidPattern.test(received);
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be a valid UUID`
        : `Expected ${received} to be a valid UUID`,
    };
  },
  
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = typeof received === 'number' && received >= min && received <= max;
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be within range ${min}-${max}`
        : `Expected ${received} to be within range ${min}-${max}`,
    };
  },
  
  toHaveValidCSVStructure(received: string) {
    const lines = received.split('\n').filter(line => line.trim());
    const pass = lines.length > 0 && lines.every(line => line.includes(','));
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to have valid CSV structure`
        : `Expected ${received} to have valid CSV structure`,
    };
  },
});
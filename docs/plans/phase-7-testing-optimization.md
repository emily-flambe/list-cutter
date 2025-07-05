# Phase 7: Testing & Optimization Implementation Plan

## Overview

This document provides a comprehensive technical implementation plan for testing and optimizing the List Cutter application during its migration to Cloudflare Workers. This phase focuses on implementing comprehensive testing strategies, performance optimization, monitoring, and quality assurance to ensure the application meets production standards.

## Table of Contents

1. [Testing Strategy Overview](#testing-strategy-overview)
2. [Unit Testing Implementation](#unit-testing-implementation)
3. [Integration Testing](#integration-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [Performance Testing](#performance-testing)
6. [Security Testing](#security-testing)
7. [Load Testing](#load-testing)
8. [Performance Optimization](#performance-optimization)
9. [Monitoring & Observability](#monitoring--observability)
10. [Error Handling & Logging](#error-handling--logging)
11. [Caching Strategies](#caching-strategies)
12. [Database Optimization](#database-optimization)
13. [Bundle Optimization](#bundle-optimization)
14. [Testing Automation](#testing-automation)
15. [Quality Gates](#quality-gates)

## Testing Strategy Overview

### Testing Pyramid Structure

```
         /\
        /  \
       /E2E \  <- End-to-End Tests (5-10%)
      /______\
     /        \
    /Integration\ <- Integration Tests (15-25%)
   /____________\
  /              \
 /  Unit Tests    \ <- Unit Tests (65-80%)
/________________\
```

### Test Categories

1. **Unit Tests**: Individual functions and components
2. **Integration Tests**: API endpoints and service interactions
3. **End-to-End Tests**: Complete user workflows
4. **Performance Tests**: Load, stress, and scalability
5. **Security Tests**: Authentication, authorization, and vulnerability
6. **Smoke Tests**: Basic functionality verification

## Unit Testing Implementation

### Testing Framework Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'build/'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    globals: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests')
    }
  }
});
```

### Test Environment Setup

```typescript
// tests/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { unstable_dev } from 'wrangler';

declare global {
  var testWorker: any;
  var testEnv: any;
}

beforeAll(async () => {
  // Initialize test worker
  globalThis.testWorker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    local: true
  });
  
  // Mock environment variables
  globalThis.testEnv = {
    DB: createMockD1Database(),
    FILES_BUCKET: createMockR2Bucket(),
    AUTH_KV: createMockKVNamespace(),
    JWT_SECRET: 'test-secret-key',
    CORS_ORIGIN: 'http://localhost:3000'
  };
});

afterAll(async () => {
  if (globalThis.testWorker) {
    await globalThis.testWorker.stop();
  }
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

// Mock implementations
function createMockD1Database() {
  const mockDB = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
      })),
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    }))
  };
  return mockDB;
}

function createMockR2Bucket() {
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    head: vi.fn(),
    list: vi.fn(),
    createMultipartUpload: vi.fn(),
    uploadPart: vi.fn(),
    completeMultipartUpload: vi.fn(),
    abortMultipartUpload: vi.fn()
  };
}

function createMockKVNamespace() {
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  };
}
```

### Service Layer Unit Tests

```typescript
// tests/unit/services/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateJWT, verifyJWT, hashPassword, verifyPassword } from '@/services/auth';

describe('Auth Service', () => {
  const mockEnv = globalThis.testEnv;
  
  describe('JWT Operations', () => {
    it('should generate valid JWT tokens', async () => {
      const payload = {
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
        token_type: 'access' as const
      };
      
      const token = await generateJWT(payload, mockEnv.JWT_SECRET, '10m');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
    
    it('should verify JWT tokens correctly', async () => {
      const payload = {
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
        token_type: 'access' as const
      };
      
      const token = await generateJWT(payload, mockEnv.JWT_SECRET, '10m');
      const verified = await verifyJWT(token, mockEnv.JWT_SECRET);
      
      expect(verified).toBeDefined();
      expect(verified?.user_id).toBe(payload.user_id);
      expect(verified?.username).toBe(payload.username);
    });
    
    it('should reject invalid JWT tokens', async () => {
      const invalidToken = 'invalid.jwt.token';
      const verified = await verifyJWT(invalidToken, mockEnv.JWT_SECRET);
      expect(verified).toBeNull();
    });
  });
  
  describe('Password Operations', () => {
    it('should hash passwords securely', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).toMatch(/^pbkdf2_sha256\$\d+\$.+\$.+$/);
      expect(hash).not.toContain(password);
    });
    
    it('should verify passwords correctly', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await verifyPassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });
});
```

### CSV Processing Unit Tests

```typescript
// tests/unit/services/csvProcessor.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CSVProcessor } from '@/services/csvProcessor';

describe('CSV Processor', () => {
  let processor: CSVProcessor;
  
  beforeEach(() => {
    processor = new CSVProcessor();
  });
  
  describe('parseCSV', () => {
    it('should parse simple CSV correctly', () => {
      const csv = 'name,age,city\nJohn,25,NYC\nJane,30,LA';
      const result = processor.parseCSV(csv);
      
      expect(result).toEqual([
        { name: 'John', age: '25', city: 'NYC' },
        { name: 'Jane', age: '30', city: 'LA' }
      ]);
    });
    
    it('should handle quoted fields', () => {
      const csv = 'name,description\n"John Doe","A person with, comma"\n"Jane Smith","Another person"';
      const result = processor.parseCSV(csv);
      
      expect(result).toEqual([
        { name: 'John Doe', description: 'A person with, comma' },
        { name: 'Jane Smith', description: 'Another person' }
      ]);
    });
    
    it('should handle empty rows', () => {
      const csv = 'name,age\nJohn,25\n\nJane,30';
      const result = processor.parseCSV(csv);
      
      expect(result).toEqual([
        { name: 'John', age: '25' },
        { name: 'Jane', age: '30' }
      ]);
    });
  });
  
  describe('filterRows', () => {
    const testData = [
      { name: 'John', age: '25', city: 'NYC' },
      { name: 'Jane', age: '30', city: 'LA' },
      { name: 'Bob', age: '35', city: 'NYC' }
    ];
    
    it('should filter by single condition', () => {
      const filters = { city: 'NYC' };
      const result = processor.filterRows(testData, filters);
      
      expect(result).toHaveLength(2);
      expect(result.every(row => row.city === 'NYC')).toBe(true);
    });
    
    it('should filter by multiple conditions', () => {
      const filters = { city: 'NYC', age: '25' };
      const result = processor.filterRows(testData, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John');
    });
    
    it('should return empty array when no matches', () => {
      const filters = { city: 'NONEXISTENT' };
      const result = processor.filterRows(testData, filters);
      
      expect(result).toHaveLength(0);
    });
  });
  
  describe('selectColumns', () => {
    const testData = [
      { name: 'John', age: '25', city: 'NYC', country: 'USA' },
      { name: 'Jane', age: '30', city: 'LA', country: 'USA' }
    ];
    
    it('should select specific columns', () => {
      const columns = ['name', 'city'];
      const result = processor.selectColumns(testData, columns);
      
      expect(result).toEqual([
        { name: 'John', city: 'NYC' },
        { name: 'Jane', city: 'LA' }
      ]);
    });
    
    it('should handle non-existent columns', () => {
      const columns = ['name', 'nonexistent'];
      const result = processor.selectColumns(testData, columns);
      
      expect(result).toEqual([
        { name: 'John', nonexistent: undefined },
        { name: 'Jane', nonexistent: undefined }
      ]);
    });
  });
});
```

### Database Service Unit Tests

```typescript
// tests/unit/services/database.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DatabaseService } from '@/services/database';

describe('Database Service', () => {
  let db: DatabaseService;
  let mockD1: any;
  
  beforeEach(() => {
    mockD1 = globalThis.testEnv.DB;
    db = new DatabaseService(mockD1);
  });
  
  describe('User Operations', () => {
    it('should create user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      };
      
      mockD1.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 1,
            username: 'testuser',
            email: 'test@example.com'
          })
        })
      });
      
      const result = await db.createUser(userData);
      
      expect(result).toBeDefined();
      expect(result.username).toBe(userData.username);
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users')
      );
    });
    
    it('should find user by username', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      };
      
      mockD1.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockUser)
        })
      });
      
      const result = await db.findUserByUsername('testuser');
      
      expect(result).toEqual(mockUser);
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE username = ?')
      );
    });
    
    it('should return null when user not found', async () => {
      mockD1.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null)
        })
      });
      
      const result = await db.findUserByUsername('nonexistent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('File Operations', () => {
    it('should save file metadata', async () => {
      const fileData = {
        user_id: 1,
        file_id: 'test-file-id',
        filename: 'test.csv',
        file_size: 1024,
        r2_key: 'uploads/user-1/test-file-id.csv'
      };
      
      mockD1.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });
      
      const result = await db.saveFileMetadata(fileData);
      
      expect(result.success).toBe(true);
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO files')
      );
    });
    
    it('should get user files', async () => {
      const mockFiles = [
        { id: 1, filename: 'file1.csv', file_size: 1024 },
        { id: 2, filename: 'file2.csv', file_size: 2048 }
      ];
      
      mockD1.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: mockFiles })
        })
      });
      
      const result = await db.getUserFiles(1);
      
      expect(result.results).toEqual(mockFiles);
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM files WHERE user_id = ?')
      );
    });
  });
});
```

## Integration Testing

### API Endpoint Integration Tests

```typescript
// tests/integration/api/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unstable_dev } from 'wrangler';

describe('Authentication API Integration', () => {
  let worker: any;
  
  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true
    });
  });
  
  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
  });
  
  describe('POST /api/accounts/register', () => {
    it('should register new user successfully', async () => {
      const response = await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          password: 'testpass123',
          password2: 'testpass123'
        })
      });
      
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.user.username).toBe('testuser');
    });
    
    it('should reject duplicate username', async () => {
      // Register first user
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'duplicate',
          email: 'first@example.com',
          password: 'testpass123',
          password2: 'testpass123'
        })
      });
      
      // Try to register same username
      const response = await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'duplicate',
          email: 'second@example.com',
          password: 'testpass123',
          password2: 'testpass123'
        })
      });
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('already exists');
    });
    
    it('should validate password confirmation', async () => {
      const response = await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          email: 'test@example.com',
          password: 'testpass123',
          password2: 'differentpass'
        })
      });
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('do not match');
    });
  });
  
  describe('POST /api/accounts/login', () => {
    beforeEach(async () => {
      // Register a test user
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logintest',
          email: 'logintest@example.com',
          password: 'testpass123',
          password2: 'testpass123'
        })
      });
    });
    
    it('should login with valid credentials', async () => {
      const response = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logintest',
          password: 'testpass123'
        })
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.user.username).toBe('logintest');
    });
    
    it('should reject invalid credentials', async () => {
      const response = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logintest',
          password: 'wrongpassword'
        })
      });
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toContain('Invalid credentials');
    });
  });
  
  describe('Token Refresh Flow', () => {
    it('should refresh tokens successfully', async () => {
      // Login to get tokens
      const loginResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'logintest',
          password: 'testpass123'
        })
      });
      
      const loginData = await loginResponse.json();
      
      // Use refresh token to get new tokens
      const refreshResponse = await worker.fetch('/api/accounts/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: loginData.refresh_token
        })
      });
      
      expect(refreshResponse.status).toBe(200);
      
      const refreshData = await refreshResponse.json();
      expect(refreshData.access_token).toBeDefined();
      expect(refreshData.refresh_token).toBeDefined();
      expect(refreshData.access_token).not.toBe(loginData.access_token);
    });
  });
});
```

### File Upload Integration Tests

```typescript
// tests/integration/api/files.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unstable_dev } from 'wrangler';

describe('File Upload API Integration', () => {
  let worker: any;
  let accessToken: string;
  
  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true
    });
    
    // Create test user and get access token
    const registerResponse = await worker.fetch('/api/accounts/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'filetest',
        email: 'filetest@example.com',
        password: 'testpass123',
        password2: 'testpass123'
      })
    });
    
    const userData = await registerResponse.json();
    accessToken = userData.access_token;
  });
  
  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
  });
  
  describe('POST /api/files/upload', () => {
    it('should upload CSV file successfully', async () => {
      const csvContent = 'name,age,city\nJohn,25,NYC\nJane,30,LA';
      const blob = new Blob([csvContent], { type: 'text/csv' });
      
      const formData = new FormData();
      formData.append('file', blob, 'test.csv');
      
      const response = await worker.fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.file_id).toBeDefined();
      expect(data.filename).toBe('test.csv');
    });
    
    it('should reject unauthorized upload', async () => {
      const csvContent = 'name,age,city\nJohn,25,NYC';
      const blob = new Blob([csvContent], { type: 'text/csv' });
      
      const formData = new FormData();
      formData.append('file', blob, 'test.csv');
      
      const response = await worker.fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(401);
    });
    
    it('should reject non-CSV files', async () => {
      const txtContent = 'This is not a CSV file';
      const blob = new Blob([txtContent], { type: 'text/plain' });
      
      const formData = new FormData();
      formData.append('file', blob, 'test.txt');
      
      const response = await worker.fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('Invalid file type');
    });
  });
  
  describe('GET /api/files/', () => {
    it('should list user files', async () => {
      // Upload a test file first
      const csvContent = 'name,age\nJohn,25';
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'test.csv');
      
      await worker.fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData
      });
      
      // List files
      const response = await worker.fetch('/api/files/', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.files).toBeDefined();
      expect(data.files.length).toBeGreaterThan(0);
    });
  });
});
```

## End-to-End Testing

### Playwright E2E Tests

```typescript
// tests/e2e/user-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });
  
  test('complete user registration and file upload flow', async ({ page }) => {
    // Register new user
    await page.click('text=Sign Up');
    await page.fill('input[name="username"]', 'e2etest');
    await page.fill('input[name="email"]', 'e2etest@example.com');
    await page.fill('input[name="password"]', 'testpass123');
    await page.fill('input[name="password2"]', 'testpass123');
    await page.click('button[type="submit"]');
    
    // Verify dashboard loads
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Upload CSV file
    const csvContent = 'name,age,city\nJohn,25,NYC\nJane,30,LA\nBob,35,NYC';
    await page.setInputFiles('input[type="file"]', {
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    });
    
    // Wait for upload to complete
    await expect(page.locator('text=Upload successful')).toBeVisible();
    
    // Verify file appears in list
    await expect(page.locator('text=test.csv')).toBeVisible();
    
    // Test CSV processing
    await page.click('text=Process CSV');
    await page.selectOption('select[name="columns"]', ['name', 'city']);
    await page.fill('input[name="filter"]', 'city=NYC');
    await page.click('button[text="Apply Filter"]');
    
    // Verify results
    await expect(page.locator('text=2 rows found')).toBeVisible();
    await expect(page.locator('text=John')).toBeVisible();
    await expect(page.locator('text=Bob')).toBeVisible();
    
    // Download filtered CSV
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Download Results');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/filtered.*\.csv/);
  });
  
  test('user authentication flow', async ({ page }) => {
    // Test login
    await page.click('text=Sign In');
    await page.fill('input[name="username"]', 'existinguser');
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    
    // Verify login success
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Test logout
    await page.click('text=Logout');
    await expect(page.locator('text=Sign In')).toBeVisible();
  });
  
  test('error handling for invalid operations', async ({ page }) => {
    // Test invalid file upload
    await page.click('text=Sign In');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    
    // Try to upload invalid file type
    await page.setInputFiles('input[type="file"]', {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Not a CSV')
    });
    
    // Verify error message
    await expect(page.locator('text=Invalid file type')).toBeVisible();
  });
});
```

## Performance Testing

### Load Testing with Artillery

```javascript
// tests/load/load-test.yml
config:
  target: 'https://your-worker.your-subdomain.workers.dev'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Load test"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  variables:
    testUsers: 
      - username: "testuser1"
        password: "testpass123"
      - username: "testuser2"
        password: "testpass123"
  processor: "./load-test-processor.js"

scenarios:
  - name: "Authentication Flow"
    weight: 30
    flow:
      - post:
          url: "/api/accounts/login"
          json:
            username: "{{ testUsers[0].username }}"
            password: "{{ testUsers[0].password }}"
          capture:
            - json: "$.access_token"
              as: "accessToken"
      - get:
          url: "/api/accounts/user"
          headers:
            Authorization: "Bearer {{ accessToken }}"
          
  - name: "File Upload Flow"
    weight: 40
    flow:
      - post:
          url: "/api/accounts/login"
          json:
            username: "{{ testUsers[1].username }}"
            password: "{{ testUsers[1].password }}"
          capture:
            - json: "$.access_token"
              as: "accessToken"
      - post:
          url: "/api/files/upload"
          headers:
            Authorization: "Bearer {{ accessToken }}"
          formData:
            file: "@./test-data/sample.csv"
            
  - name: "CSV Processing Flow"
    weight: 30
    flow:
      - function: "loginAndUpload"
      - post:
          url: "/api/list_cutter/csv_cutter"
          headers:
            Authorization: "Bearer {{ accessToken }}"
          json:
            file_id: "{{ fileId }}"
            selected_columns: ["name", "age"]
            where_filters: {}
```

### Performance Benchmarks

```typescript
// tests/performance/benchmarks.test.ts
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Performance Benchmarks', () => {
  it('should handle JWT generation within 50ms', async () => {
    const start = performance.now();
    
    const token = await generateJWT({
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com',
      token_type: 'access'
    }, 'secret', '10m');
    
    const end = performance.now();
    const duration = end - start;
    
    expect(duration).toBeLessThan(50);
    expect(token).toBeDefined();
  });
  
  it('should process CSV with 1000 rows within 200ms', async () => {
    const csvData = generateTestCSV(1000);
    const processor = new CSVProcessor();
    
    const start = performance.now();
    const result = processor.parseCSV(csvData);
    const end = performance.now();
    
    const duration = end - start;
    
    expect(duration).toBeLessThan(200);
    expect(result).toHaveLength(1000);
  });
  
  it('should handle database queries within 25ms', async () => {
    const db = new DatabaseService(mockD1);
    
    const start = performance.now();
    await db.findUserByUsername('testuser');
    const end = performance.now();
    
    const duration = end - start;
    
    expect(duration).toBeLessThan(25);
  });
});

function generateTestCSV(rows: number): string {
  const headers = 'name,age,city,country\n';
  const dataRows = Array.from({ length: rows }, (_, i) => 
    `User${i},${20 + i % 50},City${i % 10},Country${i % 5}`
  ).join('\n');
  
  return headers + dataRows;
}
```

## Security Testing

### Security Test Suite

```typescript
// tests/security/security.test.ts
import { describe, it, expect } from 'vitest';
import { unstable_dev } from 'wrangler';

describe('Security Tests', () => {
  let worker: any;
  
  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true
    });
  });
  
  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
  });
  
  describe('Authentication Security', () => {
    it('should reject requests with invalid JWT', async () => {
      const response = await worker.fetch('/api/accounts/user', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid.jwt.token'
        }
      });
      
      expect(response.status).toBe(401);
    });
    
    it('should reject requests with expired JWT', async () => {
      // Create an expired token
      const expiredToken = await generateJWT({
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
        token_type: 'access'
      }, 'secret', '-1m'); // Negative expiration
      
      const response = await worker.fetch('/api/accounts/user', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      });
      
      expect(response.status).toBe(401);
    });
    
    it('should enforce rate limiting', async () => {
      const requests = Array.from({ length: 101 }, () => 
        worker.fetch('/api/accounts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'testuser',
            password: 'wrongpassword'
          })
        })
      );
      
      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
  
  describe('Input Validation', () => {
    it('should sanitize SQL injection attempts', async () => {
      const response = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: "admin'; DROP TABLE users; --",
          password: 'password'
        })
      });
      
      expect(response.status).toBe(401);
      // Database should still be intact
    });
    
    it('should reject XSS attempts in CSV upload', async () => {
      const maliciousCSV = 'name,description\n<script>alert("xss")</script>,evil';
      const blob = new Blob([maliciousCSV], { type: 'text/csv' });
      
      const formData = new FormData();
      formData.append('file', blob, 'malicious.csv');
      
      const response = await worker.fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getValidToken()}`
        },
        body: formData
      });
      
      // Should either reject or sanitize
      expect(response.status).toBeLessThan(500);
    });
  });
  
  describe('File Upload Security', () => {
    it('should reject oversized files', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const blob = new Blob([largeContent], { type: 'text/csv' });
      
      const formData = new FormData();
      formData.append('file', blob, 'large.csv');
      
      const response = await worker.fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getValidToken()}`
        },
        body: formData
      });
      
      expect(response.status).toBe(400);
    });
    
    it('should reject files with executable extensions', async () => {
      const content = 'malicious content';
      const blob = new Blob([content], { type: 'application/x-executable' });
      
      const formData = new FormData();
      formData.append('file', blob, 'malicious.exe');
      
      const response = await worker.fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getValidToken()}`
        },
        body: formData
      });
      
      expect(response.status).toBe(400);
    });
  });
});
```

## Performance Optimization

### Bundle Analysis and Optimization

```typescript
// scripts/analyze-bundle.ts
import { analyzeBundle } from 'rollup-plugin-analyzer';
import { build } from 'esbuild';

async function analyzeBundleSize() {
  const result = await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: true,
    format: 'esm',
    outfile: 'dist/index.js',
    platform: 'node',
    target: 'es2022',
    write: false,
    metafile: true,
    treeShaking: true,
    splitting: false
  });
  
  console.log('Bundle Analysis:');
  console.log(`Total size: ${result.outputFiles[0].contents.length} bytes`);
  console.log(`Gzipped size: ${await getGzipSize(result.outputFiles[0].contents)}`);
  
  // Analyze dependencies
  const metafile = result.metafile;
  const dependencies = Object.keys(metafile.inputs);
  
  console.log('\nDependency Analysis:');
  dependencies.forEach(dep => {
    const size = metafile.inputs[dep].bytes;
    console.log(`${dep}: ${size} bytes`);
  });
}

async function getGzipSize(contents: Uint8Array): Promise<number> {
  const { gzip } = await import('node:zlib');
  return new Promise((resolve, reject) => {
    gzip(contents, (err, result) => {
      if (err) reject(err);
      else resolve(result.length);
    });
  });
}

analyzeBundleSize().catch(console.error);
```

### Caching Strategy Implementation

```typescript
// src/middleware/cache.ts
export class CacheManager {
  private cache: Map<string, { data: any; expires: number }> = new Map();
  
  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }
  
  async set<T>(key: string, data: T, ttlSeconds: number = 3600): Promise<void> {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expires });
  }
  
  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    
    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
}

// Usage in middleware
export async function cacheMiddleware(
  request: Request,
  env: Env,
  cache: CacheManager
): Promise<Response | null> {
  const url = new URL(request.url);
  const cacheKey = `${request.method}:${url.pathname}${url.search}`;
  
  // Only cache GET requests
  if (request.method !== 'GET') return null;
  
  // Check cache
  const cached = await cache.get<Response>(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...cached.headers, 'X-Cache': 'HIT' }
    });
  }
  
  return null;
}
```

### Database Query Optimization

```typescript
// src/services/database/optimized.ts
export class OptimizedDatabaseService {
  private queryCache = new Map<string, any>();
  
  constructor(private db: D1Database) {}
  
  async findUserByUsernameOptimized(username: string): Promise<User | null> {
    const cacheKey = `user:${username}`;
    
    // Check cache first
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey);
    }
    
    // Use prepared statement with index
    const stmt = this.db.prepare(`
      SELECT id, username, email, created_at 
      FROM users 
      WHERE username = ? 
      LIMIT 1
    `);
    
    const result = await stmt.bind(username).first();
    
    // Cache result for 5 minutes
    if (result) {
      setTimeout(() => this.queryCache.delete(cacheKey), 5 * 60 * 1000);
      this.queryCache.set(cacheKey, result);
    }
    
    return result as User | null;
  }
  
  async getUserFilesOptimized(userId: number, limit: number = 50): Promise<FileInfo[]> {
    const cacheKey = `files:${userId}:${limit}`;
    
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey);
    }
    
    // Use optimized query with proper indexing
    const stmt = this.db.prepare(`
      SELECT id, filename, file_size, created_at, r2_key
      FROM files 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    const result = await stmt.bind(userId, limit).all();
    
    // Cache for 2 minutes
    setTimeout(() => this.queryCache.delete(cacheKey), 2 * 60 * 1000);
    this.queryCache.set(cacheKey, result.results);
    
    return result.results as FileInfo[];
  }
  
  async batchInsertFiles(files: FileInfo[]): Promise<void> {
    // Use batch insert for better performance
    const stmt = this.db.prepare(`
      INSERT INTO files (user_id, filename, file_size, r2_key, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const batch = files.map(file => 
      stmt.bind(file.user_id, file.filename, file.file_size, file.r2_key, file.created_at)
    );
    
    await this.db.batch(batch);
  }
}
```

## Monitoring & Observability

### Metrics Collection

```typescript
// src/middleware/metrics.ts
export class MetricsCollector {
  private metrics: Map<string, number> = new Map();
  
  increment(metric: string, value: number = 1): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }
  
  time<T>(metric: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    return fn().then(
      result => {
        const duration = performance.now() - start;
        this.increment(`${metric}.duration`, duration);
        this.increment(`${metric}.count`);
        return result;
      },
      error => {
        const duration = performance.now() - start;
        this.increment(`${metric}.duration`, duration);
        this.increment(`${metric}.error`);
        throw error;
      }
    );
  }
  
  gauge(metric: string, value: number): void {
    this.metrics.set(metric, value);
  }
  
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
  
  reset(): void {
    this.metrics.clear();
  }
}

// Usage in request handler
export async function metricsMiddleware(
  request: Request,
  env: Env,
  metrics: MetricsCollector
): Promise<Response> {
  const url = new URL(request.url);
  const route = url.pathname;
  
  metrics.increment('requests.total');
  metrics.increment(`requests.${request.method.toLowerCase()}`);
  metrics.increment(`routes.${route.replace(/\//, '_')}`);
  
  const start = performance.now();
  
  try {
    const response = await handleRequest(request, env);
    
    const duration = performance.now() - start;
    metrics.increment('requests.success');
    metrics.increment(`response.${response.status}`);
    metrics.gauge('request.duration', duration);
    
    return response;
  } catch (error) {
    const duration = performance.now() - start;
    metrics.increment('requests.error');
    metrics.gauge('request.duration', duration);
    
    throw error;
  }
}
```

### Health Checks and Monitoring

```typescript
// src/routes/health.ts
export async function healthCheck(env: Env): Promise<Response> {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: env.APP_VERSION || '1.0.0',
    environment: env.ENVIRONMENT || 'development',
    checks: {
      database: { status: 'unknown', latency: 0 },
      storage: { status: 'unknown', latency: 0 },
      auth: { status: 'unknown', latency: 0 }
    }
  };
  
  // Database health check
  try {
    const start = performance.now();
    await env.DB.prepare('SELECT 1').first();
    const latency = performance.now() - start;
    
    healthStatus.checks.database = {
      status: 'healthy',
      latency: Math.round(latency)
    };
  } catch (error) {
    healthStatus.checks.database = {
      status: 'unhealthy',
      latency: 0,
      error: error.message
    };
    healthStatus.status = 'degraded';
  }
  
  // Storage health check
  try {
    const start = performance.now();
    await env.FILES_BUCKET.head('health-check');
    const latency = performance.now() - start;
    
    healthStatus.checks.storage = {
      status: 'healthy',
      latency: Math.round(latency)
    };
  } catch (error) {
    healthStatus.checks.storage = {
      status: 'unhealthy',
      latency: 0,
      error: error.message
    };
    healthStatus.status = 'degraded';
  }
  
  // Auth KV health check
  try {
    const start = performance.now();
    await env.AUTH_KV.get('health-check');
    const latency = performance.now() - start;
    
    healthStatus.checks.auth = {
      status: 'healthy',
      latency: Math.round(latency)
    };
  } catch (error) {
    healthStatus.checks.auth = {
      status: 'unhealthy',
      latency: 0,
      error: error.message
    };
    healthStatus.status = 'degraded';
  }
  
  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  
  return new Response(JSON.stringify(healthStatus, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
```

## Quality Gates

### CI/CD Pipeline Configuration

```yaml
# .github/workflows/test-and-deploy.yml
name: Test and Deploy

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Type checking
        run: npm run typecheck
        
      - name: Linting
        run: npm run lint
        
      - name: Unit tests
        run: npm run test:unit
        
      - name: Integration tests
        run: npm run test:integration
        
      - name: Coverage check
        run: npm run test:coverage
        
      - name: Security audit
        run: npm audit --audit-level=high
        
      - name: Bundle analysis
        run: npm run analyze-bundle
        
      - name: Performance benchmarks
        run: npm run test:performance
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright
        run: npx playwright install
        
      - name: Start test server
        run: npm run dev &
        
      - name: Wait for server
        run: npx wait-on http://localhost:8788
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload E2E artifacts
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    runs-on: ubuntu-latest
    needs: [test, e2e]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

### Quality Metrics Dashboard

```typescript
// src/utils/qualityMetrics.ts
export interface QualityMetrics {
  testCoverage: number;
  performanceScore: number;
  securityScore: number;
  codeQuality: number;
  errorRate: number;
  responseTime: number;
}

export class QualityTracker {
  private metrics: QualityMetrics = {
    testCoverage: 0,
    performanceScore: 0,
    securityScore: 0,
    codeQuality: 0,
    errorRate: 0,
    responseTime: 0
  };
  
  updateCoverage(coverage: number): void {
    this.metrics.testCoverage = coverage;
  }
  
  updatePerformance(score: number): void {
    this.metrics.performanceScore = score;
  }
  
  updateSecurity(score: number): void {
    this.metrics.securityScore = score;
  }
  
  updateCodeQuality(score: number): void {
    this.metrics.codeQuality = score;
  }
  
  updateErrorRate(rate: number): void {
    this.metrics.errorRate = rate;
  }
  
  updateResponseTime(time: number): void {
    this.metrics.responseTime = time;
  }
  
  getOverallScore(): number {
    const weights = {
      testCoverage: 0.25,
      performanceScore: 0.2,
      securityScore: 0.25,
      codeQuality: 0.15,
      errorRate: 0.1,
      responseTime: 0.05
    };
    
    const weightedScore = 
      (this.metrics.testCoverage * weights.testCoverage) +
      (this.metrics.performanceScore * weights.performanceScore) +
      (this.metrics.securityScore * weights.securityScore) +
      (this.metrics.codeQuality * weights.codeQuality) +
      ((100 - this.metrics.errorRate) * weights.errorRate) +
      (Math.max(0, 100 - this.metrics.responseTime) * weights.responseTime);
    
    return Math.round(weightedScore);
  }
  
  getQualityGate(): 'pass' | 'warn' | 'fail' {
    const score = this.getOverallScore();
    
    if (score >= 85) return 'pass';
    if (score >= 70) return 'warn';
    return 'fail';
  }
  
  getMetrics(): QualityMetrics & { overallScore: number; gate: string } {
    return {
      ...this.metrics,
      overallScore: this.getOverallScore(),
      gate: this.getQualityGate()
    };
  }
}
```

## Implementation Timeline

### Phase 7 Schedule (1-2 weeks)

#### Week 1: Core Testing Implementation
- **Day 1-2**: Set up testing framework and unit tests
- **Day 3-4**: Implement integration tests
- **Day 5**: End-to-end testing setup

#### Week 2: Optimization and Quality
- **Day 1-2**: Performance optimization and load testing
- **Day 3**: Security testing and vulnerability assessment
- **Day 4**: Monitoring and observability setup
- **Day 5**: Quality gates and CI/CD pipeline

### Success Criteria

- **Test Coverage**: >90% code coverage
- **Performance**: <100ms average response time
- **Security**: Zero high-severity vulnerabilities
- **Quality Score**: >85% overall quality score
- **CI/CD**: Automated testing and deployment pipeline
- **Monitoring**: Real-time metrics and alerting

### Quality Gates

1. **Code Quality Gate**: 
   - Test coverage >90%
   - No linting errors
   - TypeScript compilation passes

2. **Security Gate**:
   - No high-severity vulnerabilities
   - All security tests pass
   - Rate limiting functional

3. **Performance Gate**:
   - Response time <100ms
   - Bundle size <1MB
   - Memory usage <128MB

4. **Functionality Gate**:
   - All unit tests pass
   - Integration tests pass
   - E2E tests pass

This comprehensive testing and optimization phase ensures the List Cutter application meets production standards for performance, security, and reliability while maintaining high code quality and test coverage.
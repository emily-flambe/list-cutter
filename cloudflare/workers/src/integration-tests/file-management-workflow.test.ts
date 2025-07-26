/**
 * Integration tests for the complete file management workflow
 * Tests the flow from synthetic data creation through file management operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('File Management Workflow Integration Tests', () => {
  let worker: UnstableDevWorker;
  let authToken: string;
  let userId: string;
  let createdFileId: string;

  beforeAll(async () => {
    // Start the worker
    worker = await unstable_dev(
      'src/index.ts',
      {
        experimental: { disableExperimentalWarning: true },
      }
    );
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('Complete File Management Workflow', () => {
    // Step 1: Register a test user
    it('should register a new user', async () => {
      const response = await worker.fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          username: 'testuser'
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.token).toBeDefined();
      expect(data.user).toBeDefined();
      
      authToken = data.token;
      userId = data.user.id;
    });

    // Step 2: Create a synthetic data file
    it('should create a synthetic data file', async () => {
      const response = await worker.fetch('/api/v1/synthetic-data/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          dataset: 'voter-registration',
          count: 10,
          state: 'CA',
          options: {
            includeHeaders: true
          }
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.downloadUrl).toBeDefined();
      expect(data.fileId).toBeDefined();
      expect(data.filename).toContain('synthetic-voter-data');
      
      createdFileId = data.fileId;
    });

    // Step 3: List files and verify the created file appears
    it('should list files including the synthetic data file', async () => {
      const response = await worker.fetch('/api/v1/files', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.files).toBeDefined();
      expect(Array.isArray(data.files)).toBe(true);
      
      // Find our created file
      const createdFile = data.files.find(f => f.id === createdFileId);
      expect(createdFile).toBeDefined();
      expect(createdFile.source).toBe('synthetic-data');
      expect(createdFile.mimeType).toBe('text/csv');
      expect(createdFile.size).toBeGreaterThan(0);
    });

    // Step 4: Test CSV filtering
    it('should filter only CSV files', async () => {
      const response = await worker.fetch('/api/v1/files?type=csv', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // All files should be CSV type
      data.files.forEach(file => {
        expect(['text/csv', 'application/vnd.ms-excel', 'text/plain']).toContain(file.mimeType);
      });
    });

    // Step 5: Download the file
    it('should download the synthetic data file', async () => {
      const response = await worker.fetch(`/api/v1/files/${createdFileId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      
      const content = await response.text();
      expect(content).toContain('first_name'); // CSV header
      expect(content).toContain('CA'); // State data
    });

    // Step 6: Test anonymous download (should fail for non-anonymous files)
    it('should not allow anonymous download of user files', async () => {
      const response = await worker.fetch(`/api/v1/files/${createdFileId}`);
      
      expect(response.status).toBe(404);
    });

    // Step 7: Test cross-user access (should fail)
    it('should not allow access to files from other users', async () => {
      // Register another user
      const registerResponse = await worker.fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: `other-${Date.now()}@example.com`,
          password: 'OtherPassword123!',
          username: 'otheruser'
        }),
      });

      const { token: otherToken } = await registerResponse.json();

      // Try to access the first user's file
      const response = await worker.fetch(`/api/v1/files/${createdFileId}`, {
        headers: {
          'Authorization': `Bearer ${otherToken}`,
        },
      });

      expect(response.status).toBe(404);
    });

    // Step 8: Delete the file
    it('should delete the synthetic data file', async () => {
      const response = await worker.fetch(`/api/v1/files/${createdFileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    // Step 9: Verify file is deleted
    it('should not find the deleted file', async () => {
      // Try to download deleted file
      const downloadResponse = await worker.fetch(`/api/v1/files/${createdFileId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(downloadResponse.status).toBe(404);

      // List files and verify it's not there
      const listResponse = await worker.fetch('/api/v1/files', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await listResponse.json();
      const deletedFile = data.files.find(f => f.id === createdFileId);
      expect(deletedFile).toBeUndefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle authentication errors gracefully', async () => {
      const response = await worker.fetch('/api/v1/files', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should handle missing authentication', async () => {
      const response = await worker.fetch('/api/v1/files');

      expect(response.status).toBe(401);
    });

    it('should return proper error for non-existent files', async () => {
      const response = await worker.fetch('/api/v1/files/non-existent-id', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      const response = await worker.fetch('/api/v1/files?limit=5&offset=0', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pagination).toBeDefined();
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(0);
      expect(data.files.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        worker.fetch('/api/v1/files', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should list files efficiently with many records', async () => {
      const startTime = Date.now();
      
      const response = await worker.fetch('/api/v1/files?limit=100', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
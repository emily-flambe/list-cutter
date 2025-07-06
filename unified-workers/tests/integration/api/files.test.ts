import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createTestUser, 
  loginTestUser, 
  fetchAsUser, 
  uploadTestFile,
  generateCSVData 
} from '@tests/setup/unified-worker';

describe('File Management API Integration', () => {
  let testUserCredentials: {
    username: string;
    email: string;
    password: string;
  };
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    // Create unique test credentials for each test
    const timestamp = Date.now();
    testUserCredentials = {
      username: `filetest_${timestamp}`,
      email: `filetest_${timestamp}@example.com`,
      password: 'testpass123',
    };

    // Create test user and get access token
    await createTestUser(
      testUserCredentials.username,
      testUserCredentials.email,
      testUserCredentials.password
    );

    const loginResponse = await loginTestUser(
      testUserCredentials.username,
      testUserCredentials.password
    );
    
    const loginData = await loginResponse.json();
    accessToken = loginData.access_token;
    userId = loginData.user.id;
  });

  describe('POST /api/list_cutter/upload', () => {
    it('should upload CSV file successfully', async () => {
      const csvContent = 'name,age,city\nJohn,25,NYC\nJane,30,LA';
      const response = await uploadTestFile('test.csv', csvContent, testUserCredentials.username);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        filename: 'test.csv',
      });
      
      expect(data.file_id).toBeDefined();
      expect(data.file_id).toBeValidUUID();
      expect(data.file_size).toBeGreaterThan(0);
      expect(data.upload_time).toBeDefined();
    });

    it('should handle large CSV files', async () => {
      const largeCsvContent = generateCSVData(5000); // 5000 rows
      const response = await uploadTestFile('large_test.csv', largeCsvContent, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.file_size).toBeGreaterThan(100000); // Should be substantial size
    });

    it('should reject non-CSV files', async () => {
      const textContent = 'This is not a CSV file';
      const blob = new Blob([textContent], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, 'test.txt');

      const response = await fetchAsUser('/api/list_cutter/upload', {
        method: 'POST',
        body: formData,
      }, testUserCredentials.username);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid file type');
    });

    it('should reject files that are too large', async () => {
      // Create a file larger than the limit (assuming 50MB limit)
      const oversizedContent = 'x'.repeat(60 * 1024 * 1024); // 60MB
      const blob = new Blob([oversizedContent], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'oversized.csv');

      const response = await fetchAsUser('/api/list_cutter/upload', {
        method: 'POST',
        body: formData,
      }, testUserCredentials.username);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('File too large');
    });

    it('should reject upload without file', async () => {
      const formData = new FormData();
      // No file attached

      const response = await fetchAsUser('/api/list_cutter/upload', {
        method: 'POST',
        body: formData,
      }, testUserCredentials.username);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('No file provided');
    });

    it('should reject unauthorized upload', async () => {
      const csvContent = 'name,age\nJohn,25';
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'test.csv');

      const response = await fetch('http://localhost:8787/api/list_cutter/upload', {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authorization required');
    });

    it('should handle special characters in filename', async () => {
      const csvContent = 'name,age\nJohn,25';
      const specialFilename = 'test file (1) - données.csv';
      const response = await uploadTestFile(specialFilename, csvContent, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.filename).toBe(specialFilename);
    });

    it('should validate CSV format', async () => {
      const malformedCsv = 'name,age\n"John,25\nJane",30'; // Malformed quotes
      const response = await uploadTestFile('malformed.csv', malformedCsv, testUserCredentials.username);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid CSV format');
    });
  });

  describe('GET /api/list_cutter/list_saved_files', () => {
    beforeEach(async () => {
      // Upload some test files
      await uploadTestFile('file1.csv', 'name,age\nJohn,25', testUserCredentials.username);
      await uploadTestFile('file2.csv', 'product,price\nLaptop,1000', testUserCredentials.username);
      await uploadTestFile('file3.csv', 'city,population\nNYC,8000000', testUserCredentials.username);
    });

    it('should list user files', async () => {
      const response = await fetchAsUser('/api/list_cutter/list_saved_files', {
        method: 'GET',
      }, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.files).toBeDefined();
      expect(Array.isArray(data.files)).toBe(true);
      expect(data.files.length).toBeGreaterThanOrEqual(3);

      // Check file structure
      data.files.forEach((file: any) => {
        expect(file).toMatchObject({
          id: expect.any(String),
          filename: expect.any(String),
          file_size: expect.any(Number),
          upload_time: expect.any(String),
        });
        expect(file.id).toBeValidUUID();
      });
    });

    it('should return empty array for user with no files', async () => {
      // Create a new user with no files
      const newUserCreds = {
        username: `nofiles_${Date.now()}`,
        email: `nofiles_${Date.now()}@example.com`,
        password: 'testpass123',
      };
      
      await createTestUser(newUserCreds.username, newUserCreds.email, newUserCreds.password);

      const response = await fetchAsUser('/api/list_cutter/list_saved_files', {
        method: 'GET',
      }, newUserCreds.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.files).toEqual([]);
    });

    it('should paginate results when many files exist', async () => {
      // Upload many files
      const uploadPromises = Array.from({ length: 50 }, (_, i) =>
        uploadTestFile(`bulk_file_${i}.csv`, `id,value\n${i},${i * 10}`, testUserCredentials.username)
      );
      await Promise.all(uploadPromises);

      const response = await fetchAsUser('/api/list_cutter/list_saved_files?limit=20&offset=0', {
        method: 'GET',
      }, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.files.length).toBeLessThanOrEqual(20);
      expect(data.total_count).toBeGreaterThan(50);
      expect(data.has_more).toBe(true);
    });

    it('should reject unauthorized request', async () => {
      const response = await fetch('http://localhost:8787/api/list_cutter/list_saved_files', {
        method: 'GET',
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authorization required');
    });

    it('should sort files by upload time (newest first)', async () => {
      const response = await fetchAsUser('/api/list_cutter/list_saved_files', {
        method: 'GET',
      }, testUserCredentials.username);

      const data = await response.json();
      expect(data.success).toBe(true);
      
      if (data.files.length > 1) {
        const uploadTimes = data.files.map((f: any) => new Date(f.upload_time).getTime());
        const sortedTimes = [...uploadTimes].sort((a, b) => b - a);
        expect(uploadTimes).toEqual(sortedTimes);
      }
    });
  });

  describe('GET /api/list_cutter/fetch_saved_file/:fileId', () => {
    let testFileId: string;

    beforeEach(async () => {
      // Upload a test file
      const csvContent = 'name,age,city\nJohn,25,NYC\nJane,30,LA\nBob,35,Chicago';
      const uploadResponse = await uploadTestFile('fetch_test.csv', csvContent, testUserCredentials.username);
      const uploadData = await uploadResponse.json();
      testFileId = uploadData.file_id;
    });

    it('should fetch file details successfully', async () => {
      const response = await fetchAsUser(`/api/list_cutter/fetch_saved_file/${testFileId}`, {
        method: 'GET',
      }, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        file: {
          id: testFileId,
          filename: 'fetch_test.csv',
          file_size: expect.any(Number),
          upload_time: expect.any(String),
        },
      });
      
      expect(data.file.columns).toBeDefined();
      expect(Array.isArray(data.file.columns)).toBe(true);
      expect(data.file.columns).toEqual(['name', 'age', 'city']);
      expect(data.file.preview).toBeDefined();
      expect(Array.isArray(data.file.preview)).toBe(true);
    });

    it('should return 404 for non-existent file', async () => {
      const fakeFileId = '00000000-0000-0000-0000-000000000000';
      const response = await fetchAsUser(`/api/list_cutter/fetch_saved_file/${fakeFileId}`, {
        method: 'GET',
      }, testUserCredentials.username);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('File not found');
    });

    it('should reject access to other user\'s files', async () => {
      // Create another user
      const otherUserCreds = {
        username: `otheruser_${Date.now()}`,
        email: `otheruser_${Date.now()}@example.com`,
        password: 'testpass123',
      };
      
      await createTestUser(otherUserCreds.username, otherUserCreds.email, otherUserCreds.password);

      const response = await fetchAsUser(`/api/list_cutter/fetch_saved_file/${testFileId}`, {
        method: 'GET',
      }, otherUserCreds.username);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Access denied');
    });

    it('should validate file ID format', async () => {
      const invalidFileIds = [
        'invalid-id',
        '123',
        'not-a-uuid',
        '',
      ];

      for (const invalidId of invalidFileIds) {
        const response = await fetchAsUser(`/api/list_cutter/fetch_saved_file/${invalidId}`, {
          method: 'GET',
        }, testUserCredentials.username);

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid file ID');
      }
    });
  });

  describe('PATCH /api/list_cutter/update_tags/:fileId', () => {
    let testFileId: string;

    beforeEach(async () => {
      // Upload a test file
      const csvContent = 'name,age\nJohn,25\nJane,30';
      const uploadResponse = await uploadTestFile('tags_test.csv', csvContent, testUserCredentials.username);
      const uploadData = await uploadResponse.json();
      testFileId = uploadData.file_id;
    });

    it('should update file tags successfully', async () => {
      const tags = ['important', 'customers', 'q4-2024'];
      const response = await fetchAsUser(`/api/list_cutter/update_tags/${testFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      }, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        file: {
          id: testFileId,
          tags: tags,
        },
      });
    });

    it('should handle empty tags array', async () => {
      const response = await fetchAsUser(`/api/list_cutter/update_tags/${testFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [] }),
      }, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.file.tags).toEqual([]);
    });

    it('should validate tags format', async () => {
      const invalidTagsRequests = [
        { tags: 'not-an-array' },
        { tags: [123, 'valid-tag'] }, // Mixed types
        { tags: [''] }, // Empty string tag
        { tags: [null, 'valid-tag'] }, // Null tag
      ];

      for (const invalidRequest of invalidTagsRequests) {
        const response = await fetchAsUser(`/api/list_cutter/update_tags/${testFileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        }, testUserCredentials.username);

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid tags');
      }
    });

    it('should limit tag length and count', async () => {
      // Test too many tags
      const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      const response1 = await fetchAsUser(`/api/list_cutter/update_tags/${testFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tooManyTags }),
      }, testUserCredentials.username);

      expect(response1.status).toBe(400);

      // Test too long tag
      const tooLongTag = 'x'.repeat(101); // Assuming 100 char limit
      const response2 = await fetchAsUser(`/api/list_cutter/update_tags/${testFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [tooLongTag] }),
      }, testUserCredentials.username);

      expect(response2.status).toBe(400);
    });
  });

  describe('DELETE /api/list_cutter/delete/:fileId', () => {
    let testFileId: string;

    beforeEach(async () => {
      // Upload a test file
      const csvContent = 'name,age\nJohn,25\nJane,30';
      const uploadResponse = await uploadTestFile('delete_test.csv', csvContent, testUserCredentials.username);
      const uploadData = await uploadResponse.json();
      testFileId = uploadData.file_id;
    });

    it('should delete file successfully', async () => {
      const response = await fetchAsUser(`/api/list_cutter/delete/${testFileId}`, {
        method: 'DELETE',
      }, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        message: 'File deleted successfully',
      });

      // Verify file is actually deleted
      const fetchResponse = await fetchAsUser(`/api/list_cutter/fetch_saved_file/${testFileId}`, {
        method: 'GET',
      }, testUserCredentials.username);

      expect(fetchResponse.status).toBe(404);
    });

    it('should return 404 for non-existent file', async () => {
      const fakeFileId = '00000000-0000-0000-0000-000000000000';
      const response = await fetchAsUser(`/api/list_cutter/delete/${fakeFileId}`, {
        method: 'DELETE',
      }, testUserCredentials.username);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('File not found');
    });

    it('should reject deletion of other user\'s files', async () => {
      // Create another user
      const otherUserCreds = {
        username: `deleteother_${Date.now()}`,
        email: `deleteother_${Date.now()}@example.com`,
        password: 'testpass123',
      };
      
      await createTestUser(otherUserCreds.username, otherUserCreds.email, otherUserCreds.password);

      const response = await fetchAsUser(`/api/list_cutter/delete/${testFileId}`, {
        method: 'DELETE',
      }, otherUserCreds.username);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Access denied');
    });
  });

  describe('File Processing Integration', () => {
    let testFileId: string;

    beforeEach(async () => {
      // Upload a test file with more data for processing
      const csvContent = generateCSVData(100); // 100 rows
      const uploadResponse = await uploadTestFile('process_test.csv', csvContent, testUserCredentials.username);
      const uploadData = await uploadResponse.json();
      testFileId = uploadData.file_id;
    });

    it('should handle complete file lifecycle', async () => {
      // 1. Upload (already done in beforeEach)
      // 2. List files
      const listResponse = await fetchAsUser('/api/list_cutter/list_saved_files', {
        method: 'GET',
      }, testUserCredentials.username);
      
      expect(listResponse.status).toBe(200);
      const listData = await listResponse.json();
      expect(listData.files.some((f: any) => f.id === testFileId)).toBe(true);

      // 3. Fetch file details
      const fetchResponse = await fetchAsUser(`/api/list_cutter/fetch_saved_file/${testFileId}`, {
        method: 'GET',
      }, testUserCredentials.username);
      
      expect(fetchResponse.status).toBe(200);
      const fetchData = await fetchResponse.json();
      expect(fetchData.file.id).toBe(testFileId);

      // 4. Update tags
      const updateResponse = await fetchAsUser(`/api/list_cutter/update_tags/${testFileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['integration-test'] }),
      }, testUserCredentials.username);
      
      expect(updateResponse.status).toBe(200);

      // 5. Delete
      const deleteResponse = await fetchAsUser(`/api/list_cutter/delete/${testFileId}`, {
        method: 'DELETE',
      }, testUserCredentials.username);
      
      expect(deleteResponse.status).toBe(200);

      // 6. Verify deletion
      const verifyResponse = await fetchAsUser(`/api/list_cutter/fetch_saved_file/${testFileId}`, {
        method: 'GET',
      }, testUserCredentials.username);
      
      expect(verifyResponse.status).toBe(404);
    });

    it('should maintain data consistency across operations', async () => {
      // Upload multiple files and perform operations
      const fileIds: string[] = [];
      
      for (let i = 0; i < 5; i++) {
        const content = `id,name,value\n${i},Item${i},${i * 10}`;
        const uploadResponse = await uploadTestFile(`consistency_${i}.csv`, content, testUserCredentials.username);
        const uploadData = await uploadResponse.json();
        fileIds.push(uploadData.file_id);
      }

      // Verify all files exist
      const listResponse = await fetchAsUser('/api/list_cutter/list_saved_files', {
        method: 'GET',
      }, testUserCredentials.username);
      
      const listData = await listResponse.json();
      const existingFileIds = listData.files.map((f: any) => f.id);
      
      fileIds.forEach(fileId => {
        expect(existingFileIds).toContain(fileId);
      });

      // Delete some files
      for (let i = 0; i < 3; i++) {
        await fetchAsUser(`/api/list_cutter/delete/${fileIds[i]}`, {
          method: 'DELETE',
        }, testUserCredentials.username);
      }

      // Verify correct files were deleted
      const finalListResponse = await fetchAsUser('/api/list_cutter/list_saved_files', {
        method: 'GET',
      }, testUserCredentials.username);
      
      const finalListData = await finalListResponse.json();
      const finalFileIds = finalListData.files.map((f: any) => f.id);
      
      // First 3 should be deleted, last 2 should remain
      expect(finalFileIds).not.toContain(fileIds[0]);
      expect(finalFileIds).not.toContain(fileIds[1]);
      expect(finalFileIds).not.toContain(fileIds[2]);
      expect(finalFileIds).toContain(fileIds[3]);
      expect(finalFileIds).toContain(fileIds[4]);
    });
  });
});
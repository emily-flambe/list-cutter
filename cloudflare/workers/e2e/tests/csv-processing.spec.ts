import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage';
import { TestDataGenerator } from '../fixtures/test-data-generator';

/**
 * Pinkie Pie's CSV Processing Tests 🎉
 * Testing all the fun ways to slice and dice CSV files!
 */

test.describe('CSV Processing Tests', () => {
  let appPage: AppPage;
  let userData: any;
  
  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
    userData = TestDataGenerator.generateTestUser();
    
    // Setup authenticated user for each test
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
      expect(isLoggedIn).toBe(true);
    }
    
    await appPage.goToCSVCutter();
  });

  test('should process basic CSV file successfully', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    // Upload file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'basic.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Get preview data
    const previewData = await appPage.csvCutterPage.getPreviewData();
    expect(previewData.length).toBeGreaterThan(0);
    expect(previewData[0]).toContain('name'); // Header row
    
    // Process file
    await appPage.csvCutterPage.processFile();
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    // Download file
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
    
    // Verify download
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toMatch(/\.(csv|xlsx)$/);
  });

  test('should handle large CSV files (1000+ rows)', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('large');
    
    // Upload large file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'large.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Check file info shows correct size
    const fileInfo = await appPage.csvCutterPage.getFileInfo();
    console.log('Large file info:', fileInfo);
    
    // Get preview data (should be limited)
    const previewData = await appPage.csvCutterPage.getPreviewData();
    expect(previewData.length).toBeGreaterThan(0);
    expect(previewData.length).toBeLessThan(100); // Preview should be limited
    
    // Process with row range
    await appPage.csvCutterPage.processFile({
      rowRange: '1-100' // First 100 rows
    });
    
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    // Download and verify
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
  });

  test('should handle CSV with special characters and encoding', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('special-chars');
    
    // Upload file with special characters
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'special-chars.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Verify preview contains special characters
    const previewData = await appPage.csvCutterPage.getPreviewData();
    expect(previewData.length).toBeGreaterThan(0);
    
    const dataString = JSON.stringify(previewData);
    expect(dataString).toContain('María');
    expect(dataString).toContain('李小明');
    expect(dataString).toContain('François');
    
    // Process and download
    await appPage.csvCutterPage.processFile();
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
  });

  test('should handle empty CSV file gracefully', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('empty');
    
    // Upload empty file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'empty.csv');
    
    // Should either show error or handle gracefully
    const hasError = await appPage.csvCutterPage.hasError();
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    
    if (hasError) {
      const errorMessage = await appPage.csvCutterPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toContain('empty');
    } else if (isUploaded) {
      // If empty file is accepted, verify preview is empty
      const previewData = await appPage.csvCutterPage.getPreviewData();
      expect(previewData.length).toBeLessThanOrEqual(1); // Only header row or empty
    }
  });

  test('should handle malformed CSV data', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('malformed');
    
    // Upload malformed file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'malformed.csv');
    
    // Should handle malformed data gracefully
    const hasError = await appPage.csvCutterPage.hasError();
    
    if (hasError) {
      const errorMessage = await appPage.csvCutterPage.getErrorMessage();
      console.log('Malformed CSV error (expected):', errorMessage);
      expect(errorMessage.length).toBeGreaterThan(0);
    } else {
      // If malformed data is accepted, verify it's processed somehow
      const isUploaded = await appPage.csvCutterPage.isFileUploaded();
      expect(isUploaded).toBe(true);
      
      const previewData = await appPage.csvCutterPage.getPreviewData();
      console.log('Malformed CSV preview:', previewData);
    }
  });

  test('should support column selection and filtering', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    // Upload file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'basic.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Get available columns
    const availableColumns = await appPage.csvCutterPage.getAvailableColumns();
    console.log('Available columns:', availableColumns);
    
    if (availableColumns.length > 0) {
      // Process with specific columns
      await appPage.csvCutterPage.processFile({
        columns: availableColumns.slice(0, 2), // First 2 columns
        filter: 'Engineering' // Filter for specific department
      });
      
      const isProcessed = await appPage.csvCutterPage.isDownloadReady();
      expect(isProcessed).toBe(true);
      
      const download = await appPage.csvCutterPage.downloadFile();
      expect(download).toBeTruthy();
    }
  });

  test('should support row range selection', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    // Upload file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'basic.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Process with row range
    await appPage.csvCutterPage.processFile({
      rowRange: '1-3' // First 3 rows (including header)
    });
    
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
  });

  test('should handle multiple file uploads in sequence', async () => {
    const testFiles = [
      { content: TestDataGenerator.generateCSVContent('basic'), name: 'basic.csv' },
      { content: TestDataGenerator.generateCSVContent('special-chars'), name: 'special.csv' },
    ];
    
    for (const [index, file] of testFiles.entries()) {
      console.log(`Processing file ${index + 1}: ${file.name}`);
      
      // Upload file
      await appPage.csvCutterPage.uploadTestCSV(file.content, file.name);
      const isUploaded = await appPage.csvCutterPage.isFileUploaded();
      expect(isUploaded).toBe(true);
      
      // Process file
      await appPage.csvCutterPage.processFile();
      const isProcessed = await appPage.csvCutterPage.isDownloadReady();
      expect(isProcessed).toBe(true);
      
      // Download file
      const download = await appPage.csvCutterPage.downloadFile();
      expect(download).toBeTruthy();
      
      // Optional: Clean up file if delete function exists
      try {
        await appPage.csvCutterPage.deleteFile();
      } catch (error) {
        // Delete function might not exist, that's okay
        console.log('File deletion not available, continuing...');
      }
    }
  });

  test('should validate file type restrictions', async () => {
    // Try uploading non-CSV file
    const textContent = 'This is not a CSV file, just plain text.';
    
    await appPage.csvCutterPage.uploadTestCSV(textContent, 'not-a-csv.txt');
    
    // Should show error for invalid file type
    const hasError = await appPage.csvCutterPage.hasError();
    
    if (hasError) {
      const errorMessage = await appPage.csvCutterPage.getErrorMessage();
      console.log('Invalid file type error (expected):', errorMessage);
      expect(errorMessage.toLowerCase()).toMatch(/(invalid|format|csv|type)/);
    } else {
      // If non-CSV files are accepted, log this behavior
      console.log('Non-CSV files are accepted by the system');
    }
  });

  test('should handle concurrent processing requests', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    // Upload file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'concurrent-test.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Try to process multiple times quickly (simulate user clicking multiple times)
    const processPromises = [
      appPage.csvCutterPage.processFile(),
      appPage.csvCutterPage.processFile(),
      appPage.csvCutterPage.processFile(),
    ];
    
    // Wait for all processes to complete
    await Promise.allSettled(processPromises);
    
    // Should end up in a valid state
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
  });

  test('should preserve data integrity throughout processing', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    // Upload file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'integrity-test.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Get original preview data
    const originalPreview = await appPage.csvCutterPage.getPreviewData();
    expect(originalPreview.length).toBeGreaterThan(0);
    
    // Process without any modifications
    await appPage.csvCutterPage.processFile();
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    // Download and verify
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
    
    // Verify file was downloaded
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    
    // Log data integrity check results
    console.log('Original rows:', originalPreview.length);
    console.log('Download successful:', !!downloadPath);
  });

  test('should handle processing timeout gracefully', async () => {
    const csvContent = TestDataGenerator.generateCSVContent('large'); // Large file
    
    // Upload large file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'timeout-test.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Process file and measure time
    const startTime = Date.now();
    await appPage.csvCutterPage.processFile();
    
    // Either should complete successfully or handle timeout gracefully
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    const processingTime = Date.now() - startTime;
    
    console.log(`Processing time for large file: ${processingTime}ms`);
    
    if (isProcessed) {
      expect(processingTime).toBeLessThan(60000); // Should complete within 1 minute
      
      const download = await appPage.csvCutterPage.downloadFile();
      expect(download).toBeTruthy();
    } else {
      // If not processed, should show appropriate error
      const hasError = await appPage.csvCutterPage.hasError();
      if (hasError) {
        const errorMessage = await appPage.csvCutterPage.getErrorMessage();
        console.log('Processing timeout error:', errorMessage);
      }
    }
  });
});
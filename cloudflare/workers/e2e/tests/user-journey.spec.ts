import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage';
import { TestDataGenerator } from '../fixtures/test-data-generator';

/**
 * Pinkie Pie's Complete User Journey Tests 🎉
 * Testing the full party experience from invitation to celebration!
 */

test.describe('Complete User Journey Tests', () => {
  let appPage: AppPage;
  
  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
  });

  test('complete user journey: register → login → upload → process → download', async () => {
    const userData = TestDataGenerator.generateTestUser();
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    // Perform complete user journey
    const result = await appPage.performCompleteUserJourney(userData, csvContent);
    
    // Verify each step succeeded
    expect(result.registered).toBe(true);
    expect(result.loggedIn).toBe(true);
    expect(result.fileUploaded).toBe(true);
    expect(result.fileProcessed).toBe(true);
    expect(result.fileDownloaded).toBe(true);
  });

  test('user journey with large CSV file', async () => {
    const userData = TestDataGenerator.generateTestUser();
    const csvContent = TestDataGenerator.generateCSVContent('large'); // 1000 rows
    
    // Register user
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    // Login if not automatically logged in
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
      expect(isLoggedIn).toBe(true);
    }
    
    // Navigate to CSV cutter
    await appPage.goToCSVCutter();
    await appPage.csvCutterPage.waitForUploadReady();
    
    // Upload large file
    await appPage.csvCutterPage.uploadTestCSV(csvContent, 'large-test.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Get file info to verify size
    const fileInfo = await appPage.csvCutterPage.getFileInfo();
    console.log('Large file info:', fileInfo);
    
    // Process the file
    await appPage.csvCutterPage.processFile();
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    // Download the processed file
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
    
    // Verify download
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
  });

  test('user journey with special characters in CSV', async () => {
    const userData = TestDataGenerator.generateTestUser();
    const csvContent = TestDataGenerator.generateCSVContent('special-chars');
    
    // Complete the journey
    const result = await appPage.performCompleteUserJourney(userData, csvContent);
    
    expect(result.registered).toBe(true);
    expect(result.loggedIn).toBe(true);
    expect(result.fileUploaded).toBe(true);
    expect(result.fileProcessed).toBe(true);
    expect(result.fileDownloaded).toBe(true);
    
    // Verify preview data contains special characters
    const previewData = await appPage.csvCutterPage.getPreviewData();
    expect(previewData.length).toBeGreaterThan(0);
    
    // Check that special characters are preserved
    const dataString = JSON.stringify(previewData);
    expect(dataString).toContain('María');
    expect(dataString).toContain('李小明');
    expect(dataString).toContain('François');
  });

  test('user journey with multiple file uploads', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
      expect(isLoggedIn).toBe(true);
    }
    
    await appPage.goToCSVCutter();
    
    // Upload first file
    const csvContent1 = TestDataGenerator.generateCSVContent('basic');
    await appPage.csvCutterPage.uploadTestCSV(csvContent1, 'file1.csv');
    let isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Process and download first file
    await appPage.csvCutterPage.processFile();
    let isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    const download1 = await appPage.csvCutterPage.downloadFile();
    expect(download1).toBeTruthy();
    
    // Upload second file
    const csvContent2 = TestDataGenerator.generateCSVContent('special-chars');
    await appPage.csvCutterPage.uploadTestCSV(csvContent2, 'file2.csv');
    isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Process and download second file
    await appPage.csvCutterPage.processFile();
    isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    const download2 = await appPage.csvCutterPage.downloadFile();
    expect(download2).toBeTruthy();
  });

  test('user journey with column selection and filtering', async () => {
    const userData = TestDataGenerator.generateTestUser();
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    // Register and login
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
      expect(isLoggedIn).toBe(true);
    }
    
    // Navigate and upload
    await appPage.goToCSVCutter();
    await appPage.csvCutterPage.uploadTestCSV(csvContent);
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Get available columns
    const availableColumns = await appPage.csvCutterPage.getAvailableColumns();
    console.log('Available columns:', availableColumns);
    
    // Process with specific options
    await appPage.csvCutterPage.processFile({
      columns: availableColumns.slice(0, 2), // Select first 2 columns
      rowRange: '1-5', // First 5 rows
      filter: 'Engineering' // Filter for engineering department
    });
    
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    // Download and verify
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
  });

  test('user journey with session persistence across page navigation', async () => {
    const userData = TestDataGenerator.generateTestUser();
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    // Register and login
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
      expect(isLoggedIn).toBe(true);
    }
    
    // Navigate to different pages and verify session persistence
    await appPage.goto(); // Home page
    expect(await appPage.isLoggedIn()).toBe(true);
    
    await appPage.goToCSVCutter();
    expect(await appPage.isLoggedIn()).toBe(true);
    
    // Upload and start processing
    await appPage.csvCutterPage.uploadTestCSV(csvContent);
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Navigate away and back
    await appPage.goto();
    await appPage.goToCSVCutter();
    
    // Should still be logged in
    expect(await appPage.isLoggedIn()).toBe(true);
    
    // Complete the process
    await appPage.csvCutterPage.processFile();
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
  });

  test('user journey with error recovery', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
      expect(isLoggedIn).toBe(true);
    }
    
    await appPage.goToCSVCutter();
    
    // Try uploading an invalid file first
    const invalidContent = TestDataGenerator.generateCSVContent('malformed');
    await appPage.csvCutterPage.uploadTestCSV(invalidContent, 'invalid.csv');
    
    // Check if error is handled gracefully
    const hasError = await appPage.csvCutterPage.hasError();
    if (hasError) {
      const errorMessage = await appPage.csvCutterPage.getErrorMessage();
      console.log('Expected error for malformed CSV:', errorMessage);
    }
    
    // Now upload a valid file
    const validContent = TestDataGenerator.generateCSVContent('basic');
    await appPage.csvCutterPage.uploadTestCSV(validContent, 'valid.csv');
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    expect(isUploaded).toBe(true);
    
    // Complete the process
    await appPage.csvCutterPage.processFile();
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    expect(isProcessed).toBe(true);
    
    const download = await appPage.csvCutterPage.downloadFile();
    expect(download).toBeTruthy();
  });

  test('user journey performance with timing measurements', async () => {
    const userData = TestDataGenerator.generateTestUser();
    const csvContent = TestDataGenerator.generateCSVContent('basic');
    
    const timings: { [key: string]: number } = {};
    
    // Measure registration time
    const regStart = Date.now();
    const isRegistered = await appPage.performRegistration(userData);
    timings.registration = Date.now() - regStart;
    expect(isRegistered).toBe(true);
    
    // Measure login time
    const loginStart = Date.now();
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
    }
    timings.login = Date.now() - loginStart;
    expect(isLoggedIn).toBe(true);
    
    // Measure navigation time
    const navStart = Date.now();
    await appPage.goToCSVCutter();
    timings.navigation = Date.now() - navStart;
    
    // Measure upload time
    const uploadStart = Date.now();
    await appPage.csvCutterPage.uploadTestCSV(csvContent);
    const isUploaded = await appPage.csvCutterPage.isFileUploaded();
    timings.upload = Date.now() - uploadStart;
    expect(isUploaded).toBe(true);
    
    // Measure processing time
    const processStart = Date.now();
    await appPage.csvCutterPage.processFile();
    const isProcessed = await appPage.csvCutterPage.isDownloadReady();
    timings.processing = Date.now() - processStart;
    expect(isProcessed).toBe(true);
    
    // Measure download time
    const downloadStart = Date.now();
    const download = await appPage.csvCutterPage.downloadFile();
    timings.download = Date.now() - downloadStart;
    expect(download).toBeTruthy();
    
    // Log performance metrics
    console.log('🎉 User Journey Performance Metrics:');
    console.log(`Registration: ${timings.registration}ms`);
    console.log(`Login: ${timings.login}ms`);
    console.log(`Navigation: ${timings.navigation}ms`);
    console.log(`Upload: ${timings.upload}ms`);
    console.log(`Processing: ${timings.processing}ms`);
    console.log(`Download: ${timings.download}ms`);
    console.log(`Total: ${Object.values(timings).reduce((a, b) => a + b, 0)}ms`);
    
    // Assert reasonable performance thresholds
    expect(timings.registration).toBeLessThan(10000); // 10 seconds
    expect(timings.login).toBeLessThan(5000); // 5 seconds
    expect(timings.navigation).toBeLessThan(3000); // 3 seconds
    expect(timings.upload).toBeLessThan(10000); // 10 seconds
    expect(timings.processing).toBeLessThan(15000); // 15 seconds
    expect(timings.download).toBeLessThan(5000); // 5 seconds
  });
});
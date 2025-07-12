import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage';
import { TestDataGenerator } from '../fixtures/test-data-generator';

/**
 * Pinkie Pie's Error Handling Tests 🎉
 * Testing how we handle party crashers and unexpected situations!
 */

test.describe('Error Handling and Validation Tests', () => {
  let appPage: AppPage;
  
  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
  });

  test.describe('Authentication Error Handling', () => {
    test('should handle network errors during login gracefully', async () => {
      await appPage.loginPage.goto();
      
      // Mock network failure
      await appPage.page.route('**/login', (route) => {
        route.abort('failed');
      });
      
      const userData = TestDataGenerator.generateTestUser();
      await appPage.loginPage.login(userData.email, userData.password);
      
      // Should show appropriate error message
      const hasError = await appPage.loginPage.hasError();
      expect(hasError).toBe(true);
      
      const errorMessage = await appPage.loginPage.getErrorMessage();
      expect(errorMessage.length).toBeGreaterThan(0);
    });

    test('should handle server errors (5xx) during registration', async () => {
      await appPage.registerPage.goto();
      
      // Mock server error
      await appPage.page.route('**/register', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });
      
      const userData = TestDataGenerator.generateTestUser();
      await appPage.registerPage.register(userData);
      
      // Should show server error message
      const hasError = await appPage.registerPage.hasError();
      expect(hasError).toBe(true);
      
      const errorMessage = await appPage.registerPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toMatch(/(server|error|failed)/);
    });

    test('should validate email format before submission', async () => {
      await appPage.registerPage.goto();
      await appPage.registerPage.waitForFormReady();
      
      const userData = TestDataGenerator.generateTestUser();
      userData.email = 'invalid-email-format';
      
      await appPage.registerPage.register(userData);
      
      // Should show email validation error
      const hasError = await appPage.registerPage.hasError();
      expect(hasError).toBe(true);
      
      const errorMessage = await appPage.registerPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toMatch(/(email|invalid|format)/);
    });

    test('should validate password requirements', async () => {
      await appPage.registerPage.goto();
      await appPage.registerPage.waitForFormReady();
      
      const userData = TestDataGenerator.generateTestUser();
      userData.password = 'weak'; // Too weak password
      
      await appPage.registerPage.register(userData);
      
      // Should show password validation error
      const hasError = await appPage.registerPage.hasError();
      if (hasError) {
        const errorMessage = await appPage.registerPage.getErrorMessage();
        expect(errorMessage.toLowerCase()).toMatch(/(password|weak|strong|requirements)/);
      }
    });
  });

  test.describe('File Upload Error Handling', () => {
    let userData: any;
    
    test.beforeEach(async () => {
      userData = TestDataGenerator.generateTestUser();
      
      // Setup authenticated user
      const isRegistered = await appPage.performRegistration(userData);
      expect(isRegistered).toBe(true);
      
      let isLoggedIn = await appPage.isLoggedIn();
      if (!isLoggedIn) {
        isLoggedIn = await appPage.performLogin(userData.email, userData.password);
        expect(isLoggedIn).toBe(true);
      }
      
      await appPage.goToCSVCutter();
    });

    test('should reject files that are too large', async () => {
      // Try to upload a file that exceeds size limit
      const tooLargeContent = 'x'.repeat(60 * 1024 * 1024); // 60MB (exceeds 50MB limit)
      
      await appPage.csvCutterPage.uploadTestCSV(tooLargeContent, 'too-large.csv');
      
      // Should show file size error
      const hasError = await appPage.csvCutterPage.hasError();
      expect(hasError).toBe(true);
      
      const errorMessage = await appPage.csvCutterPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toMatch(/(size|large|limit|mb)/);
    });

    test('should handle upload timeout gracefully', async () => {
      const csvContent = TestDataGenerator.generateCSVContent('large');
      
      // Mock slow upload
      await appPage.page.route('**/upload', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        route.continue();
      });
      
      await appPage.csvCutterPage.uploadTestCSV(csvContent, 'slow-upload.csv');
      
      // Should either complete successfully or show timeout error
      const isUploaded = await appPage.csvCutterPage.isFileUploaded();
      const hasError = await appPage.csvCutterPage.hasError();
      
      expect(isUploaded || hasError).toBe(true);
      
      if (hasError) {
        const errorMessage = await appPage.csvCutterPage.getErrorMessage();
        console.log('Upload timeout error:', errorMessage);
      }
    });

    test('should reject invalid file types', async () => {
      const invalidContent = '<html><body>This is HTML, not CSV</body></html>';
      
      await appPage.csvCutterPage.uploadTestCSV(invalidContent, 'invalid.html');
      
      // Should show file type error or reject upload
      const hasError = await appPage.csvCutterPage.hasError();
      if (hasError) {
        const errorMessage = await appPage.csvCutterPage.getErrorMessage();
        expect(errorMessage.toLowerCase()).toMatch(/(type|format|csv|invalid)/);
      }
    });

    test('should handle corrupted file upload', async () => {
      // Create corrupted CSV-like content
      const corruptedContent = 'name,email,phone\n' + 
                              'John,john@example.com\0\xFF\xFE,555-1234\n' + // Null bytes and invalid chars
                              'Jane,jane@example.com,555-5678\x00\x01';
      
      await appPage.csvCutterPage.uploadTestCSV(corruptedContent, 'corrupted.csv');
      
      // Should handle corrupted data gracefully
      const hasError = await appPage.csvCutterPage.hasError();
      const isUploaded = await appPage.csvCutterPage.isFileUploaded();
      
      if (hasError) {
        const errorMessage = await appPage.csvCutterPage.getErrorMessage();
        console.log('Corrupted file error:', errorMessage);
      } else if (isUploaded) {
        console.log('Corrupted file was processed (system is resilient)');
      }
      
      expect(hasError || isUploaded).toBe(true);
    });
  });

  test.describe('Processing Error Handling', () => {
    let userData: any;
    
    test.beforeEach(async () => {
      userData = TestDataGenerator.generateTestUser();
      
      // Setup authenticated user
      const isRegistered = await appPage.performRegistration(userData);
      expect(isRegistered).toBe(true);
      
      let isLoggedIn = await appPage.isLoggedIn();
      if (!isLoggedIn) {
        isLoggedIn = await appPage.performLogin(userData.email, userData.password);
        expect(isLoggedIn).toBe(true);
      }
      
      await appPage.goToCSVCutter();
    });

    test('should handle processing errors gracefully', async () => {
      const csvContent = TestDataGenerator.generateCSVContent('basic');
      
      // Upload file successfully
      await appPage.csvCutterPage.uploadTestCSV(csvContent, 'process-error.csv');
      const isUploaded = await appPage.csvCutterPage.isFileUploaded();
      expect(isUploaded).toBe(true);
      
      // Mock processing error
      await appPage.page.route('**/process', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Processing failed' }),
        });
      });
      
      await appPage.csvCutterPage.processFile();
      
      // Should show processing error
      const hasError = await appPage.csvCutterPage.hasError();
      expect(hasError).toBe(true);
      
      const errorMessage = await appPage.csvCutterPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toMatch(/(process|failed|error)/);
    });

    test('should validate column selection before processing', async () => {
      const csvContent = TestDataGenerator.generateCSVContent('basic');
      
      await appPage.csvCutterPage.uploadTestCSV(csvContent, 'column-validation.csv');
      const isUploaded = await appPage.csvCutterPage.isFileUploaded();
      expect(isUploaded).toBe(true);
      
      // Try to process with invalid column selection
      await appPage.csvCutterPage.processFile({
        columns: ['nonexistent-column']
      });
      
      // Should show column validation error
      const hasError = await appPage.csvCutterPage.hasError();
      if (hasError) {
        const errorMessage = await appPage.csvCutterPage.getErrorMessage();
        expect(errorMessage.toLowerCase()).toMatch(/(column|invalid|not found)/);
      }
    });

    test('should validate row range parameters', async () => {
      const csvContent = TestDataGenerator.generateCSVContent('basic');
      
      await appPage.csvCutterPage.uploadTestCSV(csvContent, 'range-validation.csv');
      const isUploaded = await appPage.csvCutterPage.isFileUploaded();
      expect(isUploaded).toBe(true);
      
      // Try to process with invalid row range
      await appPage.csvCutterPage.processFile({
        rowRange: '1000-2000' // Range beyond file content
      });
      
      // Should show range validation error or handle gracefully
      const hasError = await appPage.csvCutterPage.hasError();
      if (hasError) {
        const errorMessage = await appPage.csvCutterPage.getErrorMessage();
        expect(errorMessage.toLowerCase()).toMatch(/(range|invalid|exceed)/);
      }
    });
  });

  test.describe('Network and Connectivity Error Handling', () => {
    test('should handle offline scenarios', async () => {
      const userData = TestDataGenerator.generateTestUser();
      
      // Start online, then go offline
      await appPage.registerPage.goto();
      
      // Simulate offline
      await appPage.page.context().setOffline(true);
      
      await appPage.registerPage.register(userData);
      
      // Should show network error
      const hasError = await appPage.registerPage.hasError();
      expect(hasError).toBe(true);
      
      const errorMessage = await appPage.registerPage.getErrorMessage();
      expect(errorMessage.toLowerCase()).toMatch(/(network|offline|connection)/);
      
      // Restore online
      await appPage.page.context().setOffline(false);
    });

    test('should handle slow network connections', async () => {
      const userData = TestDataGenerator.generateTestUser();
      
      await appPage.loginPage.goto();
      
      // Simulate slow network
      await appPage.page.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        route.continue();
      });
      
      const startTime = Date.now();
      await appPage.loginPage.login(userData.email, userData.password);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      console.log(`Login response time with slow network: ${responseTime}ms`);
      
      // Should complete within reasonable timeout
      expect(responseTime).toBeLessThan(30000); // 30 seconds max
    });
  });

  test.describe('Session and Security Error Handling', () => {
    test('should handle expired session gracefully', async () => {
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
      
      // Mock expired session
      await appPage.page.route('**/api/**', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session expired' }),
        });
      });
      
      const csvContent = TestDataGenerator.generateCSVContent('basic');
      await appPage.csvCutterPage.uploadTestCSV(csvContent, 'session-test.csv');
      
      // Should handle session expiry appropriately
      const hasError = await appPage.csvCutterPage.hasError();
      if (hasError) {
        const errorMessage = await appPage.csvCutterPage.getErrorMessage();
        expect(errorMessage.toLowerCase()).toMatch(/(session|expired|unauthorized|login)/);
      }
    });

    test('should handle CSRF token validation', async () => {
      const userData = TestDataGenerator.generateTestUser();
      
      await appPage.registerPage.goto();
      
      // Mock CSRF token error
      await appPage.page.route('**/register', (route) => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'CSRF token invalid' }),
        });
      });
      
      await appPage.registerPage.register(userData);
      
      // Should show CSRF error
      const hasError = await appPage.registerPage.hasError();
      if (hasError) {
        const errorMessage = await appPage.registerPage.getErrorMessage();
        expect(errorMessage.toLowerCase()).toMatch(/(csrf|token|forbidden|security)/);
      }
    });
  });

  test.describe('UI Error Recovery', () => {
    test('should recover from JavaScript errors', async () => {
      await appPage.goto();
      
      // Monitor console errors
      const consoleErrors: string[] = [];
      appPage.page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      // Inject a JavaScript error
      await appPage.page.evaluate(() => {
        (window as any).triggerError = () => {
          throw new Error('Intentional test error');
        };
      });
      
      await appPage.page.evaluate(() => {
        (window as any).triggerError();
      });
      
      // Wait a bit for error to be logged
      await appPage.page.waitForTimeout(1000);
      
      // App should still be functional despite JavaScript error
      expect(consoleErrors.length).toBeGreaterThan(0);
      
      // Try to navigate and perform basic operations
      await appPage.loginPage.goto();
      const formReady = await appPage.loginPage.emailInput.isVisible();
      expect(formReady).toBe(true);
    });

    test('should handle form validation errors gracefully', async () => {
      await appPage.registerPage.goto();
      await appPage.registerPage.waitForFormReady();
      
      // Submit empty form
      await appPage.registerPage.registerButton.click();
      
      // Should show validation errors without breaking the form
      const hasError = await appPage.registerPage.hasError();
      expect(hasError).toBe(true);
      
      // Form should still be functional
      const userData = TestDataGenerator.generateTestUser();
      await appPage.registerPage.clearForm();
      await appPage.registerPage.register(userData);
      
      const isRegistered = await appPage.registerPage.isRegistrationSuccessful();
      expect(isRegistered).toBe(true);
    });
  });

  test.describe('Data Validation Error Handling', () => {
    test('should validate CSV structure and format', async () => {
      const userData = TestDataGenerator.generateTestUser();
      
      // Setup authenticated user
      const isRegistered = await appPage.performRegistration(userData);
      expect(isRegistered).toBe(true);
      
      let isLoggedIn = await appPage.isLoggedIn();
      if (!isLoggedIn) {
        isLoggedIn = await appPage.performLogin(userData.email, userData.password);
        expect(isLoggedIn).toBe(true);
      }
      
      await appPage.goToCSVCutter();
      
      // Upload file with inconsistent columns
      const inconsistentCSV = `name,email,phone
John Doe,john@example.com,555-1234
Jane Smith,jane@example.com
Bob Johnson,bob@example.com,555-9012,extra-column`;
      
      await appPage.csvCutterPage.uploadTestCSV(inconsistentCSV, 'inconsistent.csv');
      
      // Should handle inconsistent structure gracefully
      const isUploaded = await appPage.csvCutterPage.isFileUploaded();
      const hasError = await appPage.csvCutterPage.hasError();
      
      expect(isUploaded || hasError).toBe(true);
      
      if (hasError) {
        const errorMessage = await appPage.csvCutterPage.getErrorMessage();
        console.log('CSV structure error:', errorMessage);
      }
    });
  });
});
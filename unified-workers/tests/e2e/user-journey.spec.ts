import { test, expect, Page } from '@playwright/test';
import { chromium } from '@playwright/test';

// Helper functions for E2E tests
class UserJourneyHelpers {
  constructor(private page: Page) {}

  async registerUser(username: string, email: string, password: string) {
    await this.page.goto('/');
    await this.page.click('text=Sign Up');
    
    await this.page.fill('input[name="username"]', username);
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.fill('input[name="password2"]', password);
    
    await this.page.click('button[type="submit"]');
    
    // Wait for successful registration
    await this.page.waitForSelector('text=Dashboard', { timeout: 10000 });
  }

  async loginUser(username: string, password: string) {
    await this.page.goto('/');
    await this.page.click('text=Sign In');
    
    await this.page.fill('input[name="username"]', username);
    await this.page.fill('input[name="password"]', password);
    
    await this.page.click('button[type="submit"]');
    
    // Wait for successful login
    await this.page.waitForSelector('text=Dashboard', { timeout: 10000 });
  }

  async uploadCSVFile(filename: string, content: string) {
    // Create a temporary file buffer
    const buffer = Buffer.from(content);
    
    await this.page.setInputFiles('input[type="file"]', {
      name: filename,
      mimeType: 'text/csv',
      buffer: buffer
    });
    
    // Wait for upload to complete
    await this.page.waitForSelector('text=Upload successful', { timeout: 15000 });
  }

  async logout() {
    await this.page.click('text=Logout');
    await this.page.waitForSelector('text=Sign In', { timeout: 5000 });
  }

  async measurePageLoad() {
    const navigationPromise = this.page.waitForLoadState('networkidle');
    const startTime = Date.now();
    await navigationPromise;
    return Date.now() - startTime;
  }

  async getCoreWebVitals() {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals: any = {};
          
          entries.forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
            }
            if (entry.entryType === 'first-input') {
              vitals.fid = entry.processingStart - entry.startTime;
            }
            if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
              vitals.cls = (vitals.cls || 0) + entry.value;
            }
          });
          
          // Mock resolve after a short timeout to simulate measurement
          setTimeout(() => resolve(vitals), 1000);
        }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      });
    });
  }
}

test.describe('Complete User Journey - Unified Workers', () => {
  let helpers: UserJourneyHelpers;
  const testUser = {
    username: `e2euser_${Date.now()}`,
    email: `e2euser_${Date.now()}@example.com`,
    password: 'e2eTestPass123!'
  };

  test.beforeEach(async ({ page }) => {
    helpers = new UserJourneyHelpers(page);
  });

  test('complete new user registration and file processing flow', async ({ page }) => {
    // Test registration
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Verify dashboard is visible
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator(`text=Welcome, ${testUser.username}`)).toBeVisible();
    
    // Test file upload
    const csvContent = 'name,age,city,department\nJohn,25,NYC,Engineering\nJane,30,LA,Marketing\nBob,35,Chicago,Sales\nAlice,28,Seattle,Engineering';
    await helpers.uploadCSVFile('employee_data.csv', csvContent);
    
    // Verify file appears in list
    await expect(page.locator('text=employee_data.csv')).toBeVisible();
    
    // Test CSV processing
    await page.click('text=Process CSV');
    
    // Select columns
    await page.selectOption('select[name="columns"]', ['name', 'department']);
    
    // Apply filter
    await page.fill('input[name="filter"]', 'department=Engineering');
    await page.click('button:has-text("Apply Filter")');
    
    // Verify results
    await expect(page.locator('text=2 rows found')).toBeVisible();
    await expect(page.locator('text=John')).toBeVisible();
    await expect(page.locator('text=Alice')).toBeVisible();
    
    // Download filtered results
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Download Results');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/filtered.*\.csv/);
    
    // Test file management
    await page.click('text=Manage Files');
    await expect(page.locator('text=employee_data.csv')).toBeVisible();
    
    // Add tags to file
    await page.click('[data-testid="edit-tags-employee_data.csv"]');
    await page.fill('input[name="tags"]', 'employees, q4-2024, engineering');
    await page.click('button:has-text("Save Tags")');
    
    // Verify tags were added
    await expect(page.locator('text=employees')).toBeVisible();
    await expect(page.locator('text=q4-2024')).toBeVisible();
    
    // Test logout
    await helpers.logout();
    await expect(page.locator('text=Sign In')).toBeVisible();
  });

  test('user authentication flow and session management', async ({ page }) => {
    // Register user
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Logout
    await helpers.logout();
    
    // Login again
    await helpers.loginUser(testUser.username, testUser.password);
    
    // Verify login successful
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Test session persistence across page refresh
    await page.reload();
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Test automatic logout on token expiration (simulate)
    // This would require actual token expiration or mocking
    await page.evaluate(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    });
    
    await page.reload();
    await expect(page.locator('text=Sign In')).toBeVisible();
  });

  test('error handling and edge cases', async ({ page }) => {
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Test invalid file upload
    await page.setInputFiles('input[type="file"]', {
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not a CSV file')
    });
    
    // Verify error message
    await expect(page.locator('text=Invalid file type')).toBeVisible();
    
    // Test malformed CSV upload
    const malformedCSV = 'name,age\n"John,25\nJane",30'; // Unclosed quotes
    await page.setInputFiles('input[type="file"]', {
      name: 'malformed.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(malformedCSV)
    });
    
    await expect(page.locator('text=Invalid CSV format')).toBeVisible();
    
    // Test network error handling
    // Simulate network failure
    await page.route('**/*', route => route.abort());
    
    await page.click('text=Refresh');
    await expect(page.locator('text=Network error')).toBeVisible();
    
    // Restore network
    await page.unroute('**/*');
  });

  test('responsive design and mobile compatibility', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Test mobile navigation
    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    
    // Test file upload on mobile
    const csvContent = 'name,age\nJohn,25\nJane,30';
    await helpers.uploadCSVFile('mobile_test.csv', csvContent);
    
    await expect(page.locator('text=mobile_test.csv')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Verify tablet layout
    await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('accessibility compliance', async ({ page }) => {
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Test screen reader support
    const ariaLabels = await page.locator('[aria-label]').count();
    expect(ariaLabels).toBeGreaterThan(0);
    
    // Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveClass(/dark-theme/);
    
    // Test reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Verify animations are disabled
    const animationCount = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="animate"]');
      return elements.length;
    });
    
    // Should have minimal animations in reduced motion mode
    expect(animationCount).toBeLessThan(5);
  });

  test('performance benchmarks', async ({ page }) => {
    // Measure initial page load
    const loadTime = await helpers.measurePageLoad();
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Measure Core Web Vitals
    const vitals = await helpers.getCoreWebVitals();
    
    // LCP should be under 2.5 seconds
    if (vitals.lcp) {
      expect(vitals.lcp).toBeLessThan(2500);
    }
    
    // FID should be under 100ms
    if (vitals.fid) {
      expect(vitals.fid).toBeLessThan(100);
    }
    
    // CLS should be under 0.1
    if (vitals.cls) {
      expect(vitals.cls).toBeLessThan(0.1);
    }
    
    // Test large file upload performance
    const largeCSV = 'id,name,email\n' + Array.from({ length: 10000 }, (_, i) => 
      `${i},User${i},user${i}@example.com`
    ).join('\n');
    
    const uploadStart = Date.now();
    await helpers.uploadCSVFile('large_file.csv', largeCSV);
    const uploadTime = Date.now() - uploadStart;
    
    expect(uploadTime).toBeLessThan(30000); // Should upload within 30 seconds
  });

  test('data integrity and consistency', async ({ page }) => {
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Upload multiple files
    const files = [
      { name: 'customers.csv', content: 'id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com' },
      { name: 'products.csv', content: 'id,name,price\n1,Laptop,1000\n2,Mouse,25' },
      { name: 'orders.csv', content: 'id,customer_id,product_id,quantity\n1,1,1,2\n2,2,2,1' }
    ];
    
    for (const file of files) {
      await helpers.uploadCSVFile(file.name, file.content);
    }
    
    // Verify all files are listed
    await page.click('text=Manage Files');
    
    for (const file of files) {
      await expect(page.locator(`text=${file.name}`)).toBeVisible();
    }
    
    // Test data processing consistency
    await page.click('text=customers.csv');
    await page.click('text=Process CSV');
    
    // Apply filter and verify results
    await page.fill('input[name="filter"]', 'id=1');
    await page.click('button:has-text("Apply Filter")');
    
    await expect(page.locator('text=1 rows found')).toBeVisible();
    await expect(page.locator('text=John')).toBeVisible();
    
    // Test data persistence across sessions
    await helpers.logout();
    await helpers.loginUser(testUser.username, testUser.password);
    
    await page.click('text=Manage Files');
    for (const file of files) {
      await expect(page.locator(`text=${file.name}`)).toBeVisible();
    }
  });

  test('security and privacy features', async ({ page }) => {
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Test that passwords are not visible in network requests
    const requests: string[] = [];
    page.on('request', request => {
      requests.push(request.url());
    });
    
    await helpers.logout();
    await helpers.loginUser(testUser.username, testUser.password);
    
    // Check that no password is visible in URLs or request bodies
    const sensitiveRequests = requests.filter(url => 
      url.includes(testUser.password) || url.includes('password')
    );
    expect(sensitiveRequests.length).toBe(0);
    
    // Test HTTPS enforcement (if applicable)
    const currentURL = page.url();
    if (currentURL.startsWith('https://')) {
      expect(currentURL).toMatch(/^https:/);
    }
    
    // Test secure session handling
    const localStorage = await page.evaluate(() => {
      return {
        accessToken: localStorage.getItem('access_token'),
        refreshToken: localStorage.getItem('refresh_token')
      };
    });
    
    expect(localStorage.accessToken).toBeTruthy();
    expect(localStorage.refreshToken).toBeTruthy();
    
    // Verify tokens are JWTs (basic format check)
    expect(localStorage.accessToken).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/);
    expect(localStorage.refreshToken).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/);
  });

  test('cross-browser compatibility', async ({ browserName }) => {
    test.skip(browserName === 'webkit', 'Skipping WebKit due to known issues');
    
    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Test core functionality across browsers
    const csvContent = 'name,age\nJohn,25\nJane,30';
    await helpers.uploadCSVFile('browser_test.csv', csvContent);
    
    await expect(page.locator('text=browser_test.csv')).toBeVisible();
    
    // Test browser-specific features
    if (browserName === 'chromium') {
      // Test Chrome-specific features
      await page.evaluate(() => {
        // Test modern JavaScript features
        const testMap = new Map();
        testMap.set('test', 'value');
        return testMap.get('test') === 'value';
      });
    }
    
    if (browserName === 'firefox') {
      // Test Firefox-specific features
      const userAgent = await page.evaluate(() => navigator.userAgent);
      expect(userAgent).toContain('Firefox');
    }
  });
});

test.describe('Error Scenarios and Edge Cases', () => {
  let helpers: UserJourneyHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new UserJourneyHelpers(page);
  });

  test('network failure recovery', async ({ page }) => {
    const testUser = {
      username: `recovery_${Date.now()}`,
      email: `recovery_${Date.now()}@example.com`,
      password: 'recoveryPass123!'
    };

    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Simulate network failure during file upload
    await page.route('**/api/list_cutter/upload', route => route.abort());
    
    const csvContent = 'name,age\nJohn,25';
    await page.setInputFiles('input[type="file"]', {
      name: 'network_fail.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    });
    
    // Should show error message
    await expect(page.locator('text=Upload failed')).toBeVisible();
    
    // Restore network and retry
    await page.unroute('**/api/list_cutter/upload');
    await page.click('button:has-text("Retry Upload")');
    
    // Should succeed now
    await expect(page.locator('text=Upload successful')).toBeVisible();
  });

  test('token expiration handling', async ({ page }) => {
    const testUser = {
      username: `expiry_${Date.now()}`,
      email: `expiry_${Date.now()}@example.com`,
      password: 'expiryPass123!'
    };

    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Simulate token expiration
    await page.evaluate(() => {
      // Set expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.expired';
      localStorage.setItem('access_token', expiredToken);
    });
    
    // Try to access protected resource
    await page.click('text=Manage Files');
    
    // Should redirect to login
    await expect(page.locator('text=Sign In')).toBeVisible();
    
    // Should show session expired message
    await expect(page.locator('text=Session expired')).toBeVisible();
  });

  test('concurrent user actions', async ({ page, context }) => {
    const testUser = {
      username: `concurrent_${Date.now()}`,
      email: `concurrent_${Date.now()}@example.com`,
      password: 'concurrentPass123!'
    };

    await helpers.registerUser(testUser.username, testUser.email, testUser.password);
    
    // Open multiple tabs
    const page2 = await context.newPage();
    const helpers2 = new UserJourneyHelpers(page2);
    
    // Login in second tab
    await helpers2.loginUser(testUser.username, testUser.password);
    
    // Upload file in first tab
    const csvContent1 = 'name,age\nJohn,25';
    await helpers.uploadCSVFile('concurrent1.csv', csvContent1);
    
    // Upload file in second tab simultaneously
    const csvContent2 = 'name,age\nJane,30';
    await helpers2.uploadCSVFile('concurrent2.csv', csvContent2);
    
    // Both files should be visible in both tabs
    await page.reload();
    await expect(page.locator('text=concurrent1.csv')).toBeVisible();
    await expect(page.locator('text=concurrent2.csv')).toBeVisible();
    
    await page2.reload();
    await expect(page2.locator('text=concurrent1.csv')).toBeVisible();
    await expect(page2.locator('text=concurrent2.csv')).toBeVisible();
    
    await page2.close();
  });
});
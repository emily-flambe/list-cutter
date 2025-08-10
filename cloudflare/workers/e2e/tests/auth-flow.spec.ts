import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage';
import { TestDataGenerator } from '../fixtures/test-data-generator';

/**
 * Critical Authentication Flow Tests
 * These tests ensure the authentication system works correctly
 * and prevents regression of fixed issues.
 */

test.describe('Critical Authentication Flow', () => {
  let appPage: AppPage;
  
  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
  });

  test('should login with username and redirect to home page', async () => {
    // Test the critical fix: login accepts username OR email
    const userData = {
      username: 'testuser_' + Date.now(),
      email: `test_${Date.now()}@example.com`,
      password: 'TestPassword123!'
    };
    
    // First register the user
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    
    // Logout if auto-logged in
    if (await appPage.isLoggedIn()) {
      await appPage.logout();
    }
    
    // Login with USERNAME (not email)
    await appPage.loginPage.goto();
    await appPage.loginPage.waitForFormReady();
    
    // Use username instead of email for login
    await appPage.loginPage.login(userData.username, userData.password);
    
    // Verify successful login
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Verify redirected to HOME page, not CUT page
    await appPage.page.waitForURL('**/');
    const currentUrl = appPage.page.url();
    expect(currentUrl.endsWith('/')).toBe(true);
    expect(currentUrl).not.toContain('/do-stuff/cut');
  });

  test('should login with email and redirect to home page', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register user
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    
    // Logout if auto-logged in
    if (await appPage.isLoggedIn()) {
      await appPage.logout();
    }
    
    // Login with EMAIL
    await appPage.loginPage.goto();
    await appPage.loginPage.login(userData.email, userData.password);
    
    // Verify successful login
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Verify redirected to HOME page
    await appPage.page.waitForURL('**/');
    const currentUrl = appPage.page.url();
    expect(currentUrl.endsWith('/')).toBe(true);
  });

  test('should auto-login after registration and redirect to home', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register new user
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    
    // Should be automatically logged in
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Should be redirected to HOME page, not CUT page
    await appPage.page.waitForURL('**/');
    const currentUrl = appPage.page.url();
    expect(currentUrl.endsWith('/')).toBe(true);
    expect(currentUrl).not.toContain('/do-stuff/cut');
  });

  test('should persist authentication tokens in localStorage', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    
    // Check localStorage for tokens
    const tokens = await appPage.page.evaluate(() => {
      return {
        authToken: localStorage.getItem('authToken'),
        refreshToken: localStorage.getItem('refreshToken')
      };
    });
    
    // Tokens should be present
    expect(tokens.authToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    
    // Tokens should be JWT format (starts with ey)
    expect(tokens.authToken).toMatch(/^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(tokens.refreshToken).toMatch(/^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  test('should maintain authentication when navigating to protected pages', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    await appPage.performRegistration(userData);
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Navigate to Do Stuff page
    await appPage.page.goto(`${appPage.baseUrl}/do-stuff`);
    await appPage.page.waitForLoadState('networkidle');
    
    // Should still be on Do Stuff page (not redirected to login)
    const afterDoStuffUrl = appPage.page.url();
    expect(afterDoStuffUrl).toContain('/do-stuff');
    expect(afterDoStuffUrl).not.toContain('/login');
    
    // Click on Manage Files
    const manageFilesCard = await appPage.page.locator('text=Manage Files').first();
    if (await manageFilesCard.isVisible()) {
      await manageFilesCard.click();
      await appPage.page.waitForLoadState('networkidle');
      
      // Should NOT see "not logged in" message
      const pageContent = await appPage.page.textContent('body');
      expect(pageContent).not.toContain('not logged in');
      expect(pageContent).not.toContain('Please log in');
      expect(pageContent).not.toContain('unauthorized');
      
      // Should NOT be redirected to login
      const afterManageFilesUrl = appPage.page.url();
      expect(afterManageFilesUrl).not.toContain('/login');
    }
    
    // Verify tokens are still present
    const tokens = await appPage.page.evaluate(() => {
      return {
        authToken: localStorage.getItem('authToken'),
        refreshToken: localStorage.getItem('refreshToken')
      };
    });
    
    expect(tokens.authToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
  });

  test('should handle API calls with authentication', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    await appPage.performRegistration(userData);
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Make authenticated API call
    const userInfo = await appPage.page.evaluate(async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return { error: 'No auth token' };
      
      try {
        const response = await fetch('/api/v1/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        return { status: response.status, data };
      } catch (error: any) {
        return { error: error.message };
      }
    });
    
    // API call should succeed with 200 status
    expect(userInfo.status).toBe(200);
    expect(userInfo.data).toBeTruthy();
    expect(userInfo.data.user || userInfo.data).toHaveProperty('email');
  });

  test('should clear tokens on logout', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    await appPage.performRegistration(userData);
    let isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Verify tokens exist
    let tokens = await appPage.page.evaluate(() => {
      return {
        authToken: localStorage.getItem('authToken'),
        refreshToken: localStorage.getItem('refreshToken')
      };
    });
    expect(tokens.authToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    
    // Logout
    await appPage.logout();
    
    // Verify logged out
    isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(false);
    
    // Verify tokens are cleared
    tokens = await appPage.page.evaluate(() => {
      return {
        authToken: localStorage.getItem('authToken'),
        refreshToken: localStorage.getItem('refreshToken')
      };
    });
    expect(tokens.authToken).toBeFalsy();
    expect(tokens.refreshToken).toBeFalsy();
  });

  test('should require email field in registration', async () => {
    // Navigate to registration page
    await appPage.registerPage.goto();
    await appPage.registerPage.waitForFormReady();
    
    // Check that email field is marked as required
    const emailField = await appPage.page.locator('input[name="email"]');
    const emailLabel = await appPage.page.locator('label:has-text("Email")');
    
    // Email field should exist
    expect(await emailField.isVisible()).toBe(true);
    
    // Email should be marked as required (with asterisk)
    const labelText = await emailLabel.textContent();
    expect(labelText).toContain('*');
    
    // HTML5 required attribute should be present
    const isRequired = await emailField.getAttribute('required');
    expect(isRequired).not.toBeNull();
  });

  test('should handle refresh token flow', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    await appPage.performRegistration(userData);
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Get initial tokens
    const initialTokens = await appPage.page.evaluate(() => {
      return {
        authToken: localStorage.getItem('authToken'),
        refreshToken: localStorage.getItem('refreshToken')
      };
    });
    
    // Simulate token refresh by making API call
    const refreshResult = await appPage.page.evaluate(async (refreshToken) => {
      try {
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        const data = await response.json();
        return { status: response.status, data };
      } catch (error: any) {
        return { error: error.message };
      }
    }, initialTokens.refreshToken);
    
    // Refresh should succeed
    expect(refreshResult.status).toBe(200);
    expect(refreshResult.data.access_token || refreshResult.data.accessToken).toBeTruthy();
  });
});

test.describe('Authentication Edge Cases', () => {
  let appPage: AppPage;
  
  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
  });

  test('should handle special characters in username', async () => {
    const userData = {
      username: 'test_user-123',
      email: `test_${Date.now()}@example.com`,
      password: 'TestPassword123!'
    };
    
    // Register with special characters in username
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    
    // Should successfully register and login
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Logout and login again with username
    if (isLoggedIn) {
      await appPage.logout();
    }
    
    await appPage.loginPage.goto();
    await appPage.loginPage.login(userData.username, userData.password);
    
    const isLoggedInAgain = await appPage.isLoggedIn();
    expect(isLoggedInAgain).toBe(true);
  });

  test('should handle case sensitivity in login', async () => {
    const userData = {
      username: 'TestUser' + Date.now(),
      email: `test_${Date.now()}@example.com`,
      password: 'TestPassword123!'
    };
    
    // Register with mixed case username
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    
    if (await appPage.isLoggedIn()) {
      await appPage.logout();
    }
    
    // Try login with different case
    await appPage.loginPage.goto();
    await appPage.loginPage.login(userData.username.toLowerCase(), userData.password);
    
    // This test verifies whether the system is case-sensitive
    // Adjust expectation based on your requirements
    const isLoggedIn = await appPage.isLoggedIn();
    console.log(`Case sensitivity test: Login with lowercase username: ${isLoggedIn}`);
  });
});
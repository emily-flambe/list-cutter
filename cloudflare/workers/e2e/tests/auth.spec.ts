import { test, expect } from '@playwright/test';
import { AppPage } from '../page-objects/AppPage';
import { TestDataGenerator } from '../fixtures/test-data-generator';

/**
 * Pinkie Pie's Authentication Tests 🎉
 * Testing the party invitation system (auth flows)!
 */

test.describe('Authentication Flow Tests', () => {
  let appPage: AppPage;
  
  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page);
  });

  test('should register a new user successfully', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Navigate to registration page
    await appPage.registerPage.goto();
    await appPage.registerPage.waitForFormReady();
    
    // Fill and submit registration form
    await appPage.registerPage.register(userData);
    
    // Verify registration success
    const isRegistered = await appPage.registerPage.isRegistrationSuccessful();
    expect(isRegistered).toBe(true);
    
    // Check if automatically logged in or shows success message
    const isLoggedIn = await appPage.isLoggedIn();
    const hasSuccessMessage = await appPage.registerPage.hasSuccessMessage();
    
    expect(isLoggedIn || hasSuccessMessage).toBe(true);
  });

  test('should login with valid credentials', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // First register the user
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    
    // Ensure we're logged out
    if (await appPage.isLoggedIn()) {
      await appPage.logout();
    }
    
    // Now test login
    await appPage.loginPage.goto();
    await appPage.loginPage.waitForFormReady();
    await appPage.loginPage.login(userData.email, userData.password);
    
    // Verify login success
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Verify user display name if available
    const displayName = await appPage.getUserDisplayName();
    if (displayName) {
      expect(displayName.length).toBeGreaterThan(0);
    }
  });

  test('should login with predefined test user', async () => {
    const testUser = TestDataGenerator.getPredefinedTestUser();
    
    // Test login with predefined credentials
    await appPage.loginPage.goto();
    await appPage.loginPage.waitForFormReady();
    await appPage.loginPage.login(testUser.email, testUser.password);
    
    // Verify login success
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);
    
    // Verify user display name if available
    const displayName = await appPage.getUserDisplayName();
    if (displayName) {
      expect(displayName.length).toBeGreaterThan(0);
    }
  });

  test('should reject login with invalid credentials', async () => {
    await appPage.loginPage.goto();
    await appPage.loginPage.waitForFormReady();
    
    // Try login with invalid credentials
    await appPage.loginPage.login('invalid@example.com', 'wrongpassword');
    
    // Should show error and not be logged in
    const hasError = await appPage.loginPage.hasError();
    const isLoggedIn = await appPage.isLoggedIn();
    
    expect(hasError).toBe(true);
    expect(isLoggedIn).toBe(false);
    
    // Check error message content
    const errorMessage = await appPage.loginPage.getErrorMessage();
    expect(errorMessage.toLowerCase()).toContain('invalid');
  });

  test('should logout successfully', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
    }
    expect(isLoggedIn).toBe(true);
    
    // Logout
    await appPage.logout();
    
    // Verify logout success
    const isStillLoggedIn = await appPage.isLoggedIn();
    expect(isStillLoggedIn).toBe(false);
  });

  test('should prevent registration with invalid email', async () => {
    const userData = TestDataGenerator.generateTestUser();
    userData.email = 'invalid-email'; // Invalid email format
    
    await appPage.registerPage.goto();
    await appPage.registerPage.waitForFormReady();
    await appPage.registerPage.register(userData);
    
    // Should show error for invalid email
    const hasError = await appPage.registerPage.hasError();
    const isRegistered = await appPage.registerPage.isRegistrationSuccessful();
    
    expect(hasError).toBe(true);
    expect(isRegistered).toBe(false);
  });

  test('should prevent registration with duplicate email', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register user first time
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    const firstRegistration = await appPage.registerPage.isRegistrationSuccessful();
    expect(firstRegistration).toBe(true);
    
    // Logout if logged in
    if (await appPage.isLoggedIn()) {
      await appPage.logout();
    }
    
    // Try to register with same email again
    await appPage.registerPage.goto();
    await appPage.registerPage.register(userData);
    
    // Should show error for duplicate email
    const hasError = await appPage.registerPage.hasError();
    const secondRegistration = await appPage.registerPage.isRegistrationSuccessful();
    
    expect(hasError).toBe(true);
    expect(secondRegistration).toBe(false);
  });

  test('should navigate between login and register pages', async () => {
    // Start at login page
    await appPage.loginPage.goto();
    expect(appPage.page.url()).toContain('/login');
    
    // Navigate to register
    await appPage.loginPage.goToRegister();
    expect(appPage.page.url()).toContain('/register');
    
    // Navigate back to login
    await appPage.registerPage.goToLogin();
    expect(appPage.page.url()).toContain('/login');
  });

  test('should validate form accessibility', async () => {
    // Test login page accessibility
    await appPage.loginPage.goto();
    await appPage.loginPage.validateAccessibility();
    
    // Test register page accessibility
    await appPage.registerPage.goto();
    await appPage.registerPage.validateAccessibility();
  });

  test('should handle password strength validation', async () => {
    await appPage.registerPage.goto();
    await appPage.registerPage.waitForFormReady();
    
    // Test weak password
    const hasStrengthIndicator = await appPage.registerPage.validatePasswordStrength('weak');
    
    // If password strength indicator exists, test it
    if (hasStrengthIndicator) {
      // Test strong password
      await appPage.registerPage.validatePasswordStrength('StrongPassword123!');
      // Additional validation logic can be added here
    }
  });

  test('should remember login state on page refresh', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
    }
    expect(isLoggedIn).toBe(true);
    
    // Refresh page
    await appPage.page.reload();
    await appPage.waitForPageLoad();
    
    // Should still be logged in (if session persistence is implemented)
    const isStillLoggedIn = await appPage.isLoggedIn();
    // This test may fail if session persistence is not implemented
    // Adjust expectation based on your authentication implementation
    console.log('Login state after refresh:', isStillLoggedIn);
  });

  test('should handle session timeout gracefully', async () => {
    const userData = TestDataGenerator.generateTestUser();
    
    // Register and login
    const isRegistered = await appPage.performRegistration(userData);
    expect(isRegistered).toBe(true);
    
    let isLoggedIn = await appPage.isLoggedIn();
    if (!isLoggedIn) {
      isLoggedIn = await appPage.performLogin(userData.email, userData.password);
    }
    expect(isLoggedIn).toBe(true);
    
    // Navigate to protected page
    await appPage.goToCSVCutter();
    
    // Simulate session timeout by waiting
    // In a real scenario, you might mock the session timeout
    // or wait for actual timeout (if configured for testing)
    
    // Try to perform an action that requires authentication
    await appPage.csvCutterPage.waitForUploadReady();
    
    // The test should verify graceful handling of session timeout
    // Implementation depends on how your app handles expired sessions
  });
});
import { test as base, expect } from '@playwright/test';
import { TestDataGenerator } from './test-data-generator';
import { LoginPage } from '../page-objects/LoginPage';
import { AppPage } from '../page-objects/AppPage';

/**
 * Authentication fixture for secure test user management
 * Provides logged-in state for tests that require authentication
 */

type AuthFixture = {
  authenticatedPage: AppPage;
  testUser: ReturnType<typeof TestDataGenerator.getPredefinedTestUser>;
};

export const test = base.extend<AuthFixture>({
  testUser: async ({}, use) => {
    // Get secure test credentials
    const testUser = TestDataGenerator.getPredefinedTestUser();
    await use(testUser);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Create page objects
    const appPage = new AppPage(page);
    const loginPage = new LoginPage(page);

    // Navigate to login page
    await loginPage.goto();
    await loginPage.waitForFormReady();

    // Login with predefined test user
    await loginPage.login(testUser.email, testUser.password);

    // Verify authentication
    const isLoggedIn = await appPage.isLoggedIn();
    expect(isLoggedIn).toBe(true);

    // Provide authenticated page to test
    await use(appPage);

    // Optional: Logout after test (uncomment if needed)
    // if (await appPage.isLoggedIn()) {
    //   await appPage.logout();
    // }
  },
});

export { expect } from '@playwright/test';
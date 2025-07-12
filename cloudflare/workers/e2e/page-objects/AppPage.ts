import { Page, Locator } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { CSVCutterPage } from './CSVCutterPage';

/**
 * Pinkie Pie's Main App Page Object 🎉
 * The central hub for navigating our testing party!
 */

export class AppPage {
  readonly page: Page;
  readonly navigationMenu: Locator;
  readonly userMenuButton: Locator;
  readonly logoutButton: Locator;
  readonly homeLink: Locator;
  readonly csvCutterLink: Locator;
  readonly profileLink: Locator;
  readonly settingsLink: Locator;
  readonly userDisplayName: Locator;
  readonly loadingSpinner: Locator;
  readonly notificationArea: Locator;

  // Page objects for different sections
  readonly loginPage: LoginPage;
  readonly registerPage: RegisterPage;
  readonly csvCutterPage: CSVCutterPage;

  constructor(page: Page) {
    this.page = page;
    
    // Navigation elements
    this.navigationMenu = page.locator('nav, .navbar, .navigation');
    this.userMenuButton = page.locator('.user-menu, [data-testid="user-menu"], .dropdown-toggle');
    this.logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), a:has-text("Sign Out")');
    this.homeLink = page.locator('a[href="/"], a:has-text("Home")');
    this.csvCutterLink = page.locator('a[href*="csv"], a:has-text("CSV Cutter")');
    this.profileLink = page.locator('a[href*="profile"], a:has-text("Profile")');
    this.settingsLink = page.locator('a[href*="settings"], a:has-text("Settings")');
    this.userDisplayName = page.locator('.user-name, .display-name, [data-testid="user-name"]');
    this.loadingSpinner = page.locator('.loading, .spinner, [data-testid="loading"]');
    this.notificationArea = page.locator('.notifications, .alerts, [data-testid="notifications"]');

    // Initialize page objects
    this.loginPage = new LoginPage(page);
    this.registerPage = new RegisterPage(page);
    this.csvCutterPage = new CSVCutterPage(page);
  }

  /**
   * Navigate to home page
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    // Check for user menu or user display name
    return (
      await TestHelpers.elementExists(this.page, this.userMenuButton.locator('').toString()) ||
      await TestHelpers.elementExists(this.page, this.userDisplayName.locator('').toString()) ||
      await TestHelpers.elementExists(this.page, this.logoutButton.locator('').toString())
    );
  }

  /**
   * Get logged in user display name
   */
  async getUserDisplayName(): Promise<string> {
    if (await TestHelpers.elementExists(this.page, this.userDisplayName.locator('').toString())) {
      return await TestHelpers.getTextContent(this.page, this.userDisplayName.locator('').toString());
    }
    return '';
  }

  /**
   * Logout the current user
   */
  async logout() {
    // Try to click user menu first if it exists
    if (await TestHelpers.elementExists(this.page, this.userMenuButton.locator('').toString())) {
      await TestHelpers.safeClick(this.page, this.userMenuButton.locator('').toString());
      await this.page.waitForTimeout(500);
    }

    // Click logout button
    if (await TestHelpers.elementExists(this.page, this.logoutButton.locator('').toString())) {
      await TestHelpers.waitForNavigation(this.page, async () => {
        await TestHelpers.safeClick(this.page, this.logoutButton.locator('').toString());
      });
    }
  }

  /**
   * Navigate to CSV cutter page
   */
  async goToCSVCutter() {
    if (await TestHelpers.elementExists(this.page, this.csvCutterLink.locator('').toString())) {
      await TestHelpers.safeClick(this.page, this.csvCutterLink.locator('').toString());
    } else {
      await this.page.goto('/csv-cutter');
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to profile page
   */
  async goToProfile() {
    if (await TestHelpers.elementExists(this.page, this.profileLink.locator('').toString())) {
      await TestHelpers.safeClick(this.page, this.profileLink.locator('').toString());
    } else {
      await this.page.goto('/profile');
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to settings page
   */
  async goToSettings() {
    if (await TestHelpers.elementExists(this.page, this.settingsLink.locator('').toString())) {
      await TestHelpers.safeClick(this.page, this.settingsLink.locator('').toString());
    } else {
      await this.page.goto('/settings');
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for page to load completely
   */
  async waitForPageLoad() {
    // Wait for loading spinner to disappear
    if (await TestHelpers.elementExists(this.page, this.loadingSpinner.locator('').toString(), 1000)) {
      await TestHelpers.waitForElementToDisappear(this.page, this.loadingSpinner.locator('').toString());
    }
    
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check for notifications
   */
  async hasNotifications(): Promise<boolean> {
    return await TestHelpers.elementExists(this.page, this.notificationArea.locator('').toString());
  }

  /**
   * Get notification messages
   */
  async getNotifications(): Promise<string[]> {
    if (!await this.hasNotifications()) {
      return [];
    }

    const notifications = await this.notificationArea.locator('.notification, .alert').all();
    const messages: string[] = [];

    for (const notification of notifications) {
      const text = await notification.textContent();
      if (text?.trim()) {
        messages.push(text.trim());
      }
    }

    return messages;
  }

  /**
   * Dismiss notifications
   */
  async dismissNotifications() {
    if (await this.hasNotifications()) {
      const dismissButtons = await this.notificationArea.locator('.close, .dismiss, [aria-label="close"]').all();
      
      for (const button of dismissButtons) {
        try {
          await button.click();
          await this.page.waitForTimeout(200);
        } catch (error) {
          // Continue if button is not clickable
        }
      }
    }
  }

  /**
   * Perform complete login flow
   */
  async performLogin(email: string, password: string): Promise<boolean> {
    await this.loginPage.goto();
    await this.loginPage.login(email, password);
    return await this.isLoggedIn();
  }

  /**
   * Perform complete registration flow
   */
  async performRegistration(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }): Promise<boolean> {
    await this.registerPage.goto();
    await this.registerPage.register(userData);
    return await this.registerPage.isRegistrationSuccessful();
  }

  /**
   * Complete user journey: register, login, upload, process, download
   */
  async performCompleteUserJourney(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }, csvContent: string): Promise<{
    registered: boolean;
    loggedIn: boolean;
    fileUploaded: boolean;
    fileProcessed: boolean;
    fileDownloaded: boolean;
  }> {
    const result = {
      registered: false,
      loggedIn: false,
      fileUploaded: false,
      fileProcessed: false,
      fileDownloaded: false,
    };

    try {
      // Step 1: Register
      result.registered = await this.performRegistration(userData);
      if (!result.registered) return result;

      // Step 2: Login (if not automatically logged in after registration)
      if (!await this.isLoggedIn()) {
        result.loggedIn = await this.performLogin(userData.email, userData.password);
        if (!result.loggedIn) return result;
      } else {
        result.loggedIn = true;
      }

      // Step 3: Navigate to CSV cutter and upload file
      await this.goToCSVCutter();
      await this.csvCutterPage.uploadTestCSV(csvContent);
      result.fileUploaded = await this.csvCutterPage.isFileUploaded();
      if (!result.fileUploaded) return result;

      // Step 4: Process file
      await this.csvCutterPage.processFile();
      result.fileProcessed = await this.csvCutterPage.isDownloadReady();
      if (!result.fileProcessed) return result;

      // Step 5: Download file
      const download = await this.csvCutterPage.downloadFile();
      result.fileDownloaded = !!download;

      return result;

    } catch (error) {
      console.error('Error in complete user journey:', error);
      return result;
    }
  }

  /**
   * Take screenshot for debugging
   */
  async takeDebugScreenshot(name: string) {
    await TestHelpers.takeTimestampedScreenshot(this.page, `debug-${name}`);
  }

  /**
   * Check page accessibility
   */
  async validateAccessibility() {
    await TestHelpers.validateAccessibility(this.page);
  }
}
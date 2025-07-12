import { Page, Locator } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

/**
 * Pinkie Pie's Login Page Object 🎉
 * Making login testing as easy as a party invitation!
 */

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly rememberMeCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"], input[name="email"]');
    this.passwordInput = page.locator('input[type="password"], input[name="password"]');
    this.loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    this.registerLink = page.locator('a[href*="register"], a:has-text("Register"), a:has-text("Sign Up")');
    this.errorMessage = page.locator('.error, .alert-error, [data-testid="error-message"]');
    this.successMessage = page.locator('.success, .alert-success, [data-testid="success-message"]');
    this.forgotPasswordLink = page.locator('a:has-text("Forgot Password"), a:has-text("Reset Password")');
    this.rememberMeCheckbox = page.locator('input[type="checkbox"][name*="remember"]');
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Perform login with credentials
   */
  async login(email: string, password: string) {
    await TestHelpers.safeType(this.page, this.emailInput.locator('').toString(), email);
    await TestHelpers.safeType(this.page, this.passwordInput.locator('').toString(), password);
    
    // Click login and wait for navigation
    await TestHelpers.waitForNavigation(this.page, async () => {
      await TestHelpers.safeClick(this.page, this.loginButton.locator('').toString());
    });
  }

  /**
   * Check if login was successful
   */
  async isLoginSuccessful(): Promise<boolean> {
    // Check if we're redirected to dashboard or home page
    await this.page.waitForTimeout(2000);
    const currentUrl = this.page.url();
    return !currentUrl.includes('/login') && !await this.hasError();
  }

  /**
   * Check if error message is displayed
   */
  async hasError(): Promise<boolean> {
    return await TestHelpers.elementExists(this.page, this.errorMessage.locator('').toString());
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    if (await this.hasError()) {
      return await TestHelpers.getTextContent(this.page, this.errorMessage.locator('').toString());
    }
    return '';
  }

  /**
   * Navigate to register page
   */
  async goToRegister() {
    await TestHelpers.safeClick(this.page, this.registerLink.locator('').toString());
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if remember me option is available
   */
  async hasRememberMeOption(): Promise<boolean> {
    return await TestHelpers.elementExists(this.page, this.rememberMeCheckbox.locator('').toString());
  }

  /**
   * Toggle remember me checkbox
   */
  async toggleRememberMe() {
    if (await this.hasRememberMeOption()) {
      await TestHelpers.safeClick(this.page, this.rememberMeCheckbox.locator('').toString());
    }
  }

  /**
   * Check if forgot password link is available
   */
  async hasForgotPasswordLink(): Promise<boolean> {
    return await TestHelpers.elementExists(this.page, this.forgotPasswordLink.locator('').toString());
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword() {
    if (await this.hasForgotPasswordLink()) {
      await TestHelpers.safeClick(this.page, this.forgotPasswordLink.locator('').toString());
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Wait for login form to be ready
   */
  async waitForFormReady() {
    await this.emailInput.waitFor({ state: 'visible' });
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.loginButton.waitFor({ state: 'visible' });
  }

  /**
   * Clear login form
   */
  async clearForm() {
    await this.emailInput.clear();
    await this.passwordInput.clear();
  }

  /**
   * Validate form accessibility
   */
  async validateAccessibility() {
    await TestHelpers.validateAccessibility(this.page);
  }
}
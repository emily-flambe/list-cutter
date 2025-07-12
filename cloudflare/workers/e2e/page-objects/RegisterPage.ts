import { Page, Locator } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

/**
 * Pinkie Pie's Register Page Object 🎉
 * Making user registration as fun as sending party invitations!
 */

export class RegisterPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly usernameInput: Locator;
  readonly registerButton: Locator;
  readonly loginLink: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly termsCheckbox: Locator;
  readonly privacyCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"], input[name="email"]');
    this.passwordInput = page.locator('input[type="password"][name*="password"]:not([name*="confirm"])');
    this.confirmPasswordInput = page.locator('input[type="password"][name*="confirm"], input[type="password"][name*="repeat"]');
    this.firstNameInput = page.locator('input[name*="first"], input[name*="firstName"]');
    this.lastNameInput = page.locator('input[name*="last"], input[name*="lastName"]');
    this.usernameInput = page.locator('input[name="username"], input[name="user"]');
    this.registerButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
    this.loginLink = page.locator('a[href*="login"], a:has-text("Login"), a:has-text("Sign In")');
    this.errorMessage = page.locator('.error, .alert-error, [data-testid="error-message"]');
    this.successMessage = page.locator('.success, .alert-success, [data-testid="success-message"]');
    this.termsCheckbox = page.locator('input[type="checkbox"][name*="terms"]');
    this.privacyCheckbox = page.locator('input[type="checkbox"][name*="privacy"]');
  }

  /**
   * Navigate to register page
   */
  async goto() {
    await this.page.goto('/register');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Fill out registration form
   */
  async register(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) {
    // Fill basic required fields
    await TestHelpers.safeType(this.page, this.emailInput.locator('').toString(), userData.email);
    await TestHelpers.safeType(this.page, this.passwordInput.locator('').toString(), userData.password);
    
    // Fill confirm password if field exists
    if (await TestHelpers.elementExists(this.page, this.confirmPasswordInput.locator('').toString())) {
      await TestHelpers.safeType(this.page, this.confirmPasswordInput.locator('').toString(), userData.password);
    }

    // Fill optional fields if they exist and data is provided
    if (userData.firstName && await TestHelpers.elementExists(this.page, this.firstNameInput.locator('').toString())) {
      await TestHelpers.safeType(this.page, this.firstNameInput.locator('').toString(), userData.firstName);
    }

    if (userData.lastName && await TestHelpers.elementExists(this.page, this.lastNameInput.locator('').toString())) {
      await TestHelpers.safeType(this.page, this.lastNameInput.locator('').toString(), userData.lastName);
    }

    if (userData.username && await TestHelpers.elementExists(this.page, this.usernameInput.locator('').toString())) {
      await TestHelpers.safeType(this.page, this.usernameInput.locator('').toString(), userData.username);
    }

    // Accept terms and privacy if checkboxes exist
    await this.acceptTermsAndPrivacy();

    // Submit the form
    await TestHelpers.waitForNavigation(this.page, async () => {
      await TestHelpers.safeClick(this.page, this.registerButton.locator('').toString());
    });
  }

  /**
   * Accept terms and privacy policy
   */
  async acceptTermsAndPrivacy() {
    if (await TestHelpers.elementExists(this.page, this.termsCheckbox.locator('').toString())) {
      await TestHelpers.safeClick(this.page, this.termsCheckbox.locator('').toString());
    }

    if (await TestHelpers.elementExists(this.page, this.privacyCheckbox.locator('').toString())) {
      await TestHelpers.safeClick(this.page, this.privacyCheckbox.locator('').toString());
    }
  }

  /**
   * Check if registration was successful
   */
  async isRegistrationSuccessful(): Promise<boolean> {
    await this.page.waitForTimeout(2000);
    
    // Check for success message or redirect
    if (await this.hasSuccessMessage()) {
      return true;
    }

    // Check if redirected away from register page
    const currentUrl = this.page.url();
    return !currentUrl.includes('/register') && !await this.hasError();
  }

  /**
   * Check if error message is displayed
   */
  async hasError(): Promise<boolean> {
    return await TestHelpers.elementExists(this.page, this.errorMessage.locator('').toString());
  }

  /**
   * Check if success message is displayed
   */
  async hasSuccessMessage(): Promise<boolean> {
    return await TestHelpers.elementExists(this.page, this.successMessage.locator('').toString());
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
   * Get success message text
   */
  async getSuccessMessage(): Promise<string> {
    if (await this.hasSuccessMessage()) {
      return await TestHelpers.getTextContent(this.page, this.successMessage.locator('').toString());
    }
    return '';
  }

  /**
   * Navigate to login page
   */
  async goToLogin() {
    await TestHelpers.safeClick(this.page, this.loginLink.locator('').toString());
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for registration form to be ready
   */
  async waitForFormReady() {
    await this.emailInput.waitFor({ state: 'visible' });
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.registerButton.waitFor({ state: 'visible' });
  }

  /**
   * Clear registration form
   */
  async clearForm() {
    await this.emailInput.clear();
    await this.passwordInput.clear();
    
    if (await TestHelpers.elementExists(this.page, this.confirmPasswordInput.locator('').toString())) {
      await this.confirmPasswordInput.clear();
    }
    
    if (await TestHelpers.elementExists(this.page, this.firstNameInput.locator('').toString())) {
      await this.firstNameInput.clear();
    }
    
    if (await TestHelpers.elementExists(this.page, this.lastNameInput.locator('').toString())) {
      await this.lastNameInput.clear();
    }
    
    if (await TestHelpers.elementExists(this.page, this.usernameInput.locator('').toString())) {
      await this.usernameInput.clear();
    }
  }

  /**
   * Validate password strength indicator
   */
  async validatePasswordStrength(password: string): Promise<boolean> {
    await TestHelpers.safeType(this.page, this.passwordInput.locator('').toString(), password);
    
    // Look for password strength indicators
    const strengthIndicators = [
      '.password-strength',
      '.strength-meter',
      '[data-testid="password-strength"]'
    ];

    for (const indicator of strengthIndicators) {
      if (await TestHelpers.elementExists(this.page, indicator)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate form accessibility
   */
  async validateAccessibility() {
    await TestHelpers.validateAccessibility(this.page);
  }
}
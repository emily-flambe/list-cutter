import { Page, expect, Locator } from '@playwright/test';

/**
 * Pinkie Pie's Test Helper Utilities 🎉
 * Making E2E testing as fun and easy as a party!
 */

export class TestHelpers {
  
  /**
   * Wait for element to be visible and ready for interaction
   */
  static async waitForElement(page: Page, selector: string, timeout: number = 10000): Promise<Locator> {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    return element;
  }

  /**
   * Safe click with retry logic
   */
  static async safeClick(page: Page, selector: string, retries: number = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const element = await this.waitForElement(page, selector);
        await element.click();
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Safe type with clear and retry logic
   */
  static async safeType(page: Page, selector: string, text: string, retries: number = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const element = await this.waitForElement(page, selector);
        await element.clear();
        await element.fill(text);
        
        // Verify the text was entered correctly
        const value = await element.inputValue();
        if (value === text) return;
        
        throw new Error(`Text not entered correctly. Expected: ${text}, Got: ${value}`);
      } catch (error) {
        if (i === retries - 1) throw error;
        await page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Upload file with progress monitoring
   */
  static async uploadFile(page: Page, fileInputSelector: string, filePath: string) {
    const fileInput = await this.waitForElement(page, fileInputSelector);
    await fileInput.setInputFiles(filePath);
    
    // Wait for upload to start
    await page.waitForTimeout(1000);
  }

  /**
   * Wait for download and return the download object
   */
  static async waitForDownload(page: Page, triggerAction: () => Promise<void>) {
    const downloadPromise = page.waitForEvent('download');
    await triggerAction();
    const download = await downloadPromise;
    return download;
  }

  /**
   * Check if element exists without throwing
   */
  static async elementExists(page: Page, selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await page.locator(selector).waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for navigation with network idle
   */
  static async waitForNavigation(page: Page, action: () => Promise<void>) {
    await Promise.all([
      page.waitForLoadState('networkidle'),
      action(),
    ]);
  }

  /**
   * Get text content safely
   */
  static async getTextContent(page: Page, selector: string): Promise<string> {
    const element = await this.waitForElement(page, selector);
    const text = await element.textContent();
    return text?.trim() || '';
  }

  /**
   * Wait for API response
   */
  static async waitForAPIResponse(page: Page, urlPattern: string | RegExp, action: () => Promise<void>) {
    const responsePromise = page.waitForResponse(urlPattern);
    await action();
    const response = await responsePromise;
    return response;
  }

  /**
   * Take screenshot with timestamp
   */
  static async takeTimestampedScreenshot(page: Page, name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ 
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  /**
   * Generate unique test identifier
   */
  static generateTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Wait for element to disappear
   */
  static async waitForElementToDisappear(page: Page, selector: string, timeout: number = 10000) {
    await page.locator(selector).waitFor({ state: 'hidden', timeout });
  }

  /**
   * Check for console errors
   */
  static async checkForConsoleErrors(page: Page): Promise<string[]> {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    return errors;
  }

  /**
   * Wait for specific network condition
   */
  static async waitForNetworkIdle(page: Page, timeout: number = 10000) {
    await page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Retry action with exponential backoff
   */
  static async retryWithBackoff<T>(
    action: () => Promise<T>, 
    maxRetries: number = 3, 
    baseDelay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await action();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry limit exceeded');
  }

  /**
   * Validate page accessibility
   */
  static async validateAccessibility(page: Page) {
    // Basic accessibility checks
    const missingAltTexts = await page.locator('img:not([alt])').count();
    const missingLabels = await page.locator('input:not([aria-label]):not([aria-labelledby]):not([id])').count();
    
    if (missingAltTexts > 0) {
      console.warn(`⚠️ Found ${missingAltTexts} images without alt text`);
    }
    
    if (missingLabels > 0) {
      console.warn(`⚠️ Found ${missingLabels} inputs without proper labels`);
    }
  }

  /**
   * Mock API responses for testing
   */
  static async mockAPIResponse(page: Page, urlPattern: string | RegExp, response: any) {
    await page.route(urlPattern, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Clean up test data via API
   */
  static async cleanupTestData(page: Page, authToken: string, testId: string) {
    try {
      // This would call cleanup endpoints on your API
      // Implementation depends on your backend cleanup endpoints
      console.log(`🧹 Cleaning up test data for: ${testId}`);
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup test data: ${error}`);
    }
  }
}
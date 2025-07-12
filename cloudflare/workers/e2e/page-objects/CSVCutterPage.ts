import { Page, Locator } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

/**
 * Pinkie Pie's CSV Cutter Page Object 🎉
 * Making CSV processing as fun as cutting party decorations!
 */

export class CSVCutterPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly filePreview: Locator;
  readonly processButton: Locator;
  readonly downloadButton: Locator;
  readonly fileList: Locator;
  readonly uploadProgress: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly columnSelector: Locator;
  readonly rowRangeInput: Locator;
  readonly filterInput: Locator;
  readonly previewTable: Locator;
  readonly fileInfo: Locator;
  readonly deleteFileButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.locator('button:has-text("Upload"), button[type="submit"]:has-text("Submit")');
    this.filePreview = page.locator('.file-preview, [data-testid="file-preview"]');
    this.processButton = page.locator('button:has-text("Process"), button:has-text("Cut"), button:has-text("Generate")');
    this.downloadButton = page.locator('button:has-text("Download"), a:has-text("Download")');
    this.fileList = page.locator('.file-list, [data-testid="file-list"]');
    this.uploadProgress = page.locator('.upload-progress, .progress-bar, [data-testid="upload-progress"]');
    this.errorMessage = page.locator('.error, .alert-error, [data-testid="error-message"]');
    this.successMessage = page.locator('.success, .alert-success, [data-testid="success-message"]');
    this.columnSelector = page.locator('select[name*="column"], .column-selector');
    this.rowRangeInput = page.locator('input[name*="range"], input[name*="rows"]');
    this.filterInput = page.locator('input[name*="filter"], input[placeholder*="filter"]');
    this.previewTable = page.locator('table, .data-preview, [data-testid="preview-table"]');
    this.fileInfo = page.locator('.file-info, [data-testid="file-info"]');
    this.deleteFileButton = page.locator('button:has-text("Delete"), button:has-text("Remove")');
  }

  /**
   * Navigate to CSV cutter page
   */
  async goto() {
    await this.page.goto('/csv-cutter');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Upload a CSV file
   */
  async uploadFile(filePath: string) {
    await TestHelpers.uploadFile(this.page, this.fileInput.locator('').toString(), filePath);
    
    // Wait for upload to complete
    if (await TestHelpers.elementExists(this.page, this.uploadProgress.locator('').toString())) {
      await TestHelpers.waitForElementToDisappear(this.page, this.uploadProgress.locator('').toString());
    }
    
    // Wait for file to be processed and preview to appear
    await this.page.waitForTimeout(2000);
  }

  /**
   * Create and upload a test CSV file
   */
  async uploadTestCSV(content: string, filename: string = 'test.csv') {
    // Create temporary file
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, filename);
    fs.writeFileSync(tempFilePath, content);
    
    try {
      await this.uploadFile(tempFilePath);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  /**
   * Check if file was uploaded successfully
   */
  async isFileUploaded(): Promise<boolean> {
    // Check for file preview, file list, or success message
    return (
      await TestHelpers.elementExists(this.page, this.filePreview.locator('').toString()) ||
      await TestHelpers.elementExists(this.page, this.fileList.locator('').toString()) ||
      await this.hasSuccessMessage()
    );
  }

  /**
   * Get preview table data
   */
  async getPreviewData(): Promise<string[][]> {
    if (!await TestHelpers.elementExists(this.page, this.previewTable.locator('').toString())) {
      return [];
    }

    const rows = await this.previewTable.locator('tr').all();
    const data: string[][] = [];

    for (const row of rows) {
      const cells = await row.locator('td, th').all();
      const rowData: string[] = [];
      
      for (const cell of cells) {
        const text = await cell.textContent();
        rowData.push(text?.trim() || '');
      }
      
      data.push(rowData);
    }

    return data;
  }

  /**
   * Process the uploaded file
   */
  async processFile(options?: {
    columns?: string[];
    rowRange?: string;
    filter?: string;
  }) {
    // Set processing options if provided
    if (options?.columns && await TestHelpers.elementExists(this.page, this.columnSelector.locator('').toString())) {
      for (const column of options.columns) {
        await this.columnSelector.selectOption(column);
      }
    }

    if (options?.rowRange && await TestHelpers.elementExists(this.page, this.rowRangeInput.locator('').toString())) {
      await TestHelpers.safeType(this.page, this.rowRangeInput.locator('').toString(), options.rowRange);
    }

    if (options?.filter && await TestHelpers.elementExists(this.page, this.filterInput.locator('').toString())) {
      await TestHelpers.safeType(this.page, this.filterInput.locator('').toString(), options.filter);
    }

    // Click process button
    await TestHelpers.safeClick(this.page, this.processButton.locator('').toString());
    
    // Wait for processing to complete
    await this.page.waitForTimeout(3000);
  }

  /**
   * Download the processed file
   */
  async downloadFile(): Promise<any> {
    return await TestHelpers.waitForDownload(this.page, async () => {
      await TestHelpers.safeClick(this.page, this.downloadButton.locator('').toString());
    });
  }

  /**
   * Check if download button is available
   */
  async isDownloadReady(): Promise<boolean> {
    return await TestHelpers.elementExists(this.page, this.downloadButton.locator('').toString());
  }

  /**
   * Get file information
   */
  async getFileInfo(): Promise<{ name?: string; size?: string; type?: string }> {
    if (!await TestHelpers.elementExists(this.page, this.fileInfo.locator('').toString())) {
      return {};
    }

    const infoText = await TestHelpers.getTextContent(this.page, this.fileInfo.locator('').toString());
    
    // Parse file information (implementation depends on your UI)
    const info: { name?: string; size?: string; type?: string } = {};
    
    // Example parsing - adjust based on your actual file info format
    const lines = infoText.split('\n');
    for (const line of lines) {
      if (line.includes('Name:')) {
        info.name = line.split('Name:')[1]?.trim();
      }
      if (line.includes('Size:')) {
        info.size = line.split('Size:')[1]?.trim();
      }
      if (line.includes('Type:')) {
        info.type = line.split('Type:')[1]?.trim();
      }
    }

    return info;
  }

  /**
   * Delete uploaded file
   */
  async deleteFile() {
    if (await TestHelpers.elementExists(this.page, this.deleteFileButton.locator('').toString())) {
      await TestHelpers.safeClick(this.page, this.deleteFileButton.locator('').toString());
      await this.page.waitForTimeout(1000);
    }
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
   * Wait for upload area to be ready
   */
  async waitForUploadReady() {
    await this.fileInput.waitFor({ state: 'visible' });
  }

  /**
   * Validate file size before upload
   */
  async validateFileSize(sizeInBytes: number): Promise<boolean> {
    const maxSize = 50 * 1024 * 1024; // 50MB as per config
    return sizeInBytes <= maxSize;
  }

  /**
   * Get available column options
   */
  async getAvailableColumns(): Promise<string[]> {
    if (!await TestHelpers.elementExists(this.page, this.columnSelector.locator('').toString())) {
      return [];
    }

    const options = await this.columnSelector.locator('option').all();
    const columns: string[] = [];

    for (const option of options) {
      const text = await option.textContent();
      if (text?.trim()) {
        columns.push(text.trim());
      }
    }

    return columns;
  }
}
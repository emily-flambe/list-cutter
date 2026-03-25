/**
 * Simplified File Validator
 * 
 * Basic file validation without enterprise features like threat detection,
 * PII scanning, or compliance management.
 */

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  checkMagicBytes?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    size: number;
    type: string;
    extension: string;
    magicBytes?: string;
  };
}

export class FileValidationService {
  private defaultMaxSize = 50 * 1024 * 1024; // 50MB
  private allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/json'
  ];
  private allowedExtensions = ['.csv', '.txt', '.json', '.tsv'];

  // File signature magic bytes for type verification
  private magicBytes = new Map([
    ['csv', ['2C', '22', '0D0A', '0A']], // Common CSV patterns
    ['txt', ['54', '20', '0D0A', '0A']], // Text patterns
    ['json', ['7B', '5B']], // { or [
  ]);

  async validateFile(
    file: File,
    options: FileValidationOptions = {}
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const {
      maxSize = this.defaultMaxSize,
      allowedTypes = this.allowedMimeTypes,
      allowedExtensions = this.allowedExtensions,
      checkMagicBytes = false
    } = options;

    // Extract file info
    const extension = this.getFileExtension(file.name);
    const fileInfo = {
      size: file.size,
      type: file.type,
      extension,
      magicBytes: undefined as string | undefined
    };

    // Validate file size
    if (file.size > maxSize) {
      errors.push(`File size (${this.formatBytes(file.size)}) exceeds maximum allowed size (${this.formatBytes(maxSize)})`);
    }

    // Validate MIME type
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Validate extension
    if (!allowedExtensions.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`);
    }

    // Validate filename
    const filename = file.name;
    if (!this.isValidFilename(filename)) {
      errors.push('Filename contains invalid characters');
    }

    // Check magic bytes if requested
    if (checkMagicBytes && file.size > 0) {
      const magicBytesResult = await this.checkMagicBytes(file);
      fileInfo.magicBytes = magicBytesResult.hex;
      
      if (!magicBytesResult.valid) {
        warnings.push('File signature does not match expected type');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileInfo
    };
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot).toLowerCase();
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private isValidFilename(filename: string): boolean {
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    return !invalidChars.test(filename);
  }

  private async checkMagicBytes(file: File): Promise<{ valid: boolean; hex: string }> {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
    
    // Simple check - just return the hex, don't validate against type
    // In a production system, you'd check against known signatures
    return { valid: true, hex };
  }
}

// Export a singleton instance for convenience
export const fileValidator = new FileValidationService();

// Export the main validation function
export async function validateFile(
  file: File,
  options?: FileValidationOptions
): Promise<ValidationResult> {
  return fileValidator.validateFile(file, options);
}
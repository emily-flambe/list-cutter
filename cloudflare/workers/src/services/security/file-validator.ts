
export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  scanContent?: boolean;
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
  securityScan?: {
    threats: string[];
    risk: 'low' | 'medium' | 'high';
  };
}

export interface FileUploadLimits {
  maxFileSize: number;
  maxFilesPerHour: number;
  maxTotalSizePerHour: number;
}

/**
 * Comprehensive file validation and security service
 * Implements multiple layers of security for file uploads
 */
export class FileValidationService {
  private db: D1Database;
  private defaultMaxSize = 50 * 1024 * 1024; // 50MB
  private allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/json'
  ];
  private allowedExtensions = ['.csv', '.txt', '.json'];

  // File signature magic bytes for type verification
  private magicBytes = new Map([
    ['csv', ['2C', '22', '0D0A', '0A']], // Common CSV patterns
    ['txt', ['54', '20', '0D0A', '0A']], // Text patterns
    ['json', ['7B', '5B']], // { or [
  ]);

  // Suspicious patterns to scan for
  private suspiciousPatterns = [
    /<script[\s\S]*?>/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /<iframe[\s\S]*?>/i,
    /<embed[\s\S]*?>/i,
    /<object[\s\S]*?>/i,
    /eval\s*\(/i,
    /document\.write/i,
    /window\.location/i
  ];

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Validate a file upload comprehensively
   */
  async validateFile(
    file: File,
    userId: string,
    options: FileValidationOptions = {}
  ): Promise<ValidationResult> {
    const {
      maxSize = this.defaultMaxSize,
      allowedTypes = this.allowedMimeTypes,
      allowedExtensions = this.allowedExtensions,
      scanContent = true,
      checkMagicBytes = true
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic file info
    const fileInfo = {
      size: file.size,
      type: file.type,
      extension: this.getFileExtension(file.name),
      magicBytes: undefined as string | undefined
    };

    // Size validation
    if (file.size > maxSize) {
      errors.push(`File size ${this.formatSize(file.size)} exceeds maximum allowed size ${this.formatSize(maxSize)}`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // Type validation
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Extension validation
    if (!allowedExtensions.includes(fileInfo.extension.toLowerCase())) {
      errors.push(`File extension '${fileInfo.extension}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`);
    }

    // Filename validation
    const filenameValidation = this.validateFilename(file.name);
    if (!filenameValidation.valid) {
      errors.push(...filenameValidation.errors);
      warnings.push(...filenameValidation.warnings);
    }

    // Rate limiting check
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      errors.push(rateLimitCheck.reason || 'Rate limit exceeded');
    }

    // Content validation (if no critical errors so far)
    let securityScan: ValidationResult['securityScan'] | undefined;
    if (errors.length === 0 && scanContent) {
      try {
        const contentValidation = await this.validateFileContent(file, {
          checkMagicBytes,
          scanForThreats: true
        });

        if (!contentValidation.valid) {
          errors.push(...contentValidation.errors);
          warnings.push(...contentValidation.warnings);
        }

        if (contentValidation.magicBytes) {
          fileInfo.magicBytes = contentValidation.magicBytes;
        }

        securityScan = contentValidation.securityScan;
      } catch (error) {
        warnings.push(`Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileInfo,
      securityScan
    };
  }

  /**
   * Validate file content including magic bytes and threat scanning
   */
  private async validateFileContent(
    file: File,
    options: { checkMagicBytes: boolean; scanForThreats: boolean }
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    magicBytes?: string;
    securityScan?: ValidationResult['securityScan'];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let magicBytes: string | undefined;
    let securityScan: ValidationResult['securityScan'] | undefined;

    // Read file content (first few KB for analysis)
    const maxSampleSize = 8192; // 8KB should be enough for validation
    const arrayBuffer = await file.slice(0, maxSampleSize).arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Magic bytes validation
    if (options.checkMagicBytes) {
      magicBytes = Array.from(uint8Array.slice(0, 16))
        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
        .join('');

      const isValidMagicBytes = this.validateMagicBytes(file.name, magicBytes);
      if (!isValidMagicBytes) {
        warnings.push('File content does not match expected format based on extension');
      }
    }

    // Content threat scanning
    if (options.scanForThreats) {
      securityScan = await this.scanForThreats(uint8Array);
      
      if (securityScan.risk === 'high') {
        errors.push('File contains high-risk content and cannot be uploaded');
      } else if (securityScan.risk === 'medium') {
        warnings.push('File contains potentially suspicious content');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      magicBytes,
      securityScan
    };
  }

  /**
   * Validate filename for security issues
   */
  private validateFilename(filename: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Length check
    if (filename.length > 255) {
      errors.push('Filename is too long (maximum 255 characters)');
    }

    if (filename.length === 0) {
      errors.push('Filename cannot be empty');
    }

    // Character validation - check for invalid filename characters
    if (/[<>:"|?*]/.test(filename) || filename.charCodeAt(0) <= 31) {
      errors.push('Filename contains invalid characters');
    }

    // Path traversal check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('Filename cannot contain path traversal sequences');
    }

    // Reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const baseName = filename.split('.')[0].toUpperCase();
    if (reservedNames.includes(baseName)) {
      errors.push('Filename uses a reserved system name');
    }

    // Hidden file check
    if (filename.startsWith('.')) {
      warnings.push('Hidden files may not be processed correctly');
    }

    // Unicode validation
    try {
      // Check for problematic Unicode characters
      const normalized = filename.normalize('NFC');
      if (normalized !== filename) {
        warnings.push('Filename contains non-normalized Unicode characters');
      }
    } catch {
      errors.push('Filename contains invalid Unicode characters');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate magic bytes against expected file type
   */
  private validateMagicBytes(filename: string, magicBytes: string): boolean {
    const extension = this.getFileExtension(filename).toLowerCase().substring(1);
    const expectedPatterns = this.magicBytes.get(extension);
    
    if (!expectedPatterns) {
      return true; // No validation rules for this type
    }

    return expectedPatterns.some(pattern => magicBytes.startsWith(pattern));
  }

  /**
   * Scan file content for security threats
   */
  private async scanForThreats(content: Uint8Array): Promise<{
    threats: string[];
    risk: 'low' | 'medium' | 'high';
  }> {
    const threats: string[] = [];
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    
    try {
      // Convert to text for pattern matching
      const textContent = textDecoder.decode(content);
      
      // Scan for suspicious patterns
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(textContent)) {
          threats.push(`Suspicious pattern detected: ${pattern.source}`);
        }
      }

      // Check for embedded files or suspicious binary content
      if (this.containsBinaryExecutable(content)) {
        threats.push('File may contain embedded executable content');
      }

      // Check for excessive special characters (possible obfuscation)
      const specialCharRatio = this.calculateSpecialCharRatio(textContent);
      if (specialCharRatio > 0.3) {
        threats.push('High ratio of special characters detected (possible obfuscation)');
      }

      // Determine risk level
      let risk: 'low' | 'medium' | 'high' = 'low';
      if (threats.length > 0) {
        const highRiskPatterns = ['script', 'executable', 'obfuscation'];
        const hasHighRisk = threats.some(threat => 
          highRiskPatterns.some(pattern => threat.toLowerCase().includes(pattern))
        );
        
        risk = hasHighRisk ? 'high' : 'medium';
      }

      return { threats, risk };
    } catch {
      // If we can't decode the content, treat it as suspicious
      return {
        threats: ['Unable to decode file content'],
        risk: 'medium'
      };
    }
  }

  /**
   * Check if content contains binary executable signatures
   */
  private containsBinaryExecutable(content: Uint8Array): boolean {
    const executableSignatures = [
      [0x4D, 0x5A], // PE executable (MZ)
      [0x7F, 0x45, 0x4C, 0x46], // ELF executable
      [0xCA, 0xFE, 0xBA, 0xBE], // Mach-O executable
      [0x50, 0x4B, 0x03, 0x04], // ZIP (could contain executables)
    ];

    for (const signature of executableSignatures) {
      if (content.length >= signature.length) {
        let matches = true;
        for (let i = 0; i < signature.length; i++) {
          if (content[i] !== signature[i]) {
            matches = false;
            break;
          }
        }
        if (matches) return true;
      }
    }

    return false;
  }

  /**
   * Calculate ratio of special characters to total characters
   */
  private calculateSpecialCharRatio(text: string): number {
    const specialCharCount = (text.match(/[^\w\s.,;:!?\-'"]/g) || []).length;
    return text.length > 0 ? specialCharCount / text.length : 0;
  }

  /**
   * Check rate limiting for user uploads
   */
  private async checkRateLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get user's uploads in the last hour
    const recentUploads = await this.db
      .prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
        FROM files 
        WHERE user_id = ? AND created_at > ?
      `)
      .bind(userId, oneHourAgo.toISOString())
      .first();

    const uploadCount = recentUploads?.count as number || 0;
    const totalSize = recentUploads?.total_size as number || 0;

    // Default limits (these could be made configurable per user)
    const limits: FileUploadLimits = {
      maxFileSize: this.defaultMaxSize,
      maxFilesPerHour: 100,
      maxTotalSizePerHour: 500 * 1024 * 1024 // 500MB
    };

    if (uploadCount >= limits.maxFilesPerHour) {
      return {
        allowed: false,
        reason: `Upload limit exceeded: ${uploadCount}/${limits.maxFilesPerHour} files per hour`
      };
    }

    if (totalSize >= limits.maxTotalSizePerHour) {
      return {
        allowed: false,
        reason: `Size limit exceeded: ${this.formatSize(totalSize)}/${this.formatSize(limits.maxTotalSizePerHour)} per hour`
      };
    }

    return { allowed: true };
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
  }

  /**
   * Format file size for human reading
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Sanitize filename for safe storage
   */
  sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters
    let sanitized = filename
      .replace(/[<>:"|?*]/g, '_')
      .split('')
      .map(char => char.charCodeAt(0) <= 31 ? '_' : char)
      .join('')
      .replace(/\.\./g, '_')
      .replace(/[/\\]/g, '_');

    // Ensure it doesn't start with a dot
    if (sanitized.startsWith('.')) {
      sanitized = '_' + sanitized.substring(1);
    }

    // Limit length
    if (sanitized.length > 255) {
      const extension = this.getFileExtension(sanitized);
      const baseName = sanitized.substring(0, 255 - extension.length);
      sanitized = baseName + extension;
    }

    return sanitized;
  }

  /**
   * Generate secure file ID
   */
  generateSecureFileId(): string {
    // Use crypto.randomUUID() for cryptographically secure random ID
    return crypto.randomUUID();
  }
}
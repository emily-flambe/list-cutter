import type { Env } from '../../types';
import { ApiError } from '../../middleware/error';
import { createBackupService } from '../backup/r2-backup';
import { convertToCSV, convertToXML, validateExportFormat } from './export-formats';
import { R2BackupService } from '../backup/r2-backup';

export interface DataExportConfig {
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  maxExportSize: number;
  retentionDays: number;
  allowedFormats: ExportFormat[];
}

export type ExportFormat = 'json' | 'csv' | 'xml';
export type ExportType = 'user_data' | 'bulk_data' | 'system_data';
export type ExportScope = 'user' | 'admin' | 'system';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

export interface ExportMetadata {
  id: string;
  userId?: number;
  exportType: ExportType;
  format: ExportFormat;
  scope: ExportScope;
  status: ExportStatus;
  filePath: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  compressionRatio?: number;
  checksum: string;
  parameters: string; // JSON string of export parameters
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
  errorMessage?: string;
  downloadCount: number;
  lastDownloadedAt?: string;
}

export interface ExportRequest {
  id: string;
  userId: number;
  requestType: ExportType;
  format: ExportFormat;
  scope: ExportScope;
  parameters: string; // JSON string
  status: ExportStatus;
  priority: number;
  scheduledAt?: string;
  createdAt: string;
  processedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ExportLog {
  id: number;
  exportId: string;
  timestamp: string;
  eventType: 'start' | 'progress' | 'complete' | 'error' | 'download' | 'expire';
  message: string;
  level: 'info' | 'warn' | 'error';
  details?: string; // JSON string
}

export interface ExportOptions {
  includeMetadata?: boolean;
  includeSystemFields?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: Record<string, any>;
  fieldSelection?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  compression?: boolean;
  encryption?: boolean;
}

export interface UserDataExportResult {
  files: Array<{
    fileId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedAt: string;
    systemTags: string[];
    userTags: string[];
    metadata?: Record<string, any>;
  }>;
  userData: {
    userId: number;
    username: string;
    email?: string;
    createdAt: string;
    fileCount: number;
    totalStorageUsed: number;
    lastLoginAt?: string;
  };
  exportMetadata: {
    exportId: string;
    exportDate: string;
    exportType: ExportType;
    format: ExportFormat;
    totalRecords: number;
    checksum: string;
  };
}

export interface BulkDataExportResult {
  users: Array<{
    userId: number;
    username: string;
    email?: string;
    createdAt: string;
    fileCount: number;
    totalStorageUsed: number;
    lastLoginAt?: string;
  }>;
  files: Array<{
    fileId: string;
    userId: number;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedAt: string;
    systemTags: string[];
    userTags: string[];
    metadata?: Record<string, any>;
  }>;
  statistics: {
    totalUsers: number;
    totalFiles: number;
    totalStorageUsed: number;
    exportDate: string;
    exportId: string;
    checksum: string;
  };
}

export interface ExportVerificationResult {
  success: boolean;
  checksumMatch: boolean;
  fileExists: boolean;
  fileSizeMatch: boolean;
  recordCountMatch: boolean;
  formatValid: boolean;
  errorDetails?: string[];
}

export class DataExportService {
  private env: Env;
  private config: DataExportConfig;
  private backupService: R2BackupService;

  constructor(env: Env, config: DataExportConfig) {
    this.env = env;
    this.config = config;
    this.backupService = createBackupService(env);
  }

  /**
   * Export user data in the specified format
   */
  async exportUserData(
    userId: number,
    format: ExportFormat,
    options: ExportOptions = {}
  ): Promise<ExportMetadata> {
    const exportId = this.generateExportId();
    const exportDate = new Date().toISOString();
    const fileName = `user_data_${userId}_${Date.now()}.${format}`;
    const filePath = `exports/user/${exportId}/${fileName}`;
    const expiresAt = new Date(Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const metadata: ExportMetadata = {
      id: exportId,
      userId,
      exportType: 'user_data',
      format,
      scope: 'user',
      status: 'pending',
      filePath,
      fileName,
      fileSize: 0,
      recordCount: 0,
      checksum: '',
      parameters: JSON.stringify(options),
      createdAt: exportDate,
      expiresAt,
      downloadCount: 0
    };

    try {
      // Insert export metadata
      await this.insertExportMetadata(metadata);
      await this.logExportEvent(exportId, 'start', 'Starting user data export', 'info');

      // Update status to processing
      metadata.status = 'processing';
      await this.updateExportMetadata(metadata);

      // Collect user data
      const userData = await this.collectUserData(userId, options);
      
      // Convert to requested format
      let exportContent: string;
      switch (format) {
        case 'json':
          exportContent = JSON.stringify(userData, null, 2);
          break;
        case 'csv':
          exportContent = convertToCSV(userData);
          break;
        case 'xml':
          exportContent = convertToXML(userData);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Apply compression if enabled
      if (options.compression || this.config.compressionEnabled) {
        exportContent = await this.compressContent(exportContent);
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(exportContent);
      
      // Store in R2
      await this.env.R2_BUCKET.put(filePath, exportContent, {
        httpMetadata: {
          contentType: this.getContentType(format),
          contentEncoding: options.compression ? 'gzip' : undefined
        }
      });

      // Update metadata
      metadata.status = 'completed';
      metadata.fileSize = Buffer.byteLength(exportContent);
      metadata.recordCount = userData.files.length;
      metadata.checksum = checksum;
      metadata.completedAt = new Date().toISOString();

      if (options.compression) {
        metadata.compressionRatio = Buffer.byteLength(JSON.stringify(userData)) / metadata.fileSize;
      }

      await this.updateExportMetadata(metadata);
      await this.logExportEvent(
        exportId,
        'complete',
        `User data export completed: ${metadata.recordCount} records, ${metadata.fileSize} bytes`,
        'info'
      );

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metadata.completedAt = new Date().toISOString();
      
      await this.updateExportMetadata(metadata);
      await this.logExportEvent(exportId, 'error', `Export failed: ${error}`, 'error');
      
      throw new ApiError(500, `Export failed: ${error}`);
    }
  }

  /**
   * Export bulk data for administrators
   */
  async exportBulkData(
    adminUserId: number,
    format: ExportFormat,
    options: ExportOptions = {}
  ): Promise<ExportMetadata> {
    const exportId = this.generateExportId();
    const exportDate = new Date().toISOString();
    const fileName = `bulk_data_${Date.now()}.${format}`;
    const filePath = `exports/bulk/${exportId}/${fileName}`;
    const expiresAt = new Date(Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const metadata: ExportMetadata = {
      id: exportId,
      userId: adminUserId,
      exportType: 'bulk_data',
      format,
      scope: 'admin',
      status: 'pending',
      filePath,
      fileName,
      fileSize: 0,
      recordCount: 0,
      checksum: '',
      parameters: JSON.stringify(options),
      createdAt: exportDate,
      expiresAt,
      downloadCount: 0
    };

    try {
      // Insert export metadata
      await this.insertExportMetadata(metadata);
      await this.logExportEvent(exportId, 'start', 'Starting bulk data export', 'info');

      // Update status to processing
      metadata.status = 'processing';
      await this.updateExportMetadata(metadata);

      // Collect bulk data
      const bulkData = await this.collectBulkData(options);
      
      // Convert to requested format
      let exportContent: string;
      switch (format) {
        case 'json':
          exportContent = JSON.stringify(bulkData, null, 2);
          break;
        case 'csv':
          exportContent = convertToCSV(bulkData);
          break;
        case 'xml':
          exportContent = convertToXML(bulkData);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Apply compression if enabled
      if (options.compression || this.config.compressionEnabled) {
        exportContent = await this.compressContent(exportContent);
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(exportContent);
      
      // Store in R2
      await this.env.R2_BUCKET.put(filePath, exportContent, {
        httpMetadata: {
          contentType: this.getContentType(format),
          contentEncoding: options.compression ? 'gzip' : undefined
        }
      });

      // Update metadata
      metadata.status = 'completed';
      metadata.fileSize = Buffer.byteLength(exportContent);
      metadata.recordCount = bulkData.users.length + bulkData.files.length;
      metadata.checksum = checksum;
      metadata.completedAt = new Date().toISOString();

      if (options.compression) {
        metadata.compressionRatio = Buffer.byteLength(JSON.stringify(bulkData)) / metadata.fileSize;
      }

      await this.updateExportMetadata(metadata);
      await this.logExportEvent(
        exportId,
        'complete',
        `Bulk data export completed: ${metadata.recordCount} records, ${metadata.fileSize} bytes`,
        'info'
      );

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metadata.completedAt = new Date().toISOString();
      
      await this.updateExportMetadata(metadata);
      await this.logExportEvent(exportId, 'error', `Bulk export failed: ${error}`, 'error');
      
      throw new ApiError(500, `Bulk export failed: ${error}`);
    }
  }

  /**
   * Schedule automatic export
   */
  async scheduleExport(
    userId: number,
    exportType: ExportType,
    format: ExportFormat,
    options: ExportOptions & { scheduledAt?: string } = {}
  ): Promise<ExportRequest> {
    const requestId = this.generateExportId();
    const request: ExportRequest = {
      id: requestId,
      userId,
      requestType: exportType,
      format,
      scope: exportType === 'bulk_data' ? 'admin' : 'user',
      parameters: JSON.stringify(options),
      status: 'pending',
      priority: 1,
      scheduledAt: options.scheduledAt,
      createdAt: new Date().toISOString()
    };

    await this.insertExportRequest(request);
    await this.logExportEvent(requestId, 'start', 'Export request scheduled', 'info');

    return request;
  }

  /**
   * Process scheduled export requests
   */
  async processScheduledExports(): Promise<void> {
    const now = new Date().toISOString();
    
    const pendingRequests = await this.env.DB.prepare(`
      SELECT * FROM export_requests 
      WHERE status = 'pending' 
      AND (scheduled_at IS NULL OR scheduled_at <= ?)
      ORDER BY priority DESC, created_at ASC
      LIMIT 10
    `).bind(now).all();

    for (const request of pendingRequests.results as ExportRequest[]) {
      try {
        await this.processExportRequest(request);
      } catch (error) {
        console.error(`Failed to process export request ${request.id}:`, error);
        
        // Update request status to failed
        await this.env.DB.prepare(`
          UPDATE export_requests 
          SET status = 'failed', error_message = ?, processed_at = ?
          WHERE id = ?
        `).bind(
          error instanceof Error ? error.message : 'Unknown error',
          new Date().toISOString(),
          request.id
        ).run();
      }
    }
  }

  /**
   * Verify export integrity
   */
  async verifyExport(exportId: string): Promise<ExportVerificationResult> {
    const metadata = await this.getExportMetadata(exportId);
    if (!metadata) {
      throw new ApiError(404, 'Export not found');
    }

    const result: ExportVerificationResult = {
      success: true,
      checksumMatch: false,
      fileExists: false,
      fileSizeMatch: false,
      recordCountMatch: false,
      formatValid: false,
      errorDetails: []
    };

    try {
      // Check if file exists
      const exportObject = await this.env.R2_BUCKET.get(metadata.filePath);
      if (!exportObject) {
        result.fileExists = false;
        result.success = false;
        result.errorDetails?.push('Export file not found');
        return result;
      }
      result.fileExists = true;

      // Check file size
      const actualSize = exportObject.size;
      result.fileSizeMatch = actualSize === metadata.fileSize;
      if (!result.fileSizeMatch) {
        result.success = false;
        result.errorDetails?.push(`File size mismatch: expected ${metadata.fileSize}, actual ${actualSize}`);
      }

      // Verify checksum
      const content = await exportObject.arrayBuffer();
      const calculatedChecksum = await this.calculateChecksum(content);
      result.checksumMatch = calculatedChecksum === metadata.checksum;
      if (!result.checksumMatch) {
        result.success = false;
        result.errorDetails?.push('Checksum verification failed');
      }

      // Validate format
      const contentText = new TextDecoder().decode(content);
      result.formatValid = validateExportFormat(contentText, metadata.format);
      if (!result.formatValid) {
        result.success = false;
        result.errorDetails?.push('Export format validation failed');
      }

      // Log verification result
      await this.logExportEvent(
        exportId,
        'complete',
        result.success ? 'Export verification passed' : 'Export verification failed',
        result.success ? 'info' : 'error',
        JSON.stringify(result)
      );

      return result;
    } catch (error) {
      result.success = false;
      result.errorDetails?.push(`Verification error: ${error}`);
      
      await this.logExportEvent(
        exportId,
        'error',
        `Export verification failed: ${error}`,
        'error'
      );
      
      return result;
    }
  }

  /**
   * Get export download URL
   */
  async getExportDownloadUrl(exportId: string, userId?: number): Promise<string> {
    const metadata = await this.getExportMetadata(exportId);
    if (!metadata) {
      throw new ApiError(404, 'Export not found');
    }

    // Check permissions
    if (metadata.userId && metadata.userId !== userId) {
      throw new ApiError(403, 'Access denied');
    }

    // Check if export is expired
    if (new Date(metadata.expiresAt) < new Date()) {
      throw new ApiError(410, 'Export has expired');
    }

    // Check if export is completed
    if (metadata.status !== 'completed') {
      throw new ApiError(400, 'Export is not ready for download');
    }

    // Update download count
    await this.env.DB.prepare(`
      UPDATE data_exports 
      SET download_count = download_count + 1, last_downloaded_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), exportId).run();

    // Log download event
    await this.logExportEvent(exportId, 'download', 'Export downloaded', 'info');

    // Generate signed URL (this would typically be a signed URL for security)
    return `/api/exports/${exportId}/download`;
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<void> {
    const now = new Date().toISOString();
    
    const expiredExports = await this.env.DB.prepare(`
      SELECT * FROM data_exports WHERE expires_at < ?
    `).bind(now).all();

    for (const exportData of expiredExports.results as ExportMetadata[]) {
      try {
        // Delete file from R2
        await this.env.R2_BUCKET.delete(exportData.filePath);
        
        // Delete from database
        await this.env.DB.prepare(`DELETE FROM data_exports WHERE id = ?`).bind(exportData.id).run();
        
        // Log cleanup
        await this.logExportEvent(
          exportData.id,
          'expire',
          'Export cleaned up (expired)',
          'info'
        );
      } catch (error) {
        console.error(`Failed to cleanup export ${exportData.id}:`, error);
      }
    }
  }

  /**
   * Get export statistics
   */
  async getExportStats(userId?: number): Promise<{
    totalExports: number;
    completedExports: number;
    failedExports: number;
    totalSize: number;
    averageSize: number;
    lastExportDate?: string;
    successRate: number;
  }> {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'completed' THEN file_size ELSE 0 END) as total_size,
        AVG(CASE WHEN status = 'completed' THEN file_size ELSE NULL END) as avg_size,
        MAX(CASE WHEN status = 'completed' THEN created_at ELSE NULL END) as last_export
      FROM data_exports
    `;
    
    const params: any[] = [];
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    const result = await this.env.DB.prepare(query).bind(...params).first();

    return {
      totalExports: result?.total || 0,
      completedExports: result?.completed || 0,
      failedExports: result?.failed || 0,
      totalSize: result?.total_size || 0,
      averageSize: result?.avg_size || 0,
      lastExportDate: result?.last_export,
      successRate: result?.total ? (result.completed / result.total) * 100 : 0
    };
  }

  // Private helper methods

  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async collectUserData(userId: number, options: ExportOptions): Promise<UserDataExportResult> {
    // Get user data
    const userData = await this.env.DB.prepare(`
      SELECT id, username, email, created_at 
      FROM auth_user 
      WHERE id = ?
    `).bind(userId).first();

    if (!userData) {
      throw new Error('User not found');
    }

    // Get user files
    let filesQuery = `
      SELECT file_id, file_name, file_path, uploaded_at, system_tags, user_tags, metadata 
      FROM saved_files 
      WHERE user_id = ?
    `;
    const params: any[] = [userId];

    // Apply date range filter
    if (options.dateRange) {
      filesQuery += ' AND uploaded_at BETWEEN ? AND ?';
      params.push(options.dateRange.start, options.dateRange.end);
    }

    // Apply field selection
    if (options.fieldSelection) {
      filesQuery = `SELECT ${options.fieldSelection.join(', ')} FROM saved_files WHERE user_id = ?`;
    }

    // Apply sorting
    if (options.sortBy) {
      filesQuery += ` ORDER BY ${options.sortBy} ${options.sortOrder || 'ASC'}`;
    }

    // Apply limit
    if (options.limit) {
      filesQuery += ` LIMIT ${options.limit}`;
    }

    const files = await this.env.DB.prepare(filesQuery).bind(...params).all();

    // Calculate statistics
    const fileStats = await this.env.DB.prepare(`
      SELECT COUNT(*) as file_count, SUM(file_size) as total_size
      FROM saved_files 
      WHERE user_id = ?
    `).bind(userId).first();

    return {
      files: files.results.map((file: any) => ({
        fileId: file.file_id,
        fileName: file.file_name,
        filePath: file.file_path,
        fileSize: file.file_size || 0,
        uploadedAt: file.uploaded_at,
        systemTags: JSON.parse(file.system_tags || '[]'),
        userTags: JSON.parse(file.user_tags || '[]'),
        metadata: file.metadata ? JSON.parse(file.metadata) : undefined
      })),
      userData: {
        userId: userData.id,
        username: userData.username,
        email: userData.email,
        createdAt: userData.created_at,
        fileCount: fileStats?.file_count || 0,
        totalStorageUsed: fileStats?.total_size || 0
      },
      exportMetadata: {
        exportId: this.generateExportId(),
        exportDate: new Date().toISOString(),
        exportType: 'user_data',
        format: 'json',
        totalRecords: files.results.length,
        checksum: ''
      }
    };
  }

  private async collectBulkData(options: ExportOptions): Promise<BulkDataExportResult> {
    // Get all users
    let usersQuery = `
      SELECT id, username, email, created_at 
      FROM auth_user
    `;
    const userParams: any[] = [];

    // Apply date range filter
    if (options.dateRange) {
      usersQuery += ' WHERE created_at BETWEEN ? AND ?';
      userParams.push(options.dateRange.start, options.dateRange.end);
    }

    // Apply sorting
    if (options.sortBy) {
      usersQuery += ` ORDER BY ${options.sortBy} ${options.sortOrder || 'ASC'}`;
    }

    // Apply limit
    if (options.limit) {
      usersQuery += ` LIMIT ${options.limit}`;
    }

    const users = await this.env.DB.prepare(usersQuery).bind(...userParams).all();

    // Get all files
    let filesQuery = `
      SELECT sf.file_id, sf.user_id, sf.file_name, sf.file_path, sf.uploaded_at, 
             sf.system_tags, sf.user_tags, sf.metadata
      FROM saved_files sf
      JOIN auth_user au ON sf.user_id = au.id
    `;
    const fileParams: any[] = [];

    // Apply date range filter
    if (options.dateRange) {
      filesQuery += ' WHERE sf.uploaded_at BETWEEN ? AND ?';
      fileParams.push(options.dateRange.start, options.dateRange.end);
    }

    // Apply sorting
    if (options.sortBy) {
      filesQuery += ` ORDER BY sf.${options.sortBy} ${options.sortOrder || 'ASC'}`;
    }

    // Apply limit
    if (options.limit) {
      filesQuery += ` LIMIT ${options.limit}`;
    }

    const files = await this.env.DB.prepare(filesQuery).bind(...fileParams).all();

    // Calculate statistics
    const stats = await this.env.DB.prepare(`
      SELECT 
        COUNT(DISTINCT au.id) as total_users,
        COUNT(sf.file_id) as total_files,
        SUM(sf.file_size) as total_storage
      FROM auth_user au
      LEFT JOIN saved_files sf ON au.id = sf.user_id
    `).first();

    return {
      users: users.results.map((user: any) => ({
        userId: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
        fileCount: 0, // This would be calculated in a real implementation
        totalStorageUsed: 0
      })),
      files: files.results.map((file: any) => ({
        fileId: file.file_id,
        userId: file.user_id,
        fileName: file.file_name,
        filePath: file.file_path,
        fileSize: file.file_size || 0,
        uploadedAt: file.uploaded_at,
        systemTags: JSON.parse(file.system_tags || '[]'),
        userTags: JSON.parse(file.user_tags || '[]'),
        metadata: file.metadata ? JSON.parse(file.metadata) : undefined
      })),
      statistics: {
        totalUsers: stats?.total_users || 0,
        totalFiles: stats?.total_files || 0,
        totalStorageUsed: stats?.total_storage || 0,
        exportDate: new Date().toISOString(),
        exportId: this.generateExportId(),
        checksum: ''
      }
    };
  }

  private async processExportRequest(request: ExportRequest): Promise<void> {
    const options = JSON.parse(request.parameters) as ExportOptions;
    
    // Update status to processing
    await this.env.DB.prepare(`
      UPDATE export_requests 
      SET status = 'processing', processed_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), request.id).run();

    try {
      let result: ExportMetadata;
      
      if (request.requestType === 'user_data') {
        result = await this.exportUserData(request.userId, request.format, options);
      } else if (request.requestType === 'bulk_data') {
        result = await this.exportBulkData(request.userId, request.format, options);
      } else {
        throw new Error(`Unsupported export type: ${request.requestType}`);
      }

      // Update request status to completed
      await this.env.DB.prepare(`
        UPDATE export_requests 
        SET status = 'completed', completed_at = ?
        WHERE id = ?
      `).bind(new Date().toISOString(), request.id).run();

    } catch (error) {
      // Update request status to failed
      await this.env.DB.prepare(`
        UPDATE export_requests 
        SET status = 'failed', error_message = ?, completed_at = ?
        WHERE id = ?
      `).bind(
        error instanceof Error ? error.message : 'Unknown error',
        new Date().toISOString(),
        request.id
      ).run();
      
      throw error;
    }
  }

  private async compressContent(content: string): Promise<string> {
    // In a real implementation, this would use a compression library
    // For now, we'll return the content as-is
    return content;
  }

  private async calculateChecksum(data: ArrayBuffer | string): Promise<string> {
    const encoder = new TextEncoder();
    const dataArray = typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataArray);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private getContentType(format: ExportFormat): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'xml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }

  // Database operations

  private async insertExportMetadata(metadata: ExportMetadata): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO data_exports (
        id, user_id, export_type, format, scope, status, file_path, file_name,
        file_size, record_count, compression_ratio, checksum, parameters,
        created_at, completed_at, expires_at, error_message, download_count, last_downloaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metadata.id,
      metadata.userId,
      metadata.exportType,
      metadata.format,
      metadata.scope,
      metadata.status,
      metadata.filePath,
      metadata.fileName,
      metadata.fileSize,
      metadata.recordCount,
      metadata.compressionRatio,
      metadata.checksum,
      metadata.parameters,
      metadata.createdAt,
      metadata.completedAt,
      metadata.expiresAt,
      metadata.errorMessage,
      metadata.downloadCount,
      metadata.lastDownloadedAt
    ).run();
  }

  private async updateExportMetadata(metadata: ExportMetadata): Promise<void> {
    await this.env.DB.prepare(`
      UPDATE data_exports 
      SET status = ?, file_size = ?, record_count = ?, compression_ratio = ?, 
          checksum = ?, completed_at = ?, error_message = ?
      WHERE id = ?
    `).bind(
      metadata.status,
      metadata.fileSize,
      metadata.recordCount,
      metadata.compressionRatio,
      metadata.checksum,
      metadata.completedAt,
      metadata.errorMessage,
      metadata.id
    ).run();
  }

  private async getExportMetadata(exportId: string): Promise<ExportMetadata | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM data_exports WHERE id = ?
    `).bind(exportId).first();

    return result as ExportMetadata | null;
  }

  private async insertExportRequest(request: ExportRequest): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO export_requests (
        id, user_id, request_type, format, scope, parameters, status, priority,
        scheduled_at, created_at, processed_at, completed_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      request.id,
      request.userId,
      request.requestType,
      request.format,
      request.scope,
      request.parameters,
      request.status,
      request.priority,
      request.scheduledAt,
      request.createdAt,
      request.processedAt,
      request.completedAt,
      request.errorMessage
    ).run();
  }

  private async logExportEvent(
    exportId: string,
    eventType: string,
    message: string,
    level: 'info' | 'warn' | 'error',
    details?: string
  ): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO export_logs (export_id, timestamp, event_type, message, level, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(exportId, new Date().toISOString(), eventType, message, level, details).run();
  }
}

// Factory function to create export service with default configuration
export function createExportService(env: Env): DataExportService {
  const config: DataExportConfig = {
    compressionEnabled: true,
    encryptionEnabled: false,
    maxExportSize: 100 * 1024 * 1024, // 100MB
    retentionDays: 7,
    allowedFormats: ['json', 'csv', 'xml']
  };

  return new DataExportService(env, config);
}
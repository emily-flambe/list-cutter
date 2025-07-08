import type { Env } from '../../types';
import { ApiError } from '../../middleware/error';

export interface BackupConfig {
  bucketName: string;
  retentionDays: number;
  incrementalEnabled: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface BackupMetadata {
  id: string;
  bucketName: string;
  backupDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  fileCount: number;
  totalSize: number;
  checksum: string;
  backupType: 'full' | 'incremental';
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface BackupFile {
  backupId: string;
  filePath: string;
  fileSize: number;
  checksum: string;
  status: 'pending' | 'backed_up' | 'failed';
  backupPath: string;
  createdAt: string;
}

export interface BackupLog {
  backupId: string;
  timestamp: string;
  eventType: 'start' | 'progress' | 'complete' | 'error' | 'verify';
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface BackupVerificationResult {
  success: boolean;
  verifiedFiles: number;
  totalFiles: number;
  corruptedFiles: string[];
  missingFiles: string[];
  checksumMismatches: string[];
}

export interface RestoreOptions {
  targetBucket?: string;
  overwriteExisting?: boolean;
  verifyAfterRestore?: boolean;
  filters?: {
    pathPrefix?: string;
    fileExtensions?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

export class R2BackupService {
  private env: Env;
  private config: BackupConfig;
  private backupBucket: R2Bucket;

  constructor(env: Env, config: BackupConfig) {
    this.env = env;
    this.config = config;
    this.backupBucket = env.R2_BACKUP_BUCKET;
  }

  /**
   * Create a full backup of the main R2 bucket
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const backupDate = new Date().toISOString();
    
    const metadata: BackupMetadata = {
      id: backupId,
      bucketName: this.config.bucketName,
      backupDate,
      status: 'pending',
      fileCount: 0,
      totalSize: 0,
      checksum: '',
      backupType: 'full',
      createdAt: backupDate
    };

    try {
      await this.insertBackupMetadata(metadata);
      await this.logBackupEvent(backupId, 'start', 'Starting full backup', 'info');

      // Set status to in_progress
      metadata.status = 'in_progress';
      await this.updateBackupMetadata(metadata);

      // Get all files from source bucket
      const files = await this.listAllFiles(this.env.R2_BUCKET);
      metadata.fileCount = files.length;

      let totalSize = 0;
      let backedUpFiles = 0;
      const checksumData: string[] = [];

      for (const file of files) {
        try {
          const backupResult = await this.backupFile(
            file.key,
            backupId,
            this.env.R2_BUCKET,
            this.backupBucket
          );

          if (backupResult.success) {
            totalSize += backupResult.size;
            backedUpFiles++;
            checksumData.push(backupResult.checksum);

            await this.insertBackupFile({
              backupId,
              filePath: file.key,
              fileSize: backupResult.size,
              checksum: backupResult.checksum,
              status: 'backed_up',
              backupPath: backupResult.backupPath,
              createdAt: new Date().toISOString()
            });
          } else {
            await this.insertBackupFile({
              backupId,
              filePath: file.key,
              fileSize: 0,
              checksum: '',
              status: 'failed',
              backupPath: '',
              createdAt: new Date().toISOString()
            });
          }

          // Log progress every 100 files
          if (backedUpFiles % 100 === 0) {
            await this.logBackupEvent(
              backupId,
              'progress',
              `Backed up ${backedUpFiles}/${files.length} files`,
              'info'
            );
          }
        } catch (error) {
          await this.logBackupEvent(
            backupId,
            'error',
            `Failed to backup file ${file.key}: ${error}`,
            'error'
          );
        }
      }

      // Calculate overall checksum
      const overallChecksum = await this.calculateChecksum(checksumData.join(''));
      
      metadata.status = 'completed';
      metadata.totalSize = totalSize;
      metadata.checksum = overallChecksum;
      metadata.completedAt = new Date().toISOString();

      await this.updateBackupMetadata(metadata);
      await this.logBackupEvent(
        backupId,
        'complete',
        `Full backup completed: ${backedUpFiles}/${files.length} files, ${totalSize} bytes`,
        'info'
      );

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metadata.completedAt = new Date().toISOString();
      
      await this.updateBackupMetadata(metadata);
      await this.logBackupEvent(backupId, 'error', `Backup failed: ${error}`, 'error');
      
      throw new ApiError(500, `Backup failed: ${error}`);
    }
  }

  /**
   * Create an incremental backup based on the last full backup
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    if (!this.config.incrementalEnabled) {
      throw new ApiError(400, 'Incremental backups are disabled');
    }

    const lastBackup = await this.getLastSuccessfulBackup();
    if (!lastBackup) {
      throw new ApiError(400, 'No previous backup found. Please create a full backup first');
    }

    const backupId = this.generateBackupId();
    const backupDate = new Date().toISOString();
    
    const metadata: BackupMetadata = {
      id: backupId,
      bucketName: this.config.bucketName,
      backupDate,
      status: 'pending',
      fileCount: 0,
      totalSize: 0,
      checksum: '',
      backupType: 'incremental',
      createdAt: backupDate
    };

    try {
      await this.insertBackupMetadata(metadata);
      await this.logBackupEvent(backupId, 'start', 'Starting incremental backup', 'info');

      metadata.status = 'in_progress';
      await this.updateBackupMetadata(metadata);

      // Get files modified since last backup
      const modifiedFiles = await this.getModifiedFilesSince(lastBackup.backupDate);
      metadata.fileCount = modifiedFiles.length;

      let totalSize = 0;
      let backedUpFiles = 0;
      const checksumData: string[] = [];

      for (const file of modifiedFiles) {
        try {
          const backupResult = await this.backupFile(
            file.key,
            backupId,
            this.env.R2_BUCKET,
            this.backupBucket
          );

          if (backupResult.success) {
            totalSize += backupResult.size;
            backedUpFiles++;
            checksumData.push(backupResult.checksum);

            await this.insertBackupFile({
              backupId,
              filePath: file.key,
              fileSize: backupResult.size,
              checksum: backupResult.checksum,
              status: 'backed_up',
              backupPath: backupResult.backupPath,
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          await this.logBackupEvent(
            backupId,
            'error',
            `Failed to backup file ${file.key}: ${error}`,
            'error'
          );
        }
      }

      const overallChecksum = await this.calculateChecksum(checksumData.join(''));
      
      metadata.status = 'completed';
      metadata.totalSize = totalSize;
      metadata.checksum = overallChecksum;
      metadata.completedAt = new Date().toISOString();

      await this.updateBackupMetadata(metadata);
      await this.logBackupEvent(
        backupId,
        'complete',
        `Incremental backup completed: ${backedUpFiles} files, ${totalSize} bytes`,
        'info'
      );

      return metadata;
    } catch (error) {
      metadata.status = 'failed';
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metadata.completedAt = new Date().toISOString();
      
      await this.updateBackupMetadata(metadata);
      await this.logBackupEvent(backupId, 'error', `Incremental backup failed: ${error}`, 'error');
      
      throw new ApiError(500, `Incremental backup failed: ${error}`);
    }
  }

  /**
   * Verify the integrity of a backup
   */
  async verifyBackup(backupId: string): Promise<BackupVerificationResult> {
    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) {
      throw new ApiError(404, 'Backup not found');
    }

    const backupFiles = await this.getBackupFiles(backupId);
    const result: BackupVerificationResult = {
      success: true,
      verifiedFiles: 0,
      totalFiles: backupFiles.length,
      corruptedFiles: [],
      missingFiles: [],
      checksumMismatches: []
    };

    await this.logBackupEvent(backupId, 'verify', 'Starting backup verification', 'info');

    for (const file of backupFiles) {
      try {
        const backupObject = await this.backupBucket.get(file.backupPath);
        
        if (!backupObject) {
          result.missingFiles.push(file.filePath);
          result.success = false;
          continue;
        }

        // Verify checksum
        const content = await backupObject.arrayBuffer();
        const calculatedChecksum = await this.calculateChecksum(content);
        
        if (calculatedChecksum !== file.checksum) {
          result.checksumMismatches.push(file.filePath);
          result.success = false;
          continue;
        }

        result.verifiedFiles++;
      } catch (error) {
        result.corruptedFiles.push(file.filePath);
        result.success = false;
      }
    }

    const resultMessage = result.success 
      ? `Backup verification passed: ${result.verifiedFiles}/${result.totalFiles} files verified`
      : `Backup verification failed: ${result.corruptedFiles.length} corrupted, ${result.missingFiles.length} missing, ${result.checksumMismatches.length} checksum mismatches`;

    await this.logBackupEvent(
      backupId,
      'verify',
      resultMessage,
      result.success ? 'info' : 'error'
    );

    return result;
  }

  /**
   * Restore files from a backup
   */
  async restoreBackup(backupId: string, options: RestoreOptions = {}): Promise<{
    success: boolean;
    restoredFiles: number;
    totalFiles: number;
    errors: string[];
  }> {
    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) {
      throw new ApiError(404, 'Backup not found');
    }

    const backupFiles = await this.getBackupFiles(backupId);
    const targetBucket = options.targetBucket ? 
      this.env.R2_BUCKET : // In a real implementation, you'd resolve the bucket by name
      this.env.R2_BUCKET;

    let restoredFiles = 0;
    const errors: string[] = [];

    // Filter files based on options
    const filesToRestore = this.filterBackupFiles(backupFiles, options);

    await this.logBackupEvent(
      backupId,
      'start',
      `Starting restore: ${filesToRestore.length} files to restore`,
      'info'
    );

    for (const file of filesToRestore) {
      try {
        // Check if file exists and handle overwrite option
        if (!options.overwriteExisting) {
          const existing = await targetBucket.get(file.filePath);
          if (existing) {
            continue; // Skip existing files
          }
        }

        // Get backup file
        const backupObject = await this.backupBucket.get(file.backupPath);
        if (!backupObject) {
          errors.push(`Backup file not found: ${file.filePath}`);
          continue;
        }

        // Restore file
        const content = await backupObject.arrayBuffer();
        await targetBucket.put(file.filePath, content);

        // Verify if requested
        if (options.verifyAfterRestore) {
          const calculatedChecksum = await this.calculateChecksum(content);
          if (calculatedChecksum !== file.checksum) {
            errors.push(`Checksum mismatch after restore: ${file.filePath}`);
            continue;
          }
        }

        restoredFiles++;
      } catch (error) {
        errors.push(`Failed to restore ${file.filePath}: ${error}`);
      }
    }

    const success = errors.length === 0;
    const resultMessage = success 
      ? `Restore completed: ${restoredFiles}/${filesToRestore.length} files restored`
      : `Restore completed with errors: ${restoredFiles}/${filesToRestore.length} files restored, ${errors.length} errors`;

    await this.logBackupEvent(
      backupId,
      success ? 'complete' : 'error',
      resultMessage,
      success ? 'info' : 'warn'
    );

    return {
      success,
      restoredFiles,
      totalFiles: filesToRestore.length,
      errors
    };
  }

  /**
   * Schedule daily backup
   */
  async scheduleDailyBackup(): Promise<void> {
    try {
      const lastBackup = await this.getLastSuccessfulBackup();
      const shouldCreateFull = !lastBackup || this.shouldCreateFullBackup(lastBackup);

      if (shouldCreateFull) {
        await this.createFullBackup();
      } else if (this.config.incrementalEnabled) {
        await this.createIncrementalBackup();
      }

      // Clean up old backups
      await this.cleanupOldBackups();
    } catch (error) {
      console.error('Daily backup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const oldBackups = await this.getBackupsOlderThan(cutoffDate.toISOString());

    for (const backup of oldBackups) {
      try {
        await this.deleteBackup(backup.id);
      } catch (error) {
        console.error(`Failed to delete backup ${backup.id}:`, error);
      }
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    lastBackupDate?: string;
    successRate: number;
  }> {
    const stats = await this.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(total_size) as total_size,
        MAX(backup_date) as last_backup,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM r2_backups
    `).first();

    return {
      totalBackups: stats?.total || 0,
      totalSize: stats?.total_size || 0,
      lastBackupDate: stats?.last_backup,
      successRate: stats?.total ? (stats.completed / stats.total) * 100 : 0
    };
  }

  // Private helper methods

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async listAllFiles(bucket: R2Bucket): Promise<Array<{ key: string; size: number; modified: Date }>> {
    const files: Array<{ key: string; size: number; modified: Date }> = [];
    let truncated = true;
    let cursor: string | undefined;

    while (truncated) {
      const result = await bucket.list({
        cursor,
        limit: 1000
      });

      files.push(...result.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        modified: obj.uploaded
      })));

      truncated = result.truncated;
      cursor = result.cursor;
    }

    return files;
  }

  private async backupFile(
    filePath: string,
    backupId: string,
    sourceBucket: R2Bucket,
    targetBucket: R2Bucket
  ): Promise<{
    success: boolean;
    size: number;
    checksum: string;
    backupPath: string;
  }> {
    const sourceObject = await sourceBucket.get(filePath);
    if (!sourceObject) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    const content = await sourceObject.arrayBuffer();
    const checksum = await this.calculateChecksum(content);
    const backupPath = `${backupId}/${filePath}`;

    await targetBucket.put(backupPath, content);

    return {
      success: true,
      size: content.byteLength,
      checksum,
      backupPath
    };
  }

  private async calculateChecksum(data: ArrayBuffer | string): Promise<string> {
    const encoder = new TextEncoder();
    const dataArray = typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataArray);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async getModifiedFilesSince(date: string): Promise<Array<{ key: string; size: number; modified: Date }>> {
    const allFiles = await this.listAllFiles(this.env.R2_BUCKET);
    const cutoffDate = new Date(date);
    
    return allFiles.filter(file => file.modified > cutoffDate);
  }

  private shouldCreateFullBackup(lastBackup: BackupMetadata): boolean {
    // Create full backup if last backup was more than 7 days ago
    const lastBackupDate = new Date(lastBackup.backupDate);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return lastBackupDate < sevenDaysAgo;
  }

  private filterBackupFiles(files: BackupFile[], options: RestoreOptions): BackupFile[] {
    let filtered = files;

    if (options.filters?.pathPrefix) {
      filtered = filtered.filter(file => file.filePath.startsWith(options.filters!.pathPrefix!));
    }

    if (options.filters?.fileExtensions) {
      filtered = filtered.filter(file => 
        options.filters!.fileExtensions!.some(ext => file.filePath.endsWith(ext))
      );
    }

    if (options.filters?.dateRange) {
      const start = new Date(options.filters.dateRange.start);
      const end = new Date(options.filters.dateRange.end);
      filtered = filtered.filter(file => {
        const fileDate = new Date(file.createdAt);
        return fileDate >= start && fileDate <= end;
      });
    }

    return filtered;
  }

  // Database operations

  private async insertBackupMetadata(metadata: BackupMetadata): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO r2_backups (
        id, bucket_name, backup_date, status, file_count, total_size, 
        checksum, backup_type, created_at, completed_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metadata.id,
      metadata.bucketName,
      metadata.backupDate,
      metadata.status,
      metadata.fileCount,
      metadata.totalSize,
      metadata.checksum,
      metadata.backupType,
      metadata.createdAt,
      metadata.completedAt,
      metadata.errorMessage
    ).run();
  }

  private async updateBackupMetadata(metadata: BackupMetadata): Promise<void> {
    await this.env.DB.prepare(`
      UPDATE r2_backups 
      SET status = ?, file_count = ?, total_size = ?, checksum = ?, 
          completed_at = ?, error_message = ?
      WHERE id = ?
    `).bind(
      metadata.status,
      metadata.fileCount,
      metadata.totalSize,
      metadata.checksum,
      metadata.completedAt,
      metadata.errorMessage,
      metadata.id
    ).run();
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM r2_backups WHERE id = ?
    `).bind(backupId).first();

    return result as BackupMetadata | null;
  }

  private async getLastSuccessfulBackup(): Promise<BackupMetadata | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM r2_backups 
      WHERE status = 'completed' 
      ORDER BY backup_date DESC 
      LIMIT 1
    `).bind().first();

    return result as BackupMetadata | null;
  }

  private async getBackupsOlderThan(date: string): Promise<BackupMetadata[]> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM r2_backups 
      WHERE backup_date < ?
    `).bind(date).all();

    return result.results as BackupMetadata[];
  }

  private async insertBackupFile(file: BackupFile): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO backup_files (
        backup_id, file_path, file_size, checksum, status, backup_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      file.backupId,
      file.filePath,
      file.fileSize,
      file.checksum,
      file.status,
      file.backupPath,
      file.createdAt
    ).run();
  }

  private async getBackupFiles(backupId: string): Promise<BackupFile[]> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM backup_files WHERE backup_id = ?
    `).bind(backupId).all();

    return result.results as BackupFile[];
  }

  private async logBackupEvent(
    backupId: string,
    eventType: string,
    message: string,
    level: 'info' | 'warn' | 'error'
  ): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO backup_logs (backup_id, timestamp, event_type, message, level)
      VALUES (?, ?, ?, ?, ?)
    `).bind(backupId, new Date().toISOString(), eventType, message, level).run();
  }

  private async deleteBackup(backupId: string): Promise<void> {
    // Delete backup files from R2
    const backupFiles = await this.getBackupFiles(backupId);
    for (const file of backupFiles) {
      try {
        await this.backupBucket.delete(file.backupPath);
      } catch (error) {
        console.error(`Failed to delete backup file ${file.backupPath}:`, error);
      }
    }

    // Delete from database
    await this.env.DB.prepare(`DELETE FROM backup_logs WHERE backup_id = ?`).bind(backupId).run();
    await this.env.DB.prepare(`DELETE FROM backup_files WHERE backup_id = ?`).bind(backupId).run();
    await this.env.DB.prepare(`DELETE FROM r2_backups WHERE id = ?`).bind(backupId).run();
  }
}

// Factory function to create backup service with default configuration
export function createBackupService(env: Env): R2BackupService {
  const config: BackupConfig = {
    bucketName: 'cutty-files',
    retentionDays: 30,
    incrementalEnabled: true,
    compressionEnabled: false,
    encryptionEnabled: false
  };

  return new R2BackupService(env, config);
}
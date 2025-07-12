import { R2StorageService } from '../storage/r2-service.js';

export interface MigrationFile {
  fileId: string;
  sourcePath: string;
  fileName: string;
  fileSize: number;
  userId: string;
  checksum?: string;
}

export interface MigrationBatch {
  batchId: string;
  files: MigrationFile[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  metadata?: Record<string, unknown>;
}

export interface MigrationResult {
  fileId: string;
  success: boolean;
  error?: string;
  originalChecksum?: string;
  migratedChecksum?: string;
  migratedKey?: string;
}

export interface MigrationProgress {
  batchId: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  verifiedFiles: number;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * File migration service for migrating files from filesystem to R2
 * Provides batch processing, validation, and rollback capabilities
 */
export class FileMigrationService {
  private r2Service: R2StorageService;
  private db: D1Database;
  private batchSize = 50; // Files per batch
  private maxRetries = 3;

  constructor(r2Service: R2StorageService, db: D1Database) {
    this.r2Service = r2Service;
    this.db = db;
  }

  /**
   * Create a new migration batch
   */
  async createMigrationBatch(
    files: MigrationFile[],
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const batchId = crypto.randomUUID();
    
    // Create batch record
    await this.db
      .prepare(`
        INSERT INTO migration_batches 
        (batch_id, total_files, status, migration_type, metadata)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        batchId,
        files.length,
        'pending',
        'filesystem_to_r2',
        JSON.stringify(metadata)
      )
      .run();

    // Create individual file migration records
    for (const file of files) {
      await this.db
        .prepare(`
          INSERT INTO file_migrations 
          (batch_id, file_id, source_path, file_size, status, original_checksum)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          batchId,
          file.fileId,
          file.sourcePath,
          file.fileSize,
          'pending',
          file.checksum
        )
        .run();
    }

    return batchId;
  }

  /**
   * Process a migration batch
   */
  async processMigrationBatch(batchId: string): Promise<MigrationProgress> {
    // Update batch status
    await this.updateBatchStatus(batchId, 'processing', new Date());

    try {
      // Get files in batch
      const files = await this.getBatchFiles(batchId);
      const results: MigrationResult[] = [];

      // Process files in smaller chunks to avoid overwhelming the system
      for (let i = 0; i < files.length; i += this.batchSize) {
        const chunk = files.slice(i, i + this.batchSize);
        const chunkResults = await this.processFileChunk(chunk, batchId);
        results.push(...chunkResults);

        // Update progress
        await this.updateBatchProgress(batchId, results);
      }

      // Determine final batch status
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      let finalStatus: string;
      if (failed === 0) {
        finalStatus = 'completed';
      } else if (successful === 0) {
        finalStatus = 'failed';
      } else {
        finalStatus = 'partial';
      }

      await this.updateBatchStatus(batchId, finalStatus, undefined, new Date());

      return await this.getBatchProgress(batchId);
    } catch (error) {
      await this.updateBatchStatus(batchId, 'failed', undefined, new Date());
      throw error;
    }
  }

  /**
   * Process a chunk of files in parallel
   */
  private async processFileChunk(
    files: MigrationFile[],
    batchId: string
  ): Promise<MigrationResult[]> {
    const promises = files.map(file => this.migrateFile(file, batchId));
    return await Promise.all(promises);
  }

  /**
   * Migrate a single file
   */
  private async migrateFile(
    file: MigrationFile,
    batchId: string,
    attempt = 1
  ): Promise<MigrationResult> {
    try {
      // Update file status
      await this.updateFileMigrationStatus(
        batchId,
        file.fileId,
        'processing',
        new Date()
      );

      // Read file from source (this would need to be implemented based on source)
      const fileData = await this.readSourceFile(file.sourcePath);
      
      // Calculate checksum if not provided
      const originalChecksum = file.checksum || await this.calculateChecksum(fileData);

      // Upload to R2
      const uploadResult = await this.r2Service.uploadFile(fileData, {
        userId: file.userId,
        fileId: file.fileId,
        fileName: file.fileName,
        contentType: this.inferContentType(file.fileName)
      });

      // Verify upload by downloading and checking
      const verification = await this.verifyMigration(
        file.fileId,
        file.userId,
        originalChecksum
      );

      if (!verification.success) {
        throw new Error(`Verification failed: ${verification.error}`);
      }

      // Update database with new R2 key
      await this.updateFileRecord(file.fileId, uploadResult.r2Key, originalChecksum);

      // Update migration status
      await this.updateFileMigrationStatus(
        batchId,
        file.fileId,
        'verified',
        undefined,
        new Date(),
        uploadResult.r2Key,
        verification.checksum
      );

      return {
        fileId: file.fileId,
        success: true,
        originalChecksum,
        migratedChecksum: verification.checksum,
        migratedKey: uploadResult.r2Key
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Retry logic
      if (attempt < this.maxRetries) {
        console.warn(`Migration failed for ${file.fileId}, retrying (${attempt}/${this.maxRetries}):`, errorMessage);
        return await this.migrateFile(file, batchId, attempt + 1);
      }

      // Update failure status
      await this.updateFileMigrationStatus(
        batchId,
        file.fileId,
        'failed',
        undefined,
        undefined,
        undefined,
        undefined,
        errorMessage
      );

      return {
        fileId: file.fileId,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Verify migration by downloading and checking integrity
   */
  async verifyMigration(
    fileId: string,
    userId: string,
    originalChecksum: string
  ): Promise<{ success: boolean; checksum?: string; error?: string }> {
    try {
      // Download from R2
      const fileObject = await this.r2Service.downloadFile(fileId, userId);
      if (!fileObject) {
        return { success: false, error: 'File not found in R2' };
      }

      // Calculate checksum of downloaded data
      const downloadedData = await this.streamToArrayBuffer(fileObject.body);
      const downloadedChecksum = await this.calculateChecksum(downloadedData);

      if (downloadedChecksum !== originalChecksum) {
        return {
          success: false,
          error: `Checksum mismatch: original=${originalChecksum}, downloaded=${downloadedChecksum}`
        };
      }

      return { success: true, checksum: downloadedChecksum };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown verification error'
      };
    }
  }

  /**
   * Get migration progress for a batch
   */
  async getBatchProgress(batchId: string): Promise<MigrationProgress> {
    const batch = await this.db
      .prepare(`
        SELECT batch_id, total_files, completed_files, failed_files, verified_files, 
               status, started_at, completed_at
        FROM migration_batches 
        WHERE batch_id = ?
      `)
      .bind(batchId)
      .first();

    if (!batch) {
      throw new Error('Migration batch not found');
    }

    return {
      batchId: batch.batch_id as string,
      totalFiles: batch.total_files as number,
      completedFiles: batch.completed_files as number,
      failedFiles: batch.failed_files as number,
      verifiedFiles: batch.verified_files as number,
      status: batch.status as string,
      startedAt: batch.started_at ? new Date(batch.started_at as string) : undefined,
      completedAt: batch.completed_at ? new Date(batch.completed_at as string) : undefined
    };
  }

  /**
   * Process a migration batch (wrapper for compatibility)
   */
  async processBatch(batch: MigrationBatch): Promise<MigrationProgress> {
    // Create migration batch first if it doesn't exist
    const batchId = await this.createMigrationBatch(batch.files, batch.metadata || {});
    
    // Process the batch
    return await this.processMigrationBatch(batchId);
  }

  /**
   * Rollback a migration batch
   */
  async rollbackMigrationBatch(batchId: string): Promise<void> {
    // Get successfully migrated files
    const migratedFiles = await this.db
      .prepare(`
        SELECT file_id, target_r2_key 
        FROM file_migrations 
        WHERE batch_id = ? AND status IN ('completed', 'verified') AND target_r2_key IS NOT NULL
      `)
      .bind(batchId)
      .all();

    // Delete from R2
    for (const file of migratedFiles.results) {
      try {
        const fileRecord = await this.db
          .prepare('SELECT user_id FROM files WHERE id = ?')
          .bind(file.file_id)
          .first();

        if (fileRecord) {
          await this.r2Service.deleteFile(file.file_id as string, fileRecord.user_id as string);
        }
      } catch (error) {
        console.error(`Failed to delete file ${file.file_id} during rollback:`, error);
      }
    }

    // Update migration records
    await this.db
      .prepare('UPDATE file_migrations SET status = ? WHERE batch_id = ?')
      .bind('failed', batchId)
      .run();

    await this.db
      .prepare('UPDATE migration_batches SET status = ? WHERE batch_id = ?')
      .bind('failed', batchId)
      .run();
  }

  /**
   * Get files for a batch
   */
  private async getBatchFiles(batchId: string): Promise<MigrationFile[]> {
    const result = await this.db
      .prepare(`
        SELECT fm.file_id, fm.source_path, fm.file_size, fm.original_checksum,
               f.filename, f.user_id
        FROM file_migrations fm
        JOIN files f ON fm.file_id = f.id
        WHERE fm.batch_id = ? AND fm.status = 'pending'
      `)
      .bind(batchId)
      .all();

    return result.results.map(row => ({
      fileId: row.file_id as string,
      sourcePath: row.source_path as string,
      fileName: row.filename as string,
      fileSize: row.file_size as number,
      userId: row.user_id as string,
      checksum: row.original_checksum as string | undefined
    }));
  }

  /**
   * Update batch status
   */
  private async updateBatchStatus(
    batchId: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date
  ): Promise<void> {
    const updates: string[] = ['status = ?'];
    const bindings: (string | Date)[] = [status];

    if (startedAt) {
      updates.push('started_at = ?');
      bindings.push(startedAt.toISOString());
    }

    if (completedAt) {
      updates.push('completed_at = ?');
      bindings.push(completedAt.toISOString());
    }

    bindings.push(batchId);

    await this.db
      .prepare(`UPDATE migration_batches SET ${updates.join(', ')} WHERE batch_id = ?`)
      .bind(...bindings)
      .run();
  }

  /**
   * Update batch progress counters
   */
  private async updateBatchProgress(
    batchId: string,
    results: MigrationResult[]
  ): Promise<void> {
    const completed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const verified = results.filter(r => r.success && r.migratedChecksum).length;

    await this.db
      .prepare(`
        UPDATE migration_batches 
        SET completed_files = ?, failed_files = ?, verified_files = ?
        WHERE batch_id = ?
      `)
      .bind(completed, failed, verified, batchId)
      .run();
  }

  /**
   * Update file migration status
   */
  private async updateFileMigrationStatus(
    batchId: string,
    fileId: string,
    status: string,
    startedAt?: Date,
    completedAt?: Date,
    targetR2Key?: string,
    migratedChecksum?: string,
    errorMessage?: string
  ): Promise<void> {
    const updates: string[] = ['status = ?'];
    const bindings: (string | Date)[] = [status];

    if (startedAt) {
      updates.push('started_at = ?');
      bindings.push(startedAt.toISOString());
    }

    if (completedAt) {
      updates.push('completed_at = ?');
      bindings.push(completedAt.toISOString());
    }

    if (targetR2Key) {
      updates.push('target_r2_key = ?');
      bindings.push(targetR2Key);
    }

    if (migratedChecksum) {
      updates.push('migrated_checksum = ?');
      bindings.push(migratedChecksum);
    }

    if (errorMessage) {
      updates.push('error_message = ?');
      bindings.push(errorMessage);
    }

    bindings.push(batchId, fileId);

    await this.db
      .prepare(`
        UPDATE file_migrations 
        SET ${updates.join(', ')} 
        WHERE batch_id = ? AND file_id = ?
      `)
      .bind(...bindings)
      .run();
  }

  /**
   * Update file record with R2 information
   */
  private async updateFileRecord(
    fileId: string,
    r2Key: string,
    checksum: string
  ): Promise<void> {
    await this.db
      .prepare('UPDATE files SET r2_key = ?, checksum = ? WHERE id = ?')
      .bind(r2Key, checksum, fileId)
      .run();
  }

  /**
   * Read file from source location
   * Note: This assumes files are accessible via HTTP from the Django application
   */
  private async readSourceFile(sourcePath: string): Promise<ArrayBuffer> {
    try {
      // If sourcePath is a relative path, construct full URL to Django media endpoint
      let fileUrl = sourcePath;
      
      if (!sourcePath.startsWith('http')) {
        // Assume Django media URL pattern
        const baseUrl = process.env.DJANGO_BASE_URL || 'http://localhost:8000';
        fileUrl = `${baseUrl}/media/${sourcePath.replace(/^\/+/, '')}`;
      }
      
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      return await response.arrayBuffer();
    } catch (error) {
      console.error(`Failed to read source file ${sourcePath}:`, error);
      throw new Error(`Failed to read source file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate SHA-256 checksum of data
   */
  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert ReadableStream to ArrayBuffer
   */
  private async streamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        totalLength += value.length;
      }

      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result.buffer;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Infer content type from filename
   */
  private inferContentType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'csv':
        return 'text/csv';
      case 'txt':
        return 'text/plain';
      case 'json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  }
}

export interface FileUploadOptions {
  userId: string;
  fileId: string;
  fileName: string;
  contentType: string;
  metadata?: Record<string, string>;
  storageClass?: 'Standard' | 'InfrequentAccess';
}

export interface MultipartUploadSession {
  uploadId: string;
  fileId: string;
  r2Key: string;
  parts: Array<{
    partNumber: number;
    etag: string;
    size: number;
  }>;
  createdAt: Date;
  expiresAt: Date;
  userId: string;
  totalSize?: number;
  totalParts?: number;
}

export interface UploadResult {
  fileId: string;
  r2Key: string;
  etag: string;
  size: number;
  uploadType: 'single' | 'multipart';
}

/**
 * Advanced R2 storage service with multipart upload support
 * Implements Cloudflare R2 best practices for 2025
 */
export class R2StorageService {
  private bucket: R2Bucket;
  private db: D1Database;
  private maxSingleUploadSize = 50 * 1024 * 1024; // 50MB threshold for multipart
  private multipartChunkSize = 5 * 1024 * 1024; // 5MB minimum chunk size

  constructor(bucket: R2Bucket, db: D1Database) {
    this.bucket = bucket;
    this.db = db;
  }

  /**
   * Upload a file using the most appropriate method (single or multipart)
   */
  async uploadFile(
    fileData: ArrayBuffer | ReadableStream | Uint8Array,
    options: FileUploadOptions
  ): Promise<UploadResult> {
    // Determine file size
    let fileSize: number;
    if (fileData instanceof ArrayBuffer) {
      fileSize = fileData.byteLength;
    } else if (fileData instanceof Uint8Array) {
      fileSize = fileData.byteLength;
    } else {
      // For ReadableStream, we'll need to use multipart upload approach
      fileSize = -1; // Unknown size, will be determined during upload
    }

    const r2Key = this.generateR2Key(options.userId, options.fileId, options.fileName);

    // Use multipart upload for large files or streams with unknown size
    if (fileSize > this.maxSingleUploadSize || fileSize === -1) {
      return await this.multipartUpload(fileData, {
        ...options,
        r2Key,
        fileSize: fileSize > 0 ? fileSize : undefined
      });
    }

    // Single upload for smaller files
    return await this.singleUpload(fileData as ArrayBuffer | Uint8Array, {
      ...options,
      r2Key,
      fileSize
    });
  }

  /**
   * Single file upload for files under the multipart threshold
   */
  private async singleUpload(
    fileData: ArrayBuffer | Uint8Array,
    options: FileUploadOptions & { r2Key: string; fileSize: number }
  ): Promise<UploadResult> {
    const { userId, fileId, fileName, contentType, metadata = {}, storageClass, r2Key, fileSize } = options;

    try {
      const uploadOptions: R2PutOptions = {
        httpMetadata: {
          contentType,
          cacheControl: 'private, max-age=3600',
          contentDisposition: `attachment; filename="${fileName}"`
        },
        customMetadata: {
          originalName: fileName,
          userId,
          fileId,
          uploadedAt: new Date().toISOString(),
          uploadType: 'single',
          ...metadata
        },
        storageClass
      };

      const result = await this.bucket.put(r2Key, fileData, uploadOptions);
      
      if (!result) {
        throw new Error('Failed to upload file to R2');
      }

      // Log the upload
      await this.logFileAccess(fileId, userId, 'upload', {
        success: true,
        bytes_transferred: fileSize,
        upload_type: 'single'
      });

      return {
        fileId,
        r2Key,
        etag: result.etag,
        size: fileSize,
        uploadType: 'single'
      };
    } catch (error) {
      await this.logFileAccess(fileId, userId, 'upload', {
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        upload_type: 'single'
      });
      throw error;
    }
  }

  /**
   * Multipart upload for large files
   */
  private async multipartUpload(
    fileData: ArrayBuffer | ReadableStream | Uint8Array,
    options: FileUploadOptions & { r2Key: string; fileSize?: number }
  ): Promise<UploadResult> {
    const { userId, fileId, fileName, contentType, r2Key, fileSize } = options;

    try {
      // Initiate multipart upload
      const multipartUpload = await this.bucket.createMultipartUpload(r2Key, {
        httpMetadata: {
          contentType,
          cacheControl: 'private, max-age=3600',
          contentDisposition: `attachment; filename="${fileName}"`
        },
        customMetadata: {
          originalName: fileName,
          userId,
          fileId,
          uploadedAt: new Date().toISOString(),
          uploadType: 'multipart'
        }
      });

      // Create session record
      const session = await this.createMultipartSession({
        uploadId: multipartUpload.uploadId,
        fileId,
        userId,
        r2Key,
        fileName,
        totalSize: fileSize
      });

      // Upload parts
      const uploadedParts = await this.uploadParts(
        fileData,
        multipartUpload.uploadId,
        r2Key,
        session
      );

      // Complete multipart upload
      const result = await multipartUpload.complete(uploadedParts);

      // Clean up session
      await this.cleanupMultipartSession(multipartUpload.uploadId);

      // Log successful upload
      await this.logFileAccess(fileId, userId, 'upload', {
        success: true,
        bytes_transferred: result.size,
        upload_type: 'multipart',
        parts_count: uploadedParts.length
      });

      return {
        fileId,
        r2Key,
        etag: result.etag,
        size: result.size,
        uploadType: 'multipart'
      };
    } catch (error) {
      // Cleanup failed upload
      try {
        await this.abortMultipartUpload(r2Key, fileId);
      } catch (cleanupError) {
        console.error('Failed to cleanup multipart upload:', cleanupError);
      }

      await this.logFileAccess(fileId, userId, 'upload', {
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        upload_type: 'multipart'
      });

      throw error;
    }
  }

  /**
   * Upload file parts for multipart upload
   */
  private async uploadParts(
    fileData: ArrayBuffer | ReadableStream | Uint8Array,
    uploadId: string,
    r2Key: string,
    _session: MultipartUploadSession
  ): Promise<R2UploadedPart[]> {
    const uploadedParts: R2UploadedPart[] = [];

    if (fileData instanceof ReadableStream) {
      // Handle streaming data
      const reader = fileData.getReader();
      let partNumber = 1;
      let buffer = new Uint8Array(0);

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (value) {
            // Accumulate data in buffer
            const newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;
          }

          // Upload when we have enough data or reached end
          if (buffer.length >= this.multipartChunkSize || (done && buffer.length > 0)) {
            const partData = buffer.slice(0, this.multipartChunkSize);
            buffer = buffer.slice(this.multipartChunkSize);

            const uploadedPart = await this.bucket.uploadPart(r2Key, uploadId, partNumber, partData);
            uploadedParts.push(uploadedPart);

            // Update session
            await this.updateMultipartSession(uploadId, {
              partsUploaded: partNumber,
              uploadedPart
            });

            partNumber++;
          }

          if (done && buffer.length === 0) break;
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      // Handle ArrayBuffer or Uint8Array
      const data = fileData instanceof ArrayBuffer ? new Uint8Array(fileData) : fileData;
      const totalParts = Math.ceil(data.length / this.multipartChunkSize);
      
      // Upload parts in parallel (but limit concurrency)
      const concurrencyLimit = 3;
      const partPromises: Promise<R2UploadedPart>[] = [];

      for (let i = 0; i < totalParts; i++) {
        const start = i * this.multipartChunkSize;
        const end = Math.min(start + this.multipartChunkSize, data.length);
        const partData = data.slice(start, end);
        const partNumber = i + 1;

        const uploadPromise = this.bucket.uploadPart(r2Key, uploadId, partNumber, partData);
        partPromises.push(uploadPromise);

        // Process in batches
        if (partPromises.length >= concurrencyLimit || i === totalParts - 1) {
          const batchResults = await Promise.all(partPromises);
          uploadedParts.push(...batchResults);
          partPromises.length = 0;

          // Update session with progress
          await this.updateMultipartSession(uploadId, {
            partsUploaded: uploadedParts.length
          });
        }
      }
    }

    return uploadedParts.sort((a, b) => a.partNumber - b.partNumber);
  }

  /**
   * Download a file from R2
   */
  async downloadFile(
    fileId: string,
    userId: string,
    options: { range?: string } = {}
  ): Promise<R2ObjectBody | null> {
    const startTime = Date.now();

    try {
      // Get file metadata from database
      const fileRecord = await this.db
        .prepare('SELECT r2_key, filename, mime_type, file_size FROM files WHERE id = ? AND user_id = ?')
        .bind(fileId, userId)
        .first();

      if (!fileRecord) {
        return null;
      }

      const downloadOptions: R2GetOptions = {};
      if (options.range) {
        downloadOptions.range = this.parseRange(options.range);
      }

      const fileObject = await this.bucket.get(fileRecord.r2_key as string, downloadOptions);
      
      if (fileObject) {
        // Log successful download
        await this.logFileAccess(fileId, userId, 'download', {
          success: true,
          bytes_transferred: fileObject.size,
          duration_ms: Date.now() - startTime,
          range_request: !!options.range
        });
      }

      return fileObject;
    } catch (error) {
      await this.logFileAccess(fileId, userId, 'download', {
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Delete a file from R2
   */
  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      // Get file metadata
      const fileRecord = await this.db
        .prepare('SELECT r2_key, file_size FROM files WHERE id = ? AND user_id = ?')
        .bind(fileId, userId)
        .first();

      if (!fileRecord) {
        return false;
      }

      await this.bucket.delete(fileRecord.r2_key as string);

      // Log deletion
      await this.logFileAccess(fileId, userId, 'delete', {
        success: true,
        bytes_transferred: fileRecord.file_size as number
      });

      return true;
    } catch (error) {
      await this.logFileAccess(fileId, userId, 'delete', {
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate R2 object key with user scoping
   */
  private generateR2Key(userId: string, fileId: string, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `uploads/user-${userId}/${fileId}-${timestamp}-${sanitizedFileName}`;
  }

  /**
   * Parse HTTP Range header
   */
  private parseRange(range: string): R2Range {
    const match = range.match(/^bytes=(\d+)-(\d+)?$/);
    if (!match) {
      throw new Error('Invalid range format');
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : undefined;

    return {
      offset: start,
      length: end ? end - start + 1 : undefined
    };
  }

  /**
   * Create multipart upload session in database
   */
  private async createMultipartSession(data: {
    uploadId: string;
    fileId: string;
    userId: string;
    r2Key: string;
    fileName: string;
    totalSize?: number;
  }): Promise<MultipartUploadSession> {
    const { uploadId, fileId, userId, r2Key, fileName, totalSize } = data;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const sessionData = JSON.stringify({
      uploadId,
      fileId,
      r2Key,
      fileName,
      totalSize,
      parts: []
    });

    await this.db
      .prepare(`
        INSERT INTO multipart_uploads 
        (upload_id, file_id, user_id, r2_key, filename, total_size, session_data, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(uploadId, fileId, userId, r2Key, fileName, totalSize || null, sessionData, expiresAt.toISOString())
      .run();

    return {
      uploadId,
      fileId,
      r2Key,
      parts: [],
      createdAt: new Date(),
      expiresAt,
      userId,
      totalSize
    };
  }

  /**
   * Update multipart upload session progress
   */
  private async updateMultipartSession(
    uploadId: string,
    update: {
      partsUploaded?: number;
      uploadedPart?: R2UploadedPart;
    }
  ): Promise<void> {
    if (update.partsUploaded !== undefined) {
      await this.db
        .prepare('UPDATE multipart_uploads SET parts_uploaded = ? WHERE upload_id = ?')
        .bind(update.partsUploaded, uploadId)
        .run();
    }
  }

  /**
   * Clean up completed multipart upload session
   */
  private async cleanupMultipartSession(uploadId: string): Promise<void> {
    await this.db
      .prepare('UPDATE multipart_uploads SET status = ?, completed_at = ? WHERE upload_id = ?')
      .bind('completed', new Date().toISOString(), uploadId)
      .run();
  }

  /**
   * Abort multipart upload and cleanup
   */
  private async abortMultipartUpload(r2Key: string, fileId: string): Promise<void> {
    try {
      // Get upload session
      const session = await this.db
        .prepare('SELECT upload_id FROM multipart_uploads WHERE file_id = ? AND status = ?')
        .bind(fileId, 'active')
        .first();

      if (session) {
        await this.bucket.abortMultipartUpload(r2Key, session.upload_id as string);
        
        await this.db
          .prepare('UPDATE multipart_uploads SET status = ? WHERE upload_id = ?')
          .bind('aborted', session.upload_id)
          .run();
      }
    } catch (error) {
      console.error('Failed to abort multipart upload:', error);
    }
  }

  /**
   * Log file access for monitoring and security
   */
  private async logFileAccess(
    fileId: string,
    userId: string,
    action: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO file_access_logs 
          (file_id, user_id, action, success, error_message, bytes_transferred, duration_ms, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          fileId,
          userId,
          action,
          metadata.success ? 1 : 0,
          metadata.error_message || null,
          metadata.bytes_transferred || null,
          metadata.duration_ms || null,
          JSON.stringify(metadata)
        )
        .run();
    } catch (error) {
      console.error('Failed to log file access:', error);
    }
  }
}
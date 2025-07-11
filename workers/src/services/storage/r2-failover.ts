import type { 
  Env, 
  R2OperationOptions, 
  FailoverResult, 
  OperationPayload 
} from '../../types';
import { ApiError } from '../../middleware/error';
import { DegradationHandler } from '../failover/degradation-handler';

export class R2FailoverService {
  private env: Env;
  private degradationHandler: DegradationHandler;
  private initialized: boolean = false;

  constructor(env: Env) {
    this.env = env;
    this.degradationHandler = new DegradationHandler(env);
  }

  /**
   * Initialize the failover service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.degradationHandler.initialize();
      this.initialized = true;
      console.log('R2 Failover Service initialized');
    } catch (error) {
      console.error('Error initializing R2 Failover Service:', error);
      throw error;
    }
  }

  /**
   * Save file to R2 with failover handling
   */
  async saveFileToR2(
    fileName: string,
    content: ArrayBuffer,
    options: R2OperationOptions = {}
  ): Promise<FailoverResult<string>> {
    await this.ensureInitialized();

    const { skipFailover = false, priority = 5, maxRetries = 3, timeoutMs = 30000 } = options;

    if (skipFailover) {
      // Direct operation without failover
      return this.directSaveToR2(fileName, content, options);
    }

    // Execute with failover handling
    return this.degradationHandler.executeWithFailover(
      'R2_STORAGE',
      async () => {
        const r2Options: any = {};
        
        if (options.metadata?.contentType) {
          r2Options.httpMetadata = { contentType: options.metadata.contentType as string };
        }

        // Add timeout wrapper
        const uploadPromise = this.env.R2_BUCKET.put(fileName, content, r2Options);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Upload timeout')), timeoutMs);
        });

        await Promise.race([uploadPromise, timeoutPromise]);
        return fileName;
      },
      // Fallback: Queue operation for later processing
      async () => {
        const operationId = await this.queueUploadOperation(fileName, content, options);
        throw new ApiError(202, 'Operation queued for processing', { operationId });
      }
    );
  }

  /**
   * Get file from R2 with failover handling
   */
  async getFileFromR2(
    fileName: string,
    options: R2OperationOptions = {}
  ): Promise<FailoverResult<R2ObjectBody | null>> {
    await this.ensureInitialized();

    const { skipFailover = false, timeoutMs = 30000 } = options;

    if (skipFailover) {
      // Direct operation without failover
      return this.directGetFromR2(fileName, options);
    }

    // Execute with failover handling
    return this.degradationHandler.executeWithFailover(
      'R2_STORAGE',
      async () => {
        const getPromise = this.env.R2_BUCKET.get(fileName);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Get timeout')), timeoutMs);
        });

        const result = await Promise.race([getPromise, timeoutPromise]);
        return result;
      },
      // Fallback: Try to get from cache or return null
      async () => {
        console.log(`Fallback: Unable to retrieve ${fileName} from R2`);
        return null;
      }
    );
  }

  /**
   * Delete file from R2 with failover handling
   */
  async deleteFileFromR2(
    fileName: string,
    options: R2OperationOptions = {}
  ): Promise<FailoverResult<void>> {
    await this.ensureInitialized();

    const { skipFailover = false, priority = 5, timeoutMs = 30000 } = options;

    if (skipFailover) {
      // Direct operation without failover
      return this.directDeleteFromR2(fileName, options);
    }

    // Execute with failover handling
    return this.degradationHandler.executeWithFailover(
      'R2_STORAGE',
      async () => {
        const deletePromise = this.env.R2_BUCKET.delete(fileName);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Delete timeout')), timeoutMs);
        });

        await Promise.race([deletePromise, timeoutPromise]);
      },
      // Fallback: Queue deletion for later processing
      async () => {
        const operationId = await this.queueDeleteOperation(fileName, options);
        console.log(`Delete operation queued: ${operationId}`);
      }
    );
  }

  /**
   * List files from R2 with failover handling
   */
  async listFiles(
    options: {
      prefix?: string;
      limit?: number;
      cursor?: string;
      delimiter?: string;
    } = {}
  ): Promise<FailoverResult<R2Objects>> {
    await this.ensureInitialized();

    const { prefix, limit = 1000, cursor, delimiter } = options;

    // Execute with failover handling
    return this.degradationHandler.executeWithFailover(
      'R2_STORAGE',
      async () => {
        const listOptions: R2ListOptions = {};
        
        if (prefix) listOptions.prefix = prefix;
        if (limit) listOptions.limit = limit;
        if (cursor) listOptions.cursor = cursor;
        if (delimiter) listOptions.delimiter = delimiter;

        const result = await this.env.R2_BUCKET.list(listOptions);
        return result;
      },
      // Fallback: Return empty list with warning
      async () => {
        console.log('Fallback: Unable to list files from R2, returning empty list');
        return {
          objects: [],
          truncated: false,
          cursor: undefined
        } as R2Objects;
      }
    );
  }

  /**
   * Get file metadata from R2 with failover handling
   */
  async getFileMetadata(
    fileName: string,
    options: R2OperationOptions = {}
  ): Promise<FailoverResult<R2Object | null>> {
    await this.ensureInitialized();

    const { skipFailover = false, timeoutMs = 30000 } = options;

    if (skipFailover) {
      return this.directGetMetadata(fileName, options);
    }

    // Execute with failover handling
    return this.degradationHandler.executeWithFailover(
      'R2_STORAGE',
      async () => {
        const headPromise = this.env.R2_BUCKET.head(fileName);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Head timeout')), timeoutMs);
        });

        const result = await Promise.race([headPromise, timeoutPromise]);
        return result;
      },
      // Fallback: Return null
      async () => {
        console.log(`Fallback: Unable to get metadata for ${fileName}`);
        return null;
      }
    );
  }

  /**
   * Update file metadata in R2 with failover handling
   */
  async updateFileMetadata(
    fileName: string,
    metadata: Record<string, string>,
    options: R2OperationOptions = {}
  ): Promise<FailoverResult<void>> {
    await this.ensureInitialized();

    const { skipFailover = false, priority = 5, timeoutMs = 30000 } = options;

    if (skipFailover) {
      return this.directUpdateMetadata(fileName, metadata, options);
    }

    // Execute with failover handling
    return this.degradationHandler.executeWithFailover(
      'R2_STORAGE',
      async () => {
        // For R2, updating metadata requires copying the object
        const existingObject = await this.env.R2_BUCKET.get(fileName);
        if (!existingObject) {
          throw new Error('File not found');
        }

        const updatePromise = this.env.R2_BUCKET.put(fileName, existingObject.body, {
          httpMetadata: existingObject.httpMetadata,
          customMetadata: metadata
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Update timeout')), timeoutMs);
        });

        await Promise.race([updatePromise, timeoutPromise]);
      },
      // Fallback: Queue metadata update for later processing
      async () => {
        const operationId = await this.queueMetadataUpdateOperation(fileName, metadata, options);
        console.log(`Metadata update operation queued: ${operationId}`);
      }
    );
  }

  /**
   * Check R2 service health
   */
  async checkHealth(): Promise<FailoverResult<boolean>> {
    await this.ensureInitialized();

    return this.degradationHandler.executeWithFailover(
      'R2_STORAGE',
      async () => {
        // Perform a simple list operation to check health
        const result = await this.env.R2_BUCKET.list({ limit: 1 });
        return result !== null;
      },
      // Fallback: Return false
      async () => {
        return false;
      }
    );
  }

  /**
   * Get service status
   */
  async getServiceStatus() {
    await this.ensureInitialized();
    return this.degradationHandler.getServiceStatus('R2_STORAGE');
  }

  /**
   * Get health metrics
   */
  getHealthMetrics() {
    return this.degradationHandler.getHealthMetrics('R2_STORAGE');
  }

  /**
   * Check if system is in read-only mode
   */
  isReadOnlyMode(): boolean {
    return this.degradationHandler.isReadOnlyMode();
  }

  /**
   * Private methods
   */

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async directSaveToR2(
    fileName: string,
    content: ArrayBuffer,
    options: R2OperationOptions
  ): Promise<FailoverResult<string>> {
    try {
      const r2Options: any = {};
      
      if (options.metadata?.contentType) {
        r2Options.httpMetadata = { contentType: options.metadata.contentType as string };
      }

      await this.env.R2_BUCKET.put(fileName, content, r2Options);
      
      return {
        success: true,
        data: fileName,
        degraded: false,
        queued: false
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        degraded: false,
        queued: false
      };
    }
  }

  private async directGetFromR2(
    fileName: string,
    options: R2OperationOptions
  ): Promise<FailoverResult<R2ObjectBody | null>> {
    try {
      const result = await this.env.R2_BUCKET.get(fileName);
      
      return {
        success: true,
        data: result,
        degraded: false,
        queued: false
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        degraded: false,
        queued: false
      };
    }
  }

  private async directDeleteFromR2(
    fileName: string,
    options: R2OperationOptions
  ): Promise<FailoverResult<void>> {
    try {
      await this.env.R2_BUCKET.delete(fileName);
      
      return {
        success: true,
        degraded: false,
        queued: false
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        degraded: false,
        queued: false
      };
    }
  }

  private async directGetMetadata(
    fileName: string,
    options: R2OperationOptions
  ): Promise<FailoverResult<R2Object | null>> {
    try {
      const result = await this.env.R2_BUCKET.head(fileName);
      
      return {
        success: true,
        data: result,
        degraded: false,
        queued: false
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        degraded: false,
        queued: false
      };
    }
  }

  private async directUpdateMetadata(
    fileName: string,
    metadata: Record<string, string>,
    options: R2OperationOptions
  ): Promise<FailoverResult<void>> {
    try {
      const existingObject = await this.env.R2_BUCKET.get(fileName);
      if (!existingObject) {
        throw new Error('File not found');
      }

      await this.env.R2_BUCKET.put(fileName, existingObject.body, {
        httpMetadata: existingObject.httpMetadata,
        customMetadata: metadata
      });
      
      return {
        success: true,
        degraded: false,
        queued: false
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        degraded: false,
        queued: false
      };
    }
  }

  private async queueUploadOperation(
    fileName: string,
    content: ArrayBuffer,
    options: R2OperationOptions
  ): Promise<string> {
    const payload: OperationPayload = {
      fileName,
      content: btoa(String.fromCharCode(...new Uint8Array(content))),
      contentType: options.metadata?.contentType as string,
      metadata: options.metadata,
      originalRequest: {
        operation: 'upload',
        timestamp: new Date().toISOString()
      }
    };

    return this.degradationHandler.queueOperation(
      'UPLOAD',
      payload,
      undefined, // userId - would be extracted from context
      undefined, // fileId - would be extracted from context
      options.priority || 5
    );
  }

  private async queueDeleteOperation(
    fileName: string,
    options: R2OperationOptions
  ): Promise<string> {
    const payload: OperationPayload = {
      fileName,
      originalRequest: {
        operation: 'delete',
        timestamp: new Date().toISOString()
      }
    };

    return this.degradationHandler.queueOperation(
      'DELETE',
      payload,
      undefined, // userId - would be extracted from context
      undefined, // fileId - would be extracted from context
      options.priority || 5
    );
  }

  private async queueMetadataUpdateOperation(
    fileName: string,
    metadata: Record<string, string>,
    options: R2OperationOptions
  ): Promise<string> {
    const payload: OperationPayload = {
      fileName,
      metadata,
      originalRequest: {
        operation: 'metadata_update',
        timestamp: new Date().toISOString()
      }
    };

    return this.degradationHandler.queueOperation(
      'METADATA_UPDATE',
      payload,
      undefined, // userId - would be extracted from context
      undefined, // fileId - would be extracted from context
      options.priority || 5
    );
  }
}

// Legacy wrapper functions for backward compatibility
export async function saveFileToR2(
  env: Env,
  fileName: string,
  content: ArrayBuffer,
  contentType?: string
): Promise<string> {
  const service = new R2FailoverService(env);
  const result = await service.saveFileToR2(fileName, content, {
    metadata: { contentType }
  });
  
  if (result.success) {
    return result.data!;
  }
  
  if (result.queued) {
    throw new ApiError(202, 'Upload queued for processing', { 
      operationId: result.error 
    });
  }
  
  throw new ApiError(500, result.error || 'Failed to save file to storage');
}

export async function getFileFromR2(
  env: Env,
  fileName: string
): Promise<R2ObjectBody | null> {
  const service = new R2FailoverService(env);
  const result = await service.getFileFromR2(fileName);
  
  if (result.success) {
    return result.data!;
  }
  
  if (result.degraded) {
    console.warn('R2 service degraded, returning fallback result');
    return result.data!;
  }
  
  throw new ApiError(500, result.error || 'Failed to retrieve file from storage');
}

export async function deleteFileFromR2(
  env: Env,
  fileName: string
): Promise<void> {
  const service = new R2FailoverService(env);
  const result = await service.deleteFileFromR2(fileName);
  
  if (result.success) {
    return;
  }
  
  if (result.queued) {
    console.log('Delete operation queued for processing');
    return;
  }
  
  throw new ApiError(500, result.error || 'Failed to delete file from storage');
}
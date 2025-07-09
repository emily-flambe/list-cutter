import type { 
  Env, 
  OperationQueueItem, 
  OperationPayload, 
  OperationType, 
  OperationStatus 
} from '../../types';
import { ApiError } from '../../middleware/error';

export class OperationQueue {
  private env: Env;
  private maxQueueSize: number;
  private batchSize: number;
  private processingInterval: number;
  private isProcessing: boolean = false;

  constructor(
    env: Env, 
    maxQueueSize: number = 1000, 
    batchSize: number = 10,
    processingInterval: number = 5000
  ) {
    this.env = env;
    this.maxQueueSize = maxQueueSize;
    this.batchSize = batchSize;
    this.processingInterval = processingInterval;
  }

  /**
   * Add an operation to the queue
   */
  async enqueue(
    operationType: OperationType,
    payload: OperationPayload,
    options: {
      priority?: number;
      userId?: number;
      fileId?: string;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const { priority = 5, userId, fileId, maxRetries = 3 } = options;
    
    // Check queue size limit
    const queueSize = await this.getQueueSize();
    if (queueSize >= this.maxQueueSize) {
      throw new ApiError(503, 'Operation queue is full. Please try again later.');
    }

    // Generate unique operation ID
    const operationId = `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await this.env.DB.prepare(`
        INSERT INTO operation_queue (
          operation_type, operation_id, payload, priority, 
          user_id, file_id, max_retries, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        operationType,
        operationId,
        JSON.stringify(payload),
        priority,
        userId || null,
        fileId || null,
        maxRetries,
        new Date().toISOString()
      ).run();

      console.log(`Operation queued: ${operationId} (type: ${operationType}, priority: ${priority})`);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }

      return operationId;
    } catch (error) {
      console.error('Error queuing operation:', error);
      throw new ApiError(500, 'Failed to queue operation');
    }
  }

  /**
   * Get the current queue size
   */
  async getQueueSize(): Promise<number> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT COUNT(*) as count FROM operation_queue 
        WHERE status IN ('PENDING', 'PROCESSING')
      `).first();
      
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting queue size:', error);
      return 0;
    }
  }

  /**
   * Get operations by status
   */
  async getOperationsByStatus(status: OperationStatus, limit: number = 50): Promise<OperationQueueItem[]> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM operation_queue 
        WHERE status = ? 
        ORDER BY priority ASC, created_at ASC 
        LIMIT ?
      `).bind(status, limit).all();
      
      return result.results as OperationQueueItem[];
    } catch (error) {
      console.error('Error getting operations by status:', error);
      return [];
    }
  }

  /**
   * Get operations ready for processing (including retries)
   */
  async getReadyOperations(limit: number = 10): Promise<OperationQueueItem[]> {
    try {
      const now = new Date().toISOString();
      const result = await this.env.DB.prepare(`
        SELECT * FROM operation_queue 
        WHERE status = 'PENDING' 
        AND (scheduled_at IS NULL OR scheduled_at <= ?)
        ORDER BY priority ASC, created_at ASC 
        LIMIT ?
      `).bind(now, limit).all();
      
      return result.results as OperationQueueItem[];
    } catch (error) {
      console.error('Error getting ready operations:', error);
      return [];
    }
  }

  /**
   * Update operation status
   */
  async updateOperationStatus(
    operationId: string, 
    status: OperationStatus, 
    error?: string
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const values: unknown[] = [];
      
      updates.push('status = ?');
      values.push(status);
      
      if (error) {
        updates.push('error_message = ?');
        values.push(error);
      }
      
      if (status === 'COMPLETED' || status === 'FAILED') {
        updates.push('completed_at = ?');
        values.push(new Date().toISOString());
      }
      
      values.push(operationId);
      
      await this.env.DB.prepare(`
        UPDATE operation_queue 
        SET ${updates.join(', ')} 
        WHERE operation_id = ?
      `).bind(...values).run();
    } catch (error) {
      console.error('Error updating operation status:', error);
    }
  }

  /**
   * Increment retry count and schedule next retry
   */
  async scheduleRetry(operationId: string, retryDelayMs: number = 1000): Promise<boolean> {
    try {
      const operation = await this.env.DB.prepare(`
        SELECT * FROM operation_queue WHERE operation_id = ?
      `).bind(operationId).first() as OperationQueueItem | null;
      
      if (!operation) {
        return false;
      }
      
      const newRetryCount = operation.retry_count + 1;
      
      if (newRetryCount >= operation.max_retries) {
        // Max retries reached, mark as failed
        await this.updateOperationStatus(operationId, 'FAILED', 'Maximum retries exceeded');
        return false;
      }
      
      // Calculate exponential backoff delay
      const delay = retryDelayMs * Math.pow(2, newRetryCount);
      const scheduledAt = new Date(Date.now() + delay).toISOString();
      
      await this.env.DB.prepare(`
        UPDATE operation_queue 
        SET retry_count = ?, status = 'PENDING', scheduled_at = ?
        WHERE operation_id = ?
      `).bind(newRetryCount, scheduledAt, operationId).run();
      
      console.log(`Operation ${operationId} scheduled for retry ${newRetryCount} in ${delay}ms`);
      return true;
    } catch (error) {
      console.error('Error scheduling retry:', error);
      return false;
    }
  }

  /**
   * Cancel an operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    try {
      const result = await this.env.DB.prepare(`
        UPDATE operation_queue 
        SET status = 'CANCELLED', completed_at = ? 
        WHERE operation_id = ? AND status IN ('PENDING', 'PROCESSING')
      `).bind(new Date().toISOString(), operationId).run();
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error cancelling operation:', error);
      return false;
    }
  }

  /**
   * Get operation details
   */
  async getOperation(operationId: string): Promise<OperationQueueItem | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM operation_queue WHERE operation_id = ?
      `).bind(operationId).first();
      
      return result as OperationQueueItem | null;
    } catch (error) {
      console.error('Error getting operation:', error);
      return null;
    }
  }

  /**
   * Get user operations
   */
  async getUserOperations(userId: number, limit: number = 50): Promise<OperationQueueItem[]> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM operation_queue 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `).bind(userId, limit).all();
      
      return result.results as OperationQueueItem[];
    } catch (error) {
      console.error('Error getting user operations:', error);
      return [];
    }
  }

  /**
   * Clean up completed operations older than specified days
   */
  async cleanupCompletedOperations(retentionDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const result = await this.env.DB.prepare(`
        DELETE FROM operation_queue 
        WHERE status IN ('COMPLETED', 'CANCELLED') 
        AND completed_at < ?
      `).bind(cutoffDate.toISOString()).run();
      
      console.log(`Cleaned up ${result.changes} completed operations`);
      return result.changes;
    } catch (error) {
      console.error('Error cleaning up operations:', error);
      return 0;
    }
  }

  /**
   * Start background processing of queued operations
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log('Starting operation queue processing');
    
    // Note: In a real implementation, this would be handled by a cron job
    // or scheduled function rather than a continuous loop
    this.processQueue();
  }

  /**
   * Process queued operations
   */
  private async processQueue(): Promise<void> {
    try {
      const operations = await this.getReadyOperations(this.batchSize);
      
      if (operations.length === 0) {
        // No operations to process, stop processing
        this.isProcessing = false;
        return;
      }

      console.log(`Processing ${operations.length} queued operations`);
      
      for (const operation of operations) {
        await this.processOperation(operation);
      }
      
      // Continue processing if there are more operations
      if (operations.length === this.batchSize) {
        setTimeout(() => this.processQueue(), this.processingInterval);
      } else {
        this.isProcessing = false;
      }
    } catch (error) {
      console.error('Error processing queue:', error);
      this.isProcessing = false;
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: OperationQueueItem): Promise<void> {
    try {
      // Mark as processing
      await this.updateOperationStatus(operation.operation_id, 'PROCESSING');
      
      const payload = JSON.parse(operation.payload) as OperationPayload;
      let success = false;
      let error: string | undefined;
      
      // Process based on operation type
      switch (operation.operation_type) {
        case 'UPLOAD':
          success = await this.processUploadOperation(payload);
          break;
        case 'DELETE':
          success = await this.processDeleteOperation(payload);
          break;
        case 'GET':
          success = await this.processGetOperation(payload);
          break;
        case 'METADATA_UPDATE':
          success = await this.processMetadataUpdateOperation(payload);
          break;
        default:
          error = `Unknown operation type: ${operation.operation_type}`;
          break;
      }
      
      if (success) {
        await this.updateOperationStatus(operation.operation_id, 'COMPLETED');
        console.log(`Operation ${operation.operation_id} completed successfully`);
      } else {
        const retry = await this.scheduleRetry(operation.operation_id);
        if (!retry) {
          await this.updateOperationStatus(operation.operation_id, 'FAILED', error);
        }
      }
    } catch (error) {
      console.error(`Error processing operation ${operation.operation_id}:`, error);
      const retry = await this.scheduleRetry(operation.operation_id);
      if (!retry) {
        await this.updateOperationStatus(operation.operation_id, 'FAILED', String(error));
      }
    }
  }

  /**
   * Process upload operation
   */
  private async processUploadOperation(payload: OperationPayload): Promise<boolean> {
    try {
      if (!payload.fileName || !payload.content) {
        return false;
      }
      
      // Decode base64 content
      const content = Uint8Array.from(atob(payload.content), c => c.charCodeAt(0));
      
      // Attempt R2 upload
      const options: any = {};
      if (payload.contentType) {
        options.httpMetadata = { contentType: payload.contentType };
      }
      
      await this.env.R2_BUCKET.put(payload.fileName, content, options);
      return true;
    } catch (error) {
      console.error('Upload operation failed:', error);
      return false;
    }
  }

  /**
   * Process delete operation
   */
  private async processDeleteOperation(payload: OperationPayload): Promise<boolean> {
    try {
      if (!payload.fileName) {
        return false;
      }
      
      await this.env.R2_BUCKET.delete(payload.fileName);
      return true;
    } catch (error) {
      console.error('Delete operation failed:', error);
      return false;
    }
  }

  /**
   * Process get operation (health check)
   */
  private async processGetOperation(payload: OperationPayload): Promise<boolean> {
    try {
      if (!payload.fileName) {
        return false;
      }
      
      const result = await this.env.R2_BUCKET.get(payload.fileName);
      return result !== null;
    } catch (error) {
      console.error('Get operation failed:', error);
      return false;
    }
  }

  /**
   * Process metadata update operation
   */
  private async processMetadataUpdateOperation(payload: OperationPayload): Promise<boolean> {
    try {
      if (!payload.fileName || !payload.metadata) {
        return false;
      }
      
      // For R2, we need to copy the object with new metadata
      const existingObject = await this.env.R2_BUCKET.get(payload.fileName);
      if (!existingObject) {
        return false;
      }
      
      const options: any = {
        httpMetadata: existingObject.httpMetadata,
        customMetadata: payload.metadata
      };
      
      await this.env.R2_BUCKET.put(payload.fileName, existingObject.body, options);
      return true;
    } catch (error) {
      console.error('Metadata update operation failed:', error);
      return false;
    }
  }
}
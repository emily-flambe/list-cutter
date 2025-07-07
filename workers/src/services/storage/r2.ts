import type { Env } from '../../types';
import { ApiError } from '../../middleware/error';
import { createR2CircuitBreaker } from '../monitoring/circuit-breaker';

// Global circuit breaker instance
let globalCircuitBreaker: ReturnType<typeof createR2CircuitBreaker> | null = null;

function getCircuitBreaker(env: Env) {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = createR2CircuitBreaker(env);
  }
  return globalCircuitBreaker;
}

export async function saveFileToR2(
  env: Env,
  fileName: string,
  content: ArrayBuffer,
  contentType?: string
): Promise<string> {
  const circuitBreaker = getCircuitBreaker(env);
  
  return await circuitBreaker.execute(async () => {
    try {
      const options: {
        httpMetadata?: { contentType: string };
      } = {};

      if (contentType) {
        options.httpMetadata = { contentType };
      }

      await env.R2_BUCKET.put(fileName, content, options);
      
      return fileName;
    } catch (error) {
      console.error('R2 upload error:', error);
      throw new ApiError(500, 'Failed to save file to storage');
    }
  });
}

export async function getFileFromR2(
  env: Env,
  fileName: string
): Promise<R2ObjectBody | null> {
  const circuitBreaker = getCircuitBreaker(env);
  
  return await circuitBreaker.execute(async () => {
    try {
      return await env.R2_BUCKET.get(fileName);
    } catch (error) {
      console.error('R2 get error:', error);
      throw new ApiError(500, 'Failed to retrieve file from storage');
    }
  });
}

export async function deleteFileFromR2(
  env: Env,
  fileName: string
): Promise<void> {
  const circuitBreaker = getCircuitBreaker(env);
  
  return await circuitBreaker.execute(async () => {
    try {
      await env.R2_BUCKET.delete(fileName);
    } catch (error) {
      console.error('R2 delete error:', error);
      throw new ApiError(500, 'Failed to delete file from storage');
    }
  });
}

/**
 * List files in R2 bucket with circuit breaker protection
 */
export async function listFilesFromR2(
  env: Env,
  options?: {
    limit?: number;
    prefix?: string;
    cursor?: string;
  }
): Promise<R2Objects> {
  const circuitBreaker = getCircuitBreaker(env);
  
  return await circuitBreaker.execute(async () => {
    try {
      return await env.R2_BUCKET.list(options);
    } catch (error) {
      console.error('R2 list error:', error);
      throw new ApiError(500, 'Failed to list files from storage');
    }
  });
}

/**
 * Get file metadata from R2 bucket with circuit breaker protection
 */
export async function getFileMetadataFromR2(
  env: Env,
  fileName: string
): Promise<R2Object | null> {
  const circuitBreaker = getCircuitBreaker(env);
  
  return await circuitBreaker.execute(async () => {
    try {
      return await env.R2_BUCKET.head(fileName);
    } catch (error) {
      console.error('R2 head error:', error);
      throw new ApiError(500, 'Failed to get file metadata from storage');
    }
  });
}

/**
 * Get circuit breaker status for R2 operations
 */
export function getR2CircuitBreakerStatus(env: Env) {
  const circuitBreaker = getCircuitBreaker(env);
  return circuitBreaker.getHealthStatus();
}

/**
 * Reset R2 circuit breaker
 */
export async function resetR2CircuitBreaker(env: Env) {
  const circuitBreaker = getCircuitBreaker(env);
  await circuitBreaker.reset();
}
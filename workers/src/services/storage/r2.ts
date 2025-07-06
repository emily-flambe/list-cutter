import type { Env } from '../../types';
import { ApiError } from '../../middleware/error';

export async function saveFileToR2(
  env: Env,
  fileName: string,
  content: ArrayBuffer,
  contentType?: string
): Promise<string> {
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
}

export async function getFileFromR2(
  env: Env,
  fileName: string
): Promise<R2ObjectBody | null> {
  try {
    return await env.R2_BUCKET.get(fileName);
  } catch (error) {
    console.error('R2 get error:', error);
    throw new ApiError(500, 'Failed to retrieve file from storage');
  }
}

export async function deleteFileFromR2(
  env: Env,
  fileName: string
): Promise<void> {
  try {
    await env.R2_BUCKET.delete(fileName);
  } catch (error) {
    console.error('R2 delete error:', error);
    throw new ApiError(500, 'Failed to delete file from storage');
  }
}
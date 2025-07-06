import type { Env } from '../../types';
import { ApiError } from '../../middleware/error';

export async function handleDownload(
  _request: Request,
  env: Env,
  filename: string
): Promise<Response> {
  try {
    const filePath = `uploads/${filename}`;
    const file = await env.R2_BUCKET.get(filePath);
    
    if (!file) {
      throw new ApiError(404, 'File not found');
    }

    return new Response(file.body, {
      headers: {
        'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': file.size.toString()
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Download error:', error);
    throw new ApiError(500, 'Failed to download file');
  }
}
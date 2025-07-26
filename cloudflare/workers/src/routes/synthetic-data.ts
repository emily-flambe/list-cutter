/**
 * Synthetic Data Generation Routes - OpenAPI
 * 
 * Provides endpoints for generating synthetic voter data for testing purposes
 * Now with OpenAPI documentation and validation
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Env } from '../types';
import { validateToken } from '../services/auth/jwt';
import { SyntheticDataGenerator } from '../services/synthetic-data-generator';
import { LocationDataService } from '../services/location-data-service';

// Zod schemas for OpenAPI
const SyntheticDataRequestSchema = z.object({
  count: z.number().int().min(1).max(1000).describe('Number of records to generate (1-1000)'),
  state: z.string().optional().describe('Single state code (e.g., "CA")'),
  states: z.array(z.string()).optional().describe('Array of state codes')
});

const SyntheticDataResponseSchema = z.object({
  success: z.boolean(),
  file: z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    type: z.string(),
    downloadUrl: z.string().optional()
  }),
  metadata: z.object({
    recordCount: z.number(),
    generatedAt: z.string(),
    state: z.string().optional(),
    states: z.array(z.string()).optional()
  })
});

const SupportedStatesResponseSchema = z.object({
  success: z.boolean(),
  states: z.array(z.string())
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.array(z.string()).optional()
});

const syntheticData = new OpenAPIHono<{ Bindings: Env }>();

// Optional authentication middleware - extract user ID if present
syntheticData.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
      c.set('userId', payload.user_id);
    } catch (error) {
      // Authentication failed, but we'll continue without setting userId
    }
  }
  
  await next();
});

// OpenAPI route for supported states
const supportedStatesRoute = createRoute({
  method: 'get',
  path: '/supported-states',
  summary: 'Get supported states for synthetic data generation',
  description: 'Returns a list of US state codes that can be used for generating location-specific synthetic data',
  responses: {
    200: {
      description: 'List of supported states',
      content: {
        'application/json': {
          schema: SupportedStatesResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

syntheticData.openapi(supportedStatesRoute, async (c) => {
  try {
    const locationService = LocationDataService.getInstance();
    const states = await locationService.getSupportedStates();
    
    return c.json({ 
      success: true,
      states: states 
    });
  } catch (error) {
    console.error('Failed to get supported states:', error);
    return c.json({ 
      error: 'Failed to retrieve supported states',
      states: [] // Return empty array as fallback
    }, 500);
  }
});

// OpenAPI route for generating synthetic data
const generateDataRoute = createRoute({
  method: 'post',
  path: '/generate',
  summary: 'Generate synthetic voter data',
  description: 'Creates synthetic voter data in CSV format. Supports filtering by state(s) and allows both authenticated and anonymous access.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SyntheticDataRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Synthetic data generated successfully',
      content: {
        'application/json': {
          schema: SyntheticDataResponseSchema
        }
      }
    },
    400: {
      description: 'Invalid request parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});

syntheticData.openapi(generateDataRoute, async (c) => {
  try {
    const userId = c.get('userId') || 'anonymous';
    console.log('[SYNTHETIC DATA GENERATE] User ID:', userId);
    const requestData = c.req.valid('json');

    // Zod validation handles input validation automatically

    // Generate synthetic data - prioritize states array over single state
    const stateFilter = requestData.states || requestData.state;
    const records = await SyntheticDataGenerator.generateVoterRecords(
      requestData.count, 
      stateFilter
    );

    // Convert to CSV
    const csvContent = SyntheticDataGenerator.recordsToCSV(records);
    const csvBuffer = new TextEncoder().encode(csvContent);

    // Generate file metadata
    const fileId = crypto.randomUUID();
    console.log('[SYNTHETIC DATA GENERATE] Generated file ID:', fileId);
    const now = new Date();
    const timestamp = now.getUTCFullYear().toString() +
      (now.getUTCMonth() + 1).toString().padStart(2, '0') +
      now.getUTCDate().toString().padStart(2, '0') +
      now.getUTCHours().toString().padStart(2, '0') +
      now.getUTCMinutes().toString().padStart(2, '0') +
      now.getUTCSeconds().toString().padStart(2, '0');
    
    const filename = `${timestamp}_synthetic_data_export.csv`;
    const fileKey = `synthetic-data/${userId}/${fileId}/${filename}`;
    console.log('[SYNTHETIC DATA GENERATE] Storing file with key:', fileKey);

    // Upload to R2
    try {
      await c.env.FILE_STORAGE.put(fileKey, csvBuffer, {
        httpMetadata: {
          contentType: 'text/csv',
          contentDisposition: `attachment; filename="${filename}"`
        },
        customMetadata: {
          userId,
          originalName: filename,
          size: csvBuffer.length.toString(),
          uploadedAt: new Date().toISOString(),
          type: 'synthetic-data',
          recordCount: requestData.count.toString(),
          state: requestData.state || '',
          states: requestData.states ? requestData.states.join(',') : ''
        }
      });
      console.log('[SYNTHETIC DATA GENERATE] File successfully uploaded to R2 with key:', fileKey);
      
      // Verify the file was uploaded
      const verifyUpload = await c.env.FILE_STORAGE.head(fileKey);
      console.log('[SYNTHETIC DATA GENERATE] Upload verification:', {
        exists: !!verifyUpload,
        size: verifyUpload?.size,
        uploadedAt: verifyUpload?.uploaded
      });
      
      // Store the file key temporarily in KV to handle R2 eventual consistency
      // This ensures immediate download availability
      if (userId === 'anonymous' && c.env.TEMP_FILE_KEYS) {
        try {
          await c.env.TEMP_FILE_KEYS.put(
            `synthetic-file:${fileId}`,
            fileKey,
            { expirationTtl: 3600 } // Expire after 1 hour
          );
          console.log('[SYNTHETIC DATA GENERATE] Stored file key in KV for immediate access');
        } catch (kvError) {
          console.warn('[SYNTHETIC DATA GENERATE] Failed to store in KV (non-critical):', kvError);
        }
      }
    } catch (uploadError) {
      console.error('[SYNTHETIC DATA GENERATE] Failed to upload file to R2:', uploadError);
      throw new Error('Failed to store generated data');
    }

    // Save file metadata to database only for authenticated users
    if (userId !== 'anonymous') {
      await c.env.DB.prepare(`
        INSERT INTO files (
          id, user_id, filename, original_filename, file_size, mime_type, r2_key,
          upload_status, row_count, column_count, columns_metadata, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        fileId,
        userId,
        filename,
        filename,
        csvBuffer.length,
        'text/csv',
        fileKey,
        'completed',
        requestData.count + 1, // +1 for header row
        9, // Number of columns
        JSON.stringify([
          'voter_id', 'first_name', 'last_name', 'address', 'city', 'state', 'zip', 'phone', 'email'
        ]),
        JSON.stringify(['synthetic-data', 'voter-data', ...(requestData.states || [requestData.state])].filter(Boolean))
      ).run();
    }

    // Prepare response with direct download URL for anonymous users
    const downloadUrl = userId === 'anonymous' 
      ? `/api/v1/synthetic-data/download/${fileId}`
      : `/api/v1/files/${fileId}`;
    
    console.log('[SYNTHETIC DATA GENERATE] Generated download URL:', downloadUrl, 'for userId:', userId);
    
    // Verify the file exists in R2 before returning
    try {
      const verifyKey = await c.env.FILE_STORAGE.head(fileKey);
      if (!verifyKey) {
        console.error('[SYNTHETIC DATA GENERATE] WARNING: File not found immediately after upload:', fileKey);
      } else {
        console.log('[SYNTHETIC DATA GENERATE] File verified in R2:', fileKey, 'size:', verifyKey.size);
      }
    } catch (verifyError) {
      console.error('[SYNTHETIC DATA GENERATE] Failed to verify file:', verifyError);
    }

    const response = {
      success: true,
      file: {
        id: fileId,
        name: filename,
        size: csvBuffer.length,
        type: 'text/csv',
        downloadUrl: downloadUrl
      },
      metadata: {
        recordCount: requestData.count,
        generatedAt: new Date().toISOString(),
        state: requestData.state,
        states: requestData.states
      }
    };

    console.log('[SYNTHETIC DATA GENERATE] Returning file ID in response:', fileId);
    return c.json(response);
  } catch (error) {
    console.error('Synthetic data generation error:', error);
    
    if (error instanceof Error) {
      // Handle specific validation errors from the generator
      if (error.message.includes('Count must be between') || error.message.includes('Invalid state code')) {
        return c.json({ 
          error: 'Invalid input', 
          details: [error.message] 
        }, 400);
      }
    }
    
    return c.json({ 
      error: 'Synthetic data generation failed',
      details: ['An unexpected error occurred while generating data']
    }, 500);
  }
});

// Direct download endpoint for anonymous synthetic data files
syntheticData.get('/download/:fileId', async (c) => {
  try {
    let fileId = c.req.param('fileId');
    console.log('[SYNTHETIC DATA DOWNLOAD] Attempting to download file with ID:', fileId);
    
    // First, check if there's metadata about this file in KV store (handles R2 eventual consistency)
    let fileKey: string | null = null;
    if (c.env.TEMP_FILE_KEYS) {
      try {
        fileKey = await c.env.TEMP_FILE_KEYS.get(`synthetic-file:${fileId}`);
        if (fileKey) {
          console.log('[SYNTHETIC DATA DOWNLOAD] Found file key in KV store:', fileKey);
        } else {
          // Workaround for file ID corruption issue
          // Try with last character ± 1 (handles hex digits)
          const baseId = fileId.substring(0, fileId.length - 1);
          const lastChar = fileId[fileId.length - 1];
          const lastCharCode = lastChar.charCodeAt(0);
          
          console.log('[SYNTHETIC DATA DOWNLOAD] Exact ID not found, trying fuzzy match...');
          console.log('[SYNTHETIC DATA DOWNLOAD] Last character:', lastChar, 'code:', lastCharCode);
          
          for (let offset = -1; offset <= 1; offset++) {
            if (offset === 0) continue; // Skip the original ID we already tried
            
            // Handle both numeric and hex characters
            const newCharCode = lastCharCode + offset;
            const newChar = String.fromCharCode(newCharCode);
            const tryId = baseId + newChar;
            
            console.log('[SYNTHETIC DATA DOWNLOAD] Trying fuzzy match with:', tryId);
            const tryKey = await c.env.TEMP_FILE_KEYS.get(`synthetic-file:${tryId}`);
            
            if (tryKey) {
              console.warn(`[SYNTHETIC DATA DOWNLOAD] Found file with offset ${offset}: ${tryId} (original: ${fileId})`);
              fileKey = tryKey;
              fileId = tryId; // Update the fileId for subsequent operations
              break;
            }
          }
          
          if (!fileKey) {
            // Debug: List all keys to understand the issue
            const kvList = await c.env.TEMP_FILE_KEYS.list({ prefix: 'synthetic-file:' });
            console.log('[SYNTHETIC DATA DOWNLOAD] No fuzzy match found. All KV keys:', kvList.keys.map(k => k.name));
          } else {
            console.log('[SYNTHETIC DATA DOWNLOAD] Fuzzy match successful, fileKey:', fileKey);
          }
        }
      } catch (kvError) {
        console.warn('[SYNTHETIC DATA DOWNLOAD] KV lookup failed (non-critical):', kvError);
      }
    }
    
    // If we have the exact key from KV, try to fetch directly
    if (fileKey) {
      console.log('[SYNTHETIC DATA DOWNLOAD] Attempting direct fetch with fileKey:', fileKey);
      try {
        const object = await c.env.FILE_STORAGE.get(fileKey);
        if (object) {
          const filename = fileKey.split('/').pop() || 'synthetic-data.csv';
          console.log('[SYNTHETIC DATA DOWNLOAD] Serving file directly from KV-stored key:', filename);
          
          return new Response(object.body, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': object.size?.toString() || '0',
              'Cache-Control': 'no-cache'
            }
          });
        } else {
          console.warn('[SYNTHETIC DATA DOWNLOAD] R2 object not found for fileKey:', fileKey);
        }
      } catch (directError) {
        console.warn('[SYNTHETIC DATA DOWNLOAD] Direct fetch with KV key failed:', directError);
      }
    } else {
      console.log('[SYNTHETIC DATA DOWNLOAD] No fileKey from KV, falling back to R2 listing');
    }
    
    // Fallback to listing approach
    // Construct the R2 key prefix for anonymous synthetic data
    let filePrefix = `synthetic-data/anonymous/${fileId}/`;
    console.log('[SYNTHETIC DATA DOWNLOAD] Fallback: Looking for files with prefix:', filePrefix);
    
    // List objects with the prefix to find the actual file
    // Use a more aggressive listing approach with retry
    let listResult = await c.env.FILE_STORAGE.list({ 
      prefix: filePrefix,
      limit: 10  // Increased limit to catch any variations
    });
    
    // If no results, wait and retry (R2 eventual consistency)
    if ((!listResult.objects || listResult.objects.length === 0) && !fileKey) {
      console.log('[SYNTHETIC DATA DOWNLOAD] No files found, waiting for R2 consistency...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      listResult = await c.env.FILE_STORAGE.list({ 
        prefix: filePrefix,
        limit: 10
      });
    }
    
    console.log('[SYNTHETIC DATA DOWNLOAD] List result:', {
      truncated: listResult.truncated,
      cursor: listResult.cursor,
      objectCount: listResult.objects?.length || 0,
      objects: listResult.objects?.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded
      })) || []
    });
    
    if (!listResult.objects || listResult.objects.length === 0) {
      console.log('[SYNTHETIC DATA DOWNLOAD] No files found with prefix:', filePrefix);
      
      // Try fuzzy matching with last character ± 1
      const baseId = fileId.substring(0, fileId.length - 1);
      const lastChar = fileId[fileId.length - 1];
      const lastCharCode = lastChar.charCodeAt(0);
      
      for (let offset = -1; offset <= 1; offset++) {
        if (offset === 0) continue; // Skip the original ID we already tried
        
        const newCharCode = lastCharCode + offset;
        const newChar = String.fromCharCode(newCharCode);
        const tryId = baseId + newChar;
        const tryPrefix = `synthetic-data/anonymous/${tryId}/`;
        
        const fuzzyResult = await c.env.FILE_STORAGE.list({
          prefix: tryPrefix,
          limit: 10
        });
        
        if (fuzzyResult.objects && fuzzyResult.objects.length > 0) {
          console.warn(`[SYNTHETIC DATA DOWNLOAD] R2 fuzzy match found with offset ${offset}: ${tryId} (original: ${fileId})`);
          listResult = fuzzyResult;
          fileId = tryId; // Update fileId for consistency
          filePrefix = tryPrefix;
          break;
        }
      }
      
      // If still no results, debug by listing recent files
      let debugList: any = null;
      if (!listResult.objects || listResult.objects.length === 0) {
        debugList = await c.env.FILE_STORAGE.list({
          prefix: 'synthetic-data/anonymous/',
          limit: 20
        });
        console.log('[SYNTHETIC DATA DOWNLOAD] Debug - Files in synthetic-data/anonymous/:', 
          debugList.objects?.map(obj => ({
            key: obj.key,
            uploaded: obj.uploaded,
            size: obj.size
          })) || []
        );
        
        // Approach 2: Try to find files that contain the fileId anywhere in the path
        const fileIdSearch = debugList.objects?.find(obj => obj.key.includes(fileId));
        if (fileIdSearch) {
          console.log('[SYNTHETIC DATA DOWNLOAD] Found file with fileId in alternative search:', fileIdSearch.key);
          
          // Try to retrieve this file
          const object = await c.env.FILE_STORAGE.get(fileIdSearch.key);
          if (object) {
            const filename = fileIdSearch.key.split('/').pop() || 'synthetic-data.csv';
            console.log('[SYNTHETIC DATA DOWNLOAD] Serving file from alternative search:', filename);
            
            return new Response(object.body, {
              headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': object.size?.toString() || '0',
                'Cache-Control': 'no-cache'
              }
            });
          }
        }
      }
      
      return c.json({ error: 'File not found' }, 404);
    }
    
    // Get the first matching file
    const actualKey = listResult.objects[0].key;
    console.log('[SYNTHETIC DATA DOWNLOAD] Found file with key:', actualKey);
    
    // Add retry logic for R2 eventual consistency
    let object = await c.env.FILE_STORAGE.get(actualKey);
    let retries = 0;
    while (!object && retries < 3) {
      console.log(`[SYNTHETIC DATA DOWNLOAD] Retry ${retries + 1} for key:`, actualKey);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      object = await c.env.FILE_STORAGE.get(actualKey);
      retries++;
    }
    
    if (!object) {
      console.log('[SYNTHETIC DATA DOWNLOAD] Failed to retrieve file data for key after retries:', actualKey);
      return c.json({ error: 'File data not found' }, 404);
    }
    
    // Extract filename from the key
    const filename = actualKey.split('/').pop() || 'synthetic-data.csv';
    console.log('[SYNTHETIC DATA DOWNLOAD] Serving file:', filename, 'Size:', object.size);
    
    // Return file with appropriate headers
    return new Response(object.body, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': object.size?.toString() || '0',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('[SYNTHETIC DATA DOWNLOAD] Error:', error);
    return c.json({ error: 'Download failed' }, 500);
  }
});

export default syntheticData;
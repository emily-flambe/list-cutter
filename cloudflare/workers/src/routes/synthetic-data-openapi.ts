/**
 * Synthetic Data Generation Routes - OpenAPI Version
 * 
 * POC for OpenAPI implementation
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Env } from '../types';
import { validateToken } from '../services/auth/jwt';
import { SyntheticDataGenerator } from '../services/synthetic-data-generator';

// Zod schemas for request/response
const SyntheticDataRequestSchema = z.object({
  count: z.number().int().min(1).max(1000),
  state: z.string().optional(),
  states: z.array(z.string()).optional()
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

const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.array(z.string()).optional()
});

// Create OpenAPI route
const generateRoute = createRoute({
  method: 'post',
  path: '/generate',
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
      description: 'Invalid request',
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

const syntheticData = new OpenAPIHono<{ Bindings: Env }>();

// Optional authentication middleware
syntheticData.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
      c.set('userId', payload.user_id);
    } catch (error) {
      console.log('Optional authentication failed:', error);
    }
  }
  
  await next();
});

// Implement the OpenAPI route
syntheticData.openapi(generateRoute, async (c) => {
  try {
    const userId = c.get('userId') || 'anonymous';
    const requestData = c.req.valid('json');

    // Generate synthetic data
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create state prefix
    let statePrefix = '';
    if (requestData.states && requestData.states.length > 0) {
      statePrefix = requestData.states.length === 1 
        ? `${requestData.states[0]}-`
        : `${requestData.states.length}states-`;
    } else if (requestData.state) {
      statePrefix = `${requestData.state}-`;
    }
    
    const filename = `synthetic-voter-data-${statePrefix}${requestData.count}-records-${timestamp}.csv`;
    const fileKey = `synthetic-data/${userId}/${fileId}/${filename}`;

    // Upload to R2
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

    // Save to DB for authenticated users
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
        requestData.count + 1,
        9,
        JSON.stringify([
          'voter_id', 'first_name', 'last_name', 'address', 'city', 'state', 'zip', 'phone', 'email'
        ]),
        JSON.stringify(['synthetic-data', 'voter-data', ...(requestData.states || [requestData.state])].filter(Boolean))
      ).run();
    }

    const downloadUrl = userId === 'anonymous' 
      ? `/api/v1/synthetic-data/download/${fileId}`
      : `/api/v1/files/${fileId}`;

    return c.json({
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
    });
  } catch (error) {
    console.error('Synthetic data generation error:', error);
    
    if (error instanceof Error) {
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

// Keep other routes unchanged for now
syntheticData.get('/supported-states', async (c) => {
  // ... keeping original implementation
  return c.json({ states: [] });
});

syntheticData.get('/download/:fileId', async (c) => {
  // ... keeping original implementation
  return c.json({ error: 'Not implemented in POC' }, 501);
});

export default syntheticData;
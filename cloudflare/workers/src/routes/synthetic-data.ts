/**
 * Synthetic Data Generation Routes
 * 
 * Provides endpoints for generating synthetic voter data for testing purposes
 */

import { Hono } from 'hono';
import type { Env, SyntheticDataRequest, SyntheticDataResponse } from '../types';
import { validateToken } from '../services/auth/jwt';
import { SyntheticDataGenerator } from '../services/synthetic-data-generator';

const syntheticData = new Hono<{ Bindings: Env }>();

// Middleware to verify authentication
syntheticData.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
    c.set('userId', payload.user_id);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Generate synthetic data endpoint
syntheticData.post('/generate', async (c) => {
  try {
    const userId = c.get('userId');
    const requestData: SyntheticDataRequest = await c.req.json();

    // Input validation
    if (!requestData.count || typeof requestData.count !== 'number') {
      return c.json({ 
        error: 'Invalid input', 
        details: ['count is required and must be a number'] 
      }, 400);
    }

    if (requestData.count < 1 || requestData.count > 1000) {
      return c.json({ 
        error: 'Invalid input', 
        details: ['count must be between 1 and 1000'] 
      }, 400);
    }

    // Validate state if provided
    if (requestData.state && typeof requestData.state !== 'string') {
      return c.json({ 
        error: 'Invalid input', 
        details: ['state must be a string'] 
      }, 400);
    }

    // Generate synthetic data
    const records = SyntheticDataGenerator.generateVoterRecords(
      requestData.count, 
      requestData.state
    );

    // Convert to CSV
    const csvContent = SyntheticDataGenerator.recordsToCSV(records);
    const csvBuffer = new TextEncoder().encode(csvContent);

    // Generate file metadata
    const fileId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const statePrefix = requestData.state ? `${requestData.state}-` : '';
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
        state: requestData.state || ''
      }
    });

    // Save file metadata to database
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
      JSON.stringify(['synthetic-data', 'voter-data', requestData.state].filter(Boolean))
    ).run();

    // Prepare response
    const response: SyntheticDataResponse = {
      success: true,
      file: {
        id: fileId,
        name: filename,
        size: csvBuffer.length,
        type: 'text/csv',
        downloadUrl: `/api/v1/files/${fileId}`
      },
      metadata: {
        recordCount: requestData.count,
        generatedAt: new Date().toISOString(),
        state: requestData.state
      }
    };

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

export default syntheticData;
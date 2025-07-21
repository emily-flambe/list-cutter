/**
 * Synthetic Data Generation Routes
 * 
 * Provides endpoints for generating synthetic voter data for testing purposes
 */

import { Hono } from 'hono';
import type { Env, SyntheticDataRequest, SyntheticDataResponse } from '../types';
import { validateToken } from '../services/auth/jwt';
import { SyntheticDataGenerator } from '../services/synthetic-data-generator';
import { LocationDataService } from '../services/location-data-service';

const syntheticData = new Hono<{ Bindings: Env }>();

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
      console.log('Optional authentication failed:', error);
    }
  }
  
  await next();
});

// Get supported states endpoint
syntheticData.get('/supported-states', async (c) => {
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

// Generate synthetic data endpoint
syntheticData.post('/generate', async (c) => {
  try {
    const userId = c.get('userId') || 'anonymous';
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

    // Validate state/states if provided
    if (requestData.state && typeof requestData.state !== 'string') {
      return c.json({ 
        error: 'Invalid input', 
        details: ['state must be a string'] 
      }, 400);
    }
    
    if (requestData.states && (!Array.isArray(requestData.states) || !requestData.states.every(s => typeof s === 'string'))) {
      return c.json({ 
        error: 'Invalid input', 
        details: ['states must be an array of strings'] 
      }, 400);
    }

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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create state prefix based on what was provided
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

    const response: SyntheticDataResponse = {
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
    const fileId = c.req.param('fileId');
    
    // Construct the R2 key for anonymous synthetic data
    const fileKey = `synthetic-data/anonymous/${fileId}`;
    
    // Try to find the actual file in R2 by listing objects with the prefix
    const objects = await c.env.FILE_STORAGE.list({ prefix: fileKey });
    
    if (!objects.objects || objects.objects.length === 0) {
      return c.json({ error: 'File not found' }, 404);
    }
    
    // Get the first matching file
    const actualKey = objects.objects[0].key;
    const object = await c.env.FILE_STORAGE.get(actualKey);
    
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }
    
    // Extract filename from the key
    const filename = actualKey.split('/').pop() || 'synthetic-data.csv';
    
    // Return file with appropriate headers
    return new Response(object.body, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': object.size?.toString() || '0'
      }
    });
  } catch (error) {
    console.error('Synthetic data download error:', error);
    return c.json({ error: 'Download failed' }, 500);
  }
});

export default syntheticData;
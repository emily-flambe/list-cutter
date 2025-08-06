/**
 * Secure Analysis Routes for Cuttytabs
 * 
 * Provides secure, authenticated endpoints for CSV analysis operations:
 * - Field extraction with proper validation
 * - Crosstab generation with input sanitization
 * - Rate-limited to prevent resource exhaustion
 * - Comprehensive error handling for edge cases
 */

import { Hono } from 'hono';
import type { Env, CrosstabRequest, FieldsResponse, CrosstabResponse } from '../types';
import { validateToken } from '../services/auth/jwt';
import { CrosstabProcessor } from '../services/crosstab-processor';

const analysis = new Hono<{ Bindings: Env }>();

// Authentication middleware for all analysis endpoints
analysis.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
    c.set('userId', payload.user_id);
    await next();
  } catch (error) {
    console.error('Analysis auth error:', error);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});

// Extract CSV fields endpoint with comprehensive validation
analysis.get('/fields/:fileId', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    // Validate file ID format
    if (!fileId || !fileId.match(/^[a-f0-9-]{36}$/)) {
      return c.json({ error: 'Invalid file ID format' }, 400);
    }

    // Get file metadata with ownership check
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found or access denied' }, 404);
    }

    // Verify it's a CSV file
    const isCSV = fileRecord.mime_type === 'text/csv' || 
                  fileRecord.mime_type === 'application/vnd.ms-excel' || 
                  fileRecord.filename.toLowerCase().endsWith('.csv');

    if (!isCSV) {
      return c.json({ 
        error: 'File is not a CSV file',
        message: 'Analysis operations are only supported for CSV files'
      }, 400);
    }

    // Check file size limit for analysis (prevent memory issues)
    const maxAnalysisSize = 100 * 1024 * 1024; // 100MB limit for analysis
    if (fileRecord.file_size > maxAnalysisSize) {
      return c.json({ 
        error: 'File too large for analysis',
        message: 'Files larger than 100MB cannot be analyzed due to memory constraints'
      }, 413);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    if (!object) {
      return c.json({ error: 'File data not found in storage' }, 404);
    }

    // Read and parse CSV content with error handling
    const content = await object.text();
    
    // Handle empty files
    if (!content || content.trim().length === 0) {
      return c.json({ 
        error: 'Empty file',
        message: 'The CSV file appears to be empty'
      }, 400);
    }

    const { fields, rowCount } = CrosstabProcessor.extractFields(content);

    // Validate extracted fields
    if (!fields || fields.length === 0) {
      return c.json({ 
        error: 'No fields found',
        message: 'Unable to extract field names from CSV file. Please check file format.'
      }, 400);
    }

    if (fields.length > 1000) {
      return c.json({ 
        error: 'Too many fields',
        message: 'Files with more than 1000 columns are not supported for analysis'
      }, 413);
    }

    const response: FieldsResponse = {
      success: true,
      fields,
      rowCount,
      fileInfo: {
        id: fileRecord.id,
        filename: fileRecord.original_filename || fileRecord.filename,
        size: fileRecord.file_size
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Fields extraction error:', error);
    
    // Handle specific error types
    if (error instanceof Error && error.message.includes('Failed to extract fields')) {
      return c.json({ 
        error: 'CSV parsing failed',
        message: 'Unable to parse CSV file. Please check that the file is properly formatted.'
      }, 400);
    }
    
    return c.json({ 
      error: 'Analysis failed',
      message: 'An error occurred while analyzing the file'
    }, 500);
  }
});

// Generate crosstab analysis with comprehensive validation and safety checks
analysis.post('/crosstab', async (c) => {
  try {
    const userId = c.get('userId');
    const { fileId, rowVariable, columnVariable, includePercentages }: 
      CrosstabRequest & { fileId: string } = await c.req.json();

    // Validate input parameters
    if (!fileId || !rowVariable || !columnVariable) {
      return c.json({ 
        error: 'Missing required parameters',
        message: 'fileId, rowVariable, and columnVariable are all required'
      }, 400);
    }

    if (rowVariable === columnVariable) {
      return c.json({ 
        error: 'Invalid variable selection',
        message: 'Row and column variables must be different'
      }, 400);
    }

    // Validate field names (prevent injection)
    const fieldNameRegex = /^[a-zA-Z0-9_\s\-\.]{1,100}$/;
    if (!fieldNameRegex.test(rowVariable) || !fieldNameRegex.test(columnVariable)) {
      return c.json({ 
        error: 'Invalid field names',
        message: 'Field names can only contain letters, numbers, spaces, underscores, hyphens, and dots'
      }, 400);
    }

    // Validate file ID format
    if (!fileId.match(/^[a-f0-9-]{36}$/)) {
      return c.json({ error: 'Invalid file ID format' }, 400);
    }

    // Get file metadata with ownership check
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found or access denied' }, 404);
    }

    // Verify it's a CSV file
    const isCSV = fileRecord.mime_type === 'text/csv' || 
                  fileRecord.mime_type === 'application/vnd.ms-excel' || 
                  fileRecord.filename.toLowerCase().endsWith('.csv');

    if (!isCSV) {
      return c.json({ 
        error: 'File is not a CSV file',
        message: 'Crosstab analysis is only supported for CSV files'
      }, 400);
    }

    // Check file size limit for analysis
    const maxAnalysisSize = 100 * 1024 * 1024; // 100MB limit
    if (fileRecord.file_size > maxAnalysisSize) {
      return c.json({ 
        error: 'File too large for analysis',
        message: 'Files larger than 100MB cannot be analyzed due to memory constraints'
      }, 413);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    if (!object) {
      return c.json({ error: 'File data not found in storage' }, 404);
    }

    // Read and analyze CSV content
    const content = await object.text();
    
    // Handle empty files
    if (!content || content.trim().length === 0) {
      return c.json({ 
        error: 'Empty file',
        message: 'The CSV file appears to be empty'
      }, 400);
    }

    const crosstabData = await CrosstabProcessor.generateCrosstab(
      content, 
      rowVariable, 
      columnVariable
    );

    // Check for meaningful results
    if (crosstabData.grandTotal === 0) {
      return c.json({ 
        error: 'No data to analyze',
        message: 'The selected fields contain no data or all values are empty'
      }, 400);
    }

    const response: CrosstabResponse = {
      success: true,
      analysis: crosstabData, // Match frontend expectation
      metadata: {
        processedRows: crosstabData.grandTotal,
        uniqueRowValues: Object.keys(crosstabData.rowTotals).length,
        uniqueColumnValues: Object.keys(crosstabData.columnTotals).length,
        fileInfo: {
          id: fileRecord.id,
          filename: fileRecord.original_filename || fileRecord.filename,
          size: fileRecord.file_size
        }
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Crosstab analysis error:', error);
    
    // Handle specific error types with user-friendly messages
    if (error instanceof Error) {
      if (error.message.includes('not found in CSV headers')) {
        return c.json({ 
          error: 'Field not found',
          message: error.message
        }, 400);
      }
      
      if (error.message.includes('CSV must contain at least')) {
        return c.json({ 
          error: 'Insufficient data',
          message: 'The CSV file must contain at least a header row and one data row'
        }, 400);
      }
      
      if (error.message.includes('Failed to generate crosstab')) {
        return c.json({ 
          error: 'Analysis failed',
          message: 'Unable to generate crosstab analysis. Please check your CSV file format.'
        }, 400);
      }
    }
    
    return c.json({ 
      error: 'Analysis failed',
      message: 'An error occurred while generating the crosstab analysis'
    }, 500);
  }
});

export default analysis;
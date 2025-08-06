/**
 * Consolidated File Routes
 * 
 * Combines all file-related endpoints into a single file:
 * - File upload
 * - File download
 * - File deletion
 * - File listing
 * - CSV processing
 * - CSV field extraction for analysis
 * - Crosstab analysis generation
 * - Crosstab export with file saving
 */

import { Hono } from 'hono';
import type { Env, CrosstabRequest, FieldsResponse, CrosstabResponse, CrosstabExportRequest, CrosstabExportResponse } from '../types';
import { validateFile } from '../services/security/file-validator';
import { validateToken } from '../services/auth/jwt';
import { CrosstabProcessor } from '../services/crosstab-processor';

const files = new Hono<{ Bindings: Env }>();

// Middleware to verify authentication (skip for download endpoint)
files.use('*', async (c, next) => {
  // Allow anonymous access to download endpoint for synthetic data
  if (c.req.method === 'GET' && c.req.path.match(/\/[a-f0-9-]{36}$/)) {
    // This is a download request, check for auth but don't require it
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
        c.set('userId', payload.user_id);
      } catch (error) {
        // Authentication failed, but we'll continue without setting userId
        console.log('Optional authentication failed for download:', error);
      }
    }
    await next();
    return;
  }

  // For all other endpoints, require authentication
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

// Upload file endpoint
files.post('/upload', async (c) => {
  try {
    const userId = c.get('userId');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file
    const validation = await validateFile(file, {
      maxSize: parseInt(c.env.MAX_FILE_SIZE || '52428800'),
      allowedTypes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
      allowedExtensions: ['.csv', '.txt', '.tsv']
    });

    if (!validation.valid) {
      return c.json({ 
        error: 'File validation failed', 
        details: validation.errors 
      }, 400);
    }

    // Generate file ID and key
    const fileId = crypto.randomUUID();
    const fileKey = `files/${userId}/${fileId}/${file.name}`;

    // Upload to R2
    await c.env.FILE_STORAGE.put(fileKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      },
      customMetadata: {
        userId,
        originalName: file.name,
        size: file.size.toString(),
        uploadedAt: new Date().toISOString()
      }
    });

    // Save file metadata to database
    await c.env.DB.prepare(
      `INSERT INTO files (id, user_id, filename, original_filename, r2_key, file_size, mime_type, upload_status, tags) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(fileId, userId, file.name, file.name, fileKey, file.size, file.type, 'completed', JSON.stringify(['upload'])).run();

    // If it's a CSV file, also parse and store the data for segmentation
    let rowCount = 0;
    if (file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.csv')) {
      try {
        // Read and parse CSV content
        const content = await file.text();
        const rows = content.trim().split('\n');
        
        if (rows.length > 1) { // Skip empty files
          const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          // Batch insert CSV rows into D1 for segmentation
          const BATCH_SIZE = 1000;
          for (let i = 1; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));
            const insertValues: string[] = [];
            
            for (const row of batch) {
              const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
              const data: any = {};
              
              // Create object from headers and values
              headers.forEach((header, index) => {
                data[header] = values[index] || '';
              });
              
              const rowId = crypto.randomUUID();
              insertValues.push(`('${rowId}', '${fileId}', '${JSON.stringify(data).replace(/'/g, "''")}')`);
              rowCount++;
            }
            
            if (insertValues.length > 0) {
              await c.env.DB.prepare(`
                INSERT INTO csv_data (id, file_id, data)
                VALUES ${insertValues.join(', ')}
              `).run();
            }
          }
        }
      } catch (parseError) {
        console.warn('CSV parsing failed, file stored without segmentation data:', parseError);
        // Continue - file is still successfully uploaded even if CSV parsing fails
      }
    }

    return c.json({
      success: true,
      file: {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        rowCount: rowCount > 0 ? rowCount : undefined
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

// Download file endpoint - allows anonymous access for synthetic data
files.get('/:fileId', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    // Get file metadata from database - check both authenticated and anonymous users
    let fileRecord;
    if (userId) {
      // Authenticated user - check their files
      fileRecord = await c.env.DB.prepare(
        'SELECT * FROM files WHERE id = ? AND user_id = ?'
      ).bind(fileId, userId).first();
    } else {
      // Anonymous user - check for synthetic data files
      fileRecord = await c.env.DB.prepare(
        'SELECT * FROM files WHERE id = ? AND user_id = ? AND tags LIKE ?'
      ).bind(fileId, 'anonymous', '%synthetic-data%').first();
    }

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Return file with appropriate headers
    return new Response(object.body, {
      headers: {
        'Content-Type': fileRecord.mime_type || 'text/csv',
        'Content-Disposition': `attachment; filename="${fileRecord.original_filename || fileRecord.filename}"`,
        'Content-Length': fileRecord.file_size.toString()
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    return c.json({ error: 'Download failed' }, 500);
  }
});

// Delete file endpoint
files.delete('/:fileId', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    // Get file metadata
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Delete from R2
    await c.env.FILE_STORAGE.delete(fileRecord.r2_key);

    // Delete from database
    await c.env.DB.prepare(
      'DELETE FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).run();

    return c.json({ 
      success: true, 
      message: 'File deleted successfully' 
    });
  } catch (error) {
    console.error('Delete error:', error);
    return c.json({ error: 'Delete failed' }, 500);
  }
});

// List files endpoint - Enhanced for file management
files.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const fileType = c.req.query('type'); // Optional filter for file type

    // Build query with optional CSV filter
    let query = `
      SELECT 
        id, 
        filename, 
        original_filename,
        file_size, 
        mime_type, 
        created_at,
        upload_status,
        tags,
        r2_key
      FROM files 
      WHERE user_id = ?
    `;
    
    const params: any[] = [userId];
    
    // Add CSV filter for MVP (requirement 4.1)
    if (fileType === 'csv' || !fileType) {
      query += ` AND mime_type IN ('text/csv', 'application/vnd.ms-excel', 'text/plain')`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Get files from database
    const files = await c.env.DB.prepare(query).bind(...params).all();

    // Get total count with same filters
    let countQuery = `SELECT COUNT(*) as total FROM files WHERE user_id = ?`;
    const countParams: any[] = [userId];
    
    if (fileType === 'csv' || !fileType) {
      countQuery += ` AND mime_type IN ('text/csv', 'application/vnd.ms-excel', 'text/plain')`;
    }
    
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

    // Transform results to include enhanced metadata
    const enhancedFiles = files.results.map(file => {
      // Parse tags to determine source
      let source = 'upload'; // default
      try {
        const tags = file.tags ? JSON.parse(file.tags) : [];
        if (tags.includes('synthetic-data')) {
          source = 'synthetic-data';
        }
      } catch (e) {
        // If tags parsing fails, use default
      }

      return {
        id: file.id,
        filename: file.original_filename || file.filename,
        size: file.file_size,
        mimeType: file.mime_type,
        createdAt: file.created_at,
        source: source,
        status: file.upload_status || 'completed'
      };
    });

    return c.json({
      success: true,
      files: enhancedFiles,
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    return c.json({ 
      error: 'Failed to list files',
      message: 'Unable to retrieve your files. Please try again.',
      code: 'FILE_LIST_ERROR'
    }, 500);
  }
});

// Simple CSV processing endpoint
files.post('/:fileId/process', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const { operation, parameters } = await c.req.json();

    // Get file metadata
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Read file content
    const content = await object.text();
    
    // Basic CSV processing (example: get row count)
    const rows = content.trim().split('\n');
    const headers = rows[0].split(',');
    
    let result;
    switch (operation) {
      case 'info':
        result = {
          rowCount: rows.length,
          columnCount: headers.length,
          headers: headers,
          fileSize: fileRecord.size_bytes
        };
        break;
      
      case 'slice':
        const start = parameters?.start || 0;
        const end = parameters?.end || rows.length;
        result = {
          data: rows.slice(start, end).join('\n'),
          rowCount: end - start
        };
        break;
      
      default:
        return c.json({ error: 'Unknown operation' }, 400);
    }

    return c.json({ success: true, result });
  } catch (error) {
    console.error('Process error:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

// Extract CSV fields endpoint for analysis
files.get('/:fileId/fields', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    // Get file metadata
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Verify it's a CSV file
    const isCSV = fileRecord.mime_type === 'text/csv' || 
                  fileRecord.mime_type === 'application/vnd.ms-excel' || 
                  fileRecord.filename.toLowerCase().endsWith('.csv');

    if (!isCSV) {
      return c.json({ error: 'File is not a CSV file' }, 400);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Read and parse CSV content
    const content = await object.text();
    const { fields, rowCount } = CrosstabProcessor.extractFields(content);

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
    return c.json({ 
      error: 'Failed to extract fields', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Generate crosstab analysis endpoint
files.post('/:fileId/analyze/crosstab', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const { rowVariable, columnVariable, includePercentages }: CrosstabRequest = await c.req.json();

    // Validate input
    if (!rowVariable || !columnVariable) {
      return c.json({ error: 'Both rowVariable and columnVariable are required' }, 400);
    }

    if (rowVariable === columnVariable) {
      return c.json({ error: 'Row and column variables must be different' }, 400);
    }

    // Get file metadata
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Verify it's a CSV file
    const isCSV = fileRecord.mime_type === 'text/csv' || 
                  fileRecord.mime_type === 'application/vnd.ms-excel' || 
                  fileRecord.filename.toLowerCase().endsWith('.csv');

    if (!isCSV) {
      return c.json({ error: 'File is not a CSV file' }, 400);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Read and analyze CSV content
    const content = await object.text();
    const crosstabData = await CrosstabProcessor.generateCrosstab(content, rowVariable, columnVariable);

    const response: CrosstabResponse = {
      success: true,
      data: crosstabData,
      metadata: {
        processedRows: crosstabData.grandTotal,
        uniqueRowValues: Object.keys(crosstabData.rowTotals).length,
        uniqueColumnValues: Object.keys(crosstabData.columnTotals).length
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Crosstab analysis error:', error);
    return c.json({ 
      error: 'Failed to generate crosstab analysis', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Export crosstab analysis as CSV
files.post('/:fileId/export/crosstab', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const { rowVariable, columnVariable, filename: customFilename }: CrosstabExportRequest = await c.req.json();

    // Validate input
    if (!rowVariable || !columnVariable) {
      return c.json({ error: 'Both rowVariable and columnVariable are required' }, 400);
    }

    if (rowVariable === columnVariable) {
      return c.json({ error: 'Row and column variables must be different' }, 400);
    }

    // Get original file metadata
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();

    if (!fileRecord) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Verify it's a CSV file
    const isCSV = fileRecord.mime_type === 'text/csv' || 
                  fileRecord.mime_type === 'application/vnd.ms-excel' || 
                  fileRecord.filename.toLowerCase().endsWith('.csv');

    if (!isCSV) {
      return c.json({ error: 'File is not a CSV file' }, 400);
    }

    // Get file from R2
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Generate crosstab analysis
    const content = await object.text();
    const crosstabData = await CrosstabProcessor.generateCrosstab(content, rowVariable, columnVariable);

    // Generate CSV export content
    const exportCSV = CrosstabProcessor.generateExportCSV(crosstabData);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const originalName = fileRecord.original_filename || fileRecord.filename;
    const baseName = originalName.replace(/\.[^/.]+$/, ''); // Remove extension
    const exportFilename = customFilename || `crosstab_${baseName}_${rowVariable}_${columnVariable}_${timestamp}.csv`;

    // Generate new file ID and key
    const exportFileId = crypto.randomUUID();
    const exportFileKey = `files/${userId}/${exportFileId}/${exportFilename}`;

    // Calculate file size
    const exportFileSize = new Blob([exportCSV]).size;

    // Upload exported CSV to R2
    await c.env.FILE_STORAGE.put(exportFileKey, exportCSV, {
      httpMetadata: {
        contentType: 'text/csv',
        contentDisposition: `attachment; filename="${exportFilename}"`
      },
      customMetadata: {
        userId,
        originalName: exportFilename,
        size: exportFileSize.toString(),
        uploadedAt: new Date().toISOString(),
        source: 'analysis-crosstab',
        originalFileId: fileId,
        analysisType: 'crosstab',
        rowVariable,
        columnVariable
      }
    });

    // Create tags for the exported file
    const tags = [
      'analysis-crosstab',
      'export',
      `original-file:${fileId}`,
      `analysis:${rowVariable}x${columnVariable}`
    ];

    // Save export file metadata to database
    await c.env.DB.prepare(
      `INSERT INTO files (id, user_id, filename, original_filename, r2_key, file_size, mime_type, upload_status, tags) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(exportFileId, userId, exportFilename, exportFilename, exportFileKey, exportFileSize, 'text/csv', 'completed', JSON.stringify(tags)).run();

    // Generate temporary download URL (valid for 1 hour)
    const downloadUrl = await c.env.FILE_STORAGE.head(exportFileKey);
    
    const response: CrosstabExportResponse = {
      success: true,
      downloadUrl: `/api/v1/files/${exportFileId}`, // Use our download endpoint
      savedFile: {
        id: exportFileId,
        filename: exportFilename,
        size: exportFileSize,
        createdAt: new Date().toISOString()
      },
      message: `Crosstab analysis exported successfully. File saved as "${exportFilename}" in your file list.`
    };

    return c.json(response);
  } catch (error) {
    console.error('Crosstab export error:', error);
    return c.json({ 
      error: 'Failed to export crosstab analysis', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default files;
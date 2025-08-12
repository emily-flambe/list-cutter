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
import type { Env, CrosstabRequest, FieldsResponse, CrosstabResponse, CrosstabExportRequest, CrosstabExportResponse, ColumnsAnalysisResponse, FilterConfiguration } from '../types';
import { validateFile } from '../services/security/file-validator';
import { validateToken } from '../services/auth/jwt';
import { CrosstabProcessor } from '../services/crosstab-processor';
import { DataTypeDetector } from '../services/data-type-detector';
import { QueryProcessor, type QueryRequest, type QueryResult, type ExportRequest, type ExportResult } from '../services/query-processor';

const files = new Hono<{ Bindings: Env }>();

// Middleware to verify authentication (skip for certain endpoints)
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

  // Allow anonymous access to process and export endpoints
  if (c.req.path === '/process' || c.req.path === '/export') {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = await validateToken(token, c.env.JWT_SECRET, c.env.AUTH_KV);
        c.set('userId', payload.user_id);
      } catch (error) {
        console.log('Optional authentication for process/export:', error);
        c.set('userId', 'anonymous');
      }
    } else {
      c.set('userId', 'anonymous');
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
          try {
            // Use CrosstabProcessor for safe CSV parsing
            const { fields: headers } = CrosstabProcessor.extractFields(content);
            
            // Validate and sanitize headers to prevent issues
            const sanitizedHeaders = headers.map(header => {
              // Remove potentially dangerous characters and limit length
              const clean = String(header).replace(/[^\w\s\-_\.]/g, '').trim().substring(0, 100);
              return clean || `field_${Math.random().toString(36).substring(2, 8)}`;
            });
            
            // Batch insert CSV rows into D1 for segmentation using prepared statements
            const BATCH_SIZE = 100; // Reduced batch size for safety
            const insertStatement = c.env.DB.prepare(`
              INSERT INTO csv_data (id, file_id, data) VALUES (?, ?, ?)
            `);
            
            for (let i = 1; i < rows.length && i < 10000; i++) { // Limit total rows processed
              try {
                const row = rows[i];
                if (!row.trim()) continue; // Skip empty rows
                
                // Parse row values safely using basic split (good enough for D1 storage)
                const values = row.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
                const data: any = {};
                
                // Create object from headers and values with validation
                sanitizedHeaders.forEach((header, index) => {
                  const value = values[index] || '';
                  // Limit individual cell values to prevent memory issues
                  data[header] = String(value).substring(0, 1000);
                });
                
                const rowId = crypto.randomUUID();
                
                // Use parameterized query to prevent SQL injection
                await insertStatement.bind(rowId, fileId, JSON.stringify(data)).run();
                rowCount++;
                
                // Process in smaller batches to prevent timeouts
                if (i % BATCH_SIZE === 0) {
                  // Small delay every batch to prevent overwhelming the database
                  await new Promise(resolve => setTimeout(resolve, 1));
                }
              } catch (rowError) {
                console.warn(`Error processing row ${i}:`, rowError);
                // Continue processing other rows instead of failing completely
              }
            }
          } catch (headerError) {
            console.warn('Failed to extract headers, using fallback parsing:', headerError);
            // Fallback to simple parsing if header extraction fails
            const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
            // ... rest of original logic as fallback
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

// Get reference squirrel data for logged-in users
files.get('/reference/squirrel', async (c) => {
  try {
    const userId = c.get('userId');
    
    // Only allow authenticated users to access reference data
    if (!userId) {
      return c.json({ error: 'Authentication required for reference data' }, 401);
    }

    // Get squirrel data from R2
    const object = await c.env.FILE_STORAGE.get('demo/squirrel-data.csv');
    
    if (!object) {
      return c.json({ error: 'Reference squirrel data not found' }, 404);
    }

    // Return file with appropriate headers
    return new Response(object.body, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="demo/squirrel-data.csv"',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour since reference data doesn't change often
      }
    });
  } catch (error) {
    console.error('Reference squirrel data fetch error:', error);
    return c.json({ error: 'Failed to fetch reference data' }, 500);
  }
});

// Get reference squirrel data fields for analysis
files.get('/reference/squirrel/fields', async (c) => {
  try {
    const userId = c.get('userId');
    
    // Only allow authenticated users to access reference data
    if (!userId) {
      return c.json({ error: 'Authentication required for reference data' }, 401);
    }

    // Get squirrel data from R2
    const object = await c.env.FILE_STORAGE.get('demo/squirrel-data.csv');
    
    if (!object) {
      return c.json({ error: 'Reference squirrel data not found' }, 404);
    }

    // Read content and normalize Unicode characters immediately
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
    const fileSize = content.length;

    // Validate processing limits
    CrosstabProcessor.validateProcessingLimits(content, 'field extraction');

    // Extract fields
    const { fields, rowCount } = CrosstabProcessor.extractFields(content);

    const response: FieldsResponse = {
      success: true,
      fields,
      rowCount,
      fileInfo: {
        id: 'reference-squirrel',
        filename: 'demo/squirrel-data.csv',
        size: fileSize
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Reference squirrel fields extraction error:', error);
    return c.json({ 
      error: 'Failed to extract fields from reference data', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Crosstab analysis for reference squirrel data
files.post('/reference/squirrel/analyze/crosstab', async (c) => {
  const startTime = Date.now();
  let fileSize = 0;
  let analysisMetrics: any = {};
  
  try {
    const userId = c.get('userId');
    const { rowVariable, columnVariable, includePercentages }: CrosstabRequest = await c.req.json();

    // Only allow authenticated users to access reference data
    if (!userId) {
      return c.json({ error: 'Authentication required for reference data' }, 401);
    }

    // Validate input - fail fast!
    if (!rowVariable) {
      return c.json({ error: 'rowVariable is required' }, 400);
    }

    // Allow empty columnVariable for single-row counts
    if (columnVariable && rowVariable === columnVariable) {
      return c.json({ error: 'Row and column variables must be different' }, 400);
    }

    // Get squirrel data from R2 with performance monitoring
    const r2StartTime = Date.now();
    const object = await c.env.FILE_STORAGE.get('demo/squirrel-data.csv');
    const r2Time = Date.now() - r2StartTime;
    
    if (!object) {
      return c.json({ error: 'Reference squirrel data not found' }, 404);
    }

    // Read content efficiently and normalize Unicode characters immediately
    const readStartTime = Date.now();
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
    const readTime = Date.now() - readStartTime;
    fileSize = content.length;

    // Validate processing limits
    CrosstabProcessor.validateProcessingLimits(content, 'crosstab analysis');

    // Generate crosstab with performance tracking
    const analysisStartTime = Date.now();
    const crosstabData = await CrosstabProcessor.generateCrosstab(content, rowVariable, columnVariable);
    const analysisTime = Date.now() - analysisStartTime;

    // Calculate comprehensive performance metrics
    const totalTime = Date.now() - startTime;
    const processingMetrics = CrosstabProcessor.getPerformanceMetrics('crosstab_analysis', startTime, fileSize);
    
    analysisMetrics = {
      r2_retrieval_ms: r2Time,
      file_read_ms: readTime,
      analysis_processing_ms: analysisTime,
      total_time_ms: totalTime,
      throughput_mbps: processingMetrics.throughputMBps,
      file_size_mb: processingMetrics.dataSizeMB,
      rows_processed: crosstabData.grandTotal,
      matrix_size: `${Object.keys(crosstabData.rowTotals).length}x${Object.keys(crosstabData.columnTotals).length}`
    };
    
    console.log(`Reference squirrel crosstab analysis performance: R2:${r2Time}ms, Read:${readTime}ms, Analysis:${analysisTime}ms, Total:${totalTime}ms, Throughput:${processingMetrics.throughputMBps.toFixed(2)}MB/s, Matrix:${analysisMetrics.matrix_size}`);

    const response: CrosstabResponse = {
      success: true,
      data: crosstabData,
      metadata: {
        processedRows: crosstabData.grandTotal,
        uniqueRowValues: Object.keys(crosstabData.rowTotals).length,
        uniqueColumnValues: Object.keys(crosstabData.columnTotals).length,
        performance: analysisMetrics
      }
    };

    return c.json(response);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Reference squirrel crosstab analysis failed after ${totalTime}ms:`, error);
    
    return c.json({ 
      error: 'Failed to generate crosstab analysis for reference data', 
      message: error instanceof Error ? error.message : 'Unknown error',
      performance: {
        ...analysisMetrics,
        total_time_ms: totalTime,
        error_occurred: true
      }
    }, 500);
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

// 🐰 RUBY OPTIMIZED: Lightning-fast CSV fields extraction with performance monitoring
files.get('/:fileId/fields', async (c) => {
  const startTime = Date.now();
  let fileSize = 0;
  
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    // Get file metadata with timing
    const dbStartTime = Date.now();
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();
    const dbTime = Date.now() - dbStartTime;

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

    // Get file from R2 with performance monitoring
    const r2StartTime = Date.now();
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    const r2Time = Date.now() - r2StartTime;
    
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Read content with streaming efficiency and normalize Unicode characters immediately
    const readStartTime = Date.now();
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
    const readTime = Date.now() - readStartTime;
    fileSize = content.length;

    // RUBY'S OPTIMIZATION: Validate limits before processing
    CrosstabProcessor.validateProcessingLimits(content, 'field extraction');

    // Extract fields with performance tracking
    const { fields, rowCount } = CrosstabProcessor.extractFields(content);
    
    // Calculate performance metrics
    const totalTime = Date.now() - startTime;
    const metrics = CrosstabProcessor.getPerformanceMetrics('field_extraction', startTime, fileSize);
    
    console.log(`🐰 Field extraction performance: DB:${dbTime}ms, R2:${r2Time}ms, Read:${readTime}ms, Process:${totalTime-dbTime-r2Time-readTime}ms, Total:${totalTime}ms, Throughput:${metrics.throughputMBps.toFixed(2)}MB/s`);

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
    const totalTime = Date.now() - startTime;
    console.error(`🐰 Fields extraction failed after ${totalTime}ms:`, error);
    
    return c.json({ 
      error: 'Failed to extract fields', 
      message: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: totalTime
    }, 500);
  }
});

// 🐰 RUBY OPTIMIZED: Lightning-fast column type detection with intelligent data analysis
files.get('/:fileId/columns', async (c) => {
  const startTime = Date.now();
  let fileSize = 0;
  
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    // Get file metadata with timing
    const dbStartTime = Date.now();
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();
    const dbTime = Date.now() - dbStartTime;

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

    // Get file from R2 with performance monitoring
    const r2StartTime = Date.now();
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    const r2Time = Date.now() - r2StartTime;
    
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Read content with streaming efficiency and normalize Unicode characters immediately
    const readStartTime = Date.now();
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
    const readTime = Date.now() - readStartTime;
    fileSize = content.length;

    // RUBY'S OPTIMIZATION: Validate limits before processing
    CrosstabProcessor.validateProcessingLimits(content, 'column type detection');

    // Analyze column types with performance tracking
    const analysisStartTime = Date.now();
    const typeAnalysis = await DataTypeDetector.analyzeColumnTypes(content);
    const analysisTime = Date.now() - analysisStartTime;
    
    // Get filter suggestions based on detected types
    const filterSuggestions = DataTypeDetector.getFilterSuggestions(typeAnalysis.columns);
    
    // Calculate performance metrics
    const totalTime = Date.now() - startTime;
    const metrics = CrosstabProcessor.getPerformanceMetrics('column_analysis', startTime, fileSize);
    
    console.log(`🐰 Column analysis performance: DB:${dbTime}ms, R2:${r2Time}ms, Read:${readTime}ms, Analysis:${analysisTime}ms, Total:${totalTime}ms, Throughput:${metrics.throughputMBps.toFixed(2)}MB/s`);

    const response: ColumnsAnalysisResponse = {
      success: true,
      columns: typeAnalysis.columns,
      filterSuggestions,
      fileInfo: {
        id: fileRecord.id,
        filename: fileRecord.original_filename || fileRecord.filename,
        size: fileRecord.file_size,
        totalRows: typeAnalysis.fileInfo.totalRows,
        totalColumns: typeAnalysis.fileInfo.totalColumns
      },
      metadata: {
        rowsAnalyzed: typeAnalysis.rowsAnalyzed,
        processingTimeMs: totalTime,
        performance: {
          database_query_ms: dbTime,
          r2_retrieval_ms: r2Time,
          file_read_ms: readTime,
          analysis_processing_ms: analysisTime,
          total_time_ms: totalTime,
          throughput_mbps: metrics.throughputMBps
        }
      }
    };

    return c.json(response);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`🐰 Column analysis failed after ${totalTime}ms:`, error);
    
    return c.json({ 
      error: 'Failed to analyze column types', 
      message: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: totalTime
    }, 500);
  }
});

// 🐰 RUBY OPTIMIZED: Lightning-fast crosstab analysis with full performance monitoring
files.post('/:fileId/analyze/crosstab', async (c) => {
  const startTime = Date.now();
  let fileSize = 0;
  let analysisMetrics: any = {};
  
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const { rowVariable, columnVariable, includePercentages }: CrosstabRequest = await c.req.json();

    // Validate input - fail fast!
    if (!rowVariable) {
      return c.json({ error: 'rowVariable is required' }, 400);
    }

    // Allow empty columnVariable for single-row counts
    if (columnVariable && rowVariable === columnVariable) {
      return c.json({ error: 'Row and column variables must be different' }, 400);
    }

    // Get file metadata with performance tracking
    const dbStartTime = Date.now();
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();
    const dbTime = Date.now() - dbStartTime;

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

    // Get file from R2 with performance monitoring
    const r2StartTime = Date.now();
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    const r2Time = Date.now() - r2StartTime;
    
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Read content efficiently and normalize Unicode characters immediately
    const readStartTime = Date.now();
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
    const readTime = Date.now() - readStartTime;
    fileSize = content.length;

    // RUBY'S OPTIMIZATION: Pre-validate before expensive processing
    CrosstabProcessor.validateProcessingLimits(content, 'crosstab analysis');

    // Generate crosstab with performance tracking
    const analysisStartTime = Date.now();
    const crosstabData = await CrosstabProcessor.generateCrosstab(content, rowVariable, columnVariable);
    const analysisTime = Date.now() - analysisStartTime;

    // Calculate comprehensive performance metrics
    const totalTime = Date.now() - startTime;
    const processingMetrics = CrosstabProcessor.getPerformanceMetrics('crosstab_analysis', startTime, fileSize);
    
    analysisMetrics = {
      database_query_ms: dbTime,
      r2_retrieval_ms: r2Time,
      file_read_ms: readTime,
      analysis_processing_ms: analysisTime,
      total_time_ms: totalTime,
      throughput_mbps: processingMetrics.throughputMBps,
      file_size_mb: processingMetrics.dataSizeMB,
      rows_processed: crosstabData.grandTotal,
      matrix_size: `${Object.keys(crosstabData.rowTotals).length}x${Object.keys(crosstabData.columnTotals).length}`
    };
    
    console.log(`🐰 Crosstab analysis performance: DB:${dbTime}ms, R2:${r2Time}ms, Read:${readTime}ms, Analysis:${analysisTime}ms, Total:${totalTime}ms, Throughput:${processingMetrics.throughputMBps.toFixed(2)}MB/s, Matrix:${analysisMetrics.matrix_size}`);

    const response: CrosstabResponse = {
      success: true,
      data: crosstabData,
      metadata: {
        processedRows: crosstabData.grandTotal,
        uniqueRowValues: Object.keys(crosstabData.rowTotals).length,
        uniqueColumnValues: Object.keys(crosstabData.columnTotals).length,
        performance: analysisMetrics // Include performance data for monitoring
      }
    };

    return c.json(response);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`🐰 Crosstab analysis failed after ${totalTime}ms:`, error);
    
    return c.json({ 
      error: 'Failed to generate crosstab analysis', 
      message: error instanceof Error ? error.message : 'Unknown error',
      performance: {
        ...analysisMetrics,
        total_time_ms: totalTime,
        error_occurred: true
      }
    }, 500);
  }
});

// 🐰 RUBY OPTIMIZED: Lightning-fast crosstab export with streaming and performance monitoring
files.post('/:fileId/export/crosstab', async (c) => {
  const startTime = Date.now();
  let fileSize = 0;
  let exportMetrics: any = {};
  
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const { rowVariable, columnVariable, filename: customFilename }: CrosstabExportRequest = await c.req.json();

    // Validate input - fail fast!
    if (!rowVariable) {
      return c.json({ error: 'rowVariable is required' }, 400);
    }

    // Allow empty columnVariable for single-row counts
    if (columnVariable && rowVariable === columnVariable) {
      return c.json({ error: 'Row and column variables must be different' }, 400);
    }

    // Get original file metadata with timing
    const dbStartTime = Date.now();
    const fileRecord = await c.env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first();
    const dbTime = Date.now() - dbStartTime;

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

    // Get file from R2 with performance monitoring
    const r2StartTime = Date.now();
    const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
    const r2Time = Date.now() - r2StartTime;
    
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    // Read content efficiently and normalize Unicode characters immediately
    const readStartTime = Date.now();
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
    const readTime = Date.now() - readStartTime;
    fileSize = content.length;

    // RUBY'S OPTIMIZATION: Validate before expensive processing
    CrosstabProcessor.validateProcessingLimits(content, 'crosstab export');

    // Generate crosstab analysis with timing
    const analysisStartTime = Date.now();
    const crosstabData = await CrosstabProcessor.generateCrosstab(content, rowVariable, columnVariable);
    const analysisTime = Date.now() - analysisStartTime;

    // Generate CSV export content with timing
    const exportStartTime = Date.now();
    const exportCSV = CrosstabProcessor.generateExportCSV(crosstabData);
    const exportTime = Date.now() - exportStartTime;

    // Generate optimized filename
    const timestamp = new Date().toISOString().split('T')[0];
    const originalName = fileRecord.original_filename || fileRecord.filename;
    const baseName = originalName.replace(/\.[^/.]+$/, ''); // Remove extension
    const exportFilename = customFilename || `crosstab_${baseName}_${rowVariable}_${columnVariable}_${timestamp}.csv`;

    // Generate new file ID and key
    const exportFileId = crypto.randomUUID();
    const exportFileKey = `files/${userId}/${exportFileId}/${exportFilename}`;

    // RUBY OPTIMIZATION: Calculate size more efficiently
    const exportFileSize = new TextEncoder().encode(exportCSV).length;

    // Upload exported CSV to R2 with timing
    const uploadStartTime = Date.now();
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
        columnVariable,
        performance: JSON.stringify({
          processingTimeMs: Date.now() - startTime,
          originalFileSizeMB: (fileSize / (1024 * 1024)).toFixed(2)
        })
      }
    });
    const uploadTime = Date.now() - uploadStartTime;

    // Create tags for the exported file
    const tags = [
      'analysis-crosstab',
      'export',
      `original-file:${fileId}`,
      `analysis:${rowVariable}x${columnVariable}`,
      'ruby-optimized'  // Mark as performance optimized!
    ];

    // Save export file metadata to database with timing
    const dbSaveStartTime = Date.now();
    await c.env.DB.prepare(
      `INSERT INTO files (id, user_id, filename, original_filename, r2_key, file_size, mime_type, upload_status, tags) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(exportFileId, userId, exportFilename, exportFilename, exportFileKey, exportFileSize, 'text/csv', 'completed', JSON.stringify(tags)).run();
    const dbSaveTime = Date.now() - dbSaveStartTime;

    // Calculate comprehensive performance metrics
    const totalTime = Date.now() - startTime;
    const processingMetrics = CrosstabProcessor.getPerformanceMetrics('crosstab_export', startTime, fileSize);
    
    exportMetrics = {
      database_query_ms: dbTime,
      r2_retrieval_ms: r2Time,
      file_read_ms: readTime,
      analysis_processing_ms: analysisTime,
      csv_generation_ms: exportTime,
      r2_upload_ms: uploadTime,
      database_save_ms: dbSaveTime,
      total_time_ms: totalTime,
      throughput_mbps: processingMetrics.throughputMBps,
      original_file_size_mb: processingMetrics.dataSizeMB,
      export_file_size_bytes: exportFileSize,
      compression_ratio: (exportFileSize / fileSize * 100).toFixed(1) + '%'
    };
    
    console.log(`🐰 Crosstab export performance: DB:${dbTime}ms, R2Get:${r2Time}ms, Read:${readTime}ms, Analysis:${analysisTime}ms, Export:${exportTime}ms, Upload:${uploadTime}ms, Save:${dbSaveTime}ms, Total:${totalTime}ms, Throughput:${processingMetrics.throughputMBps.toFixed(2)}MB/s`);
    
    const response: CrosstabExportResponse = {
      success: true,
      downloadUrl: `/api/v1/files/${exportFileId}`, // Use our download endpoint
      savedFile: {
        id: exportFileId,
        filename: exportFilename,
        size: exportFileSize,
        createdAt: new Date().toISOString()
      },
      message: `Crosstab analysis exported in ${totalTime}ms! File saved as "${exportFilename}" in your file list.`
    };

    return c.json(response);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`🐰 Crosstab export failed after ${totalTime}ms:`, error);
    
    return c.json({ 
      error: 'Failed to export crosstab analysis', 
      message: error instanceof Error ? error.message : 'Unknown error',
      performance: {
        ...exportMetrics,
        total_time_ms: totalTime,
        error_occurred: true
      }
    }, 500);
  }
});

// 🐱 CHARLIE'S CUT QUERY ENDPOINT: Phase 2 filtering with excellent performance
files.post('/:fileId/query', async (c) => {
  const startTime = Date.now();
  
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const queryRequest: QueryRequest = await c.req.json();

    console.log(`🐱 CUT query started for file ${fileId} with ${queryRequest.filters?.length || 0} filters`);

    // Execute query using QueryProcessor with correct parameters
    const result = await QueryProcessor.executeQuery(fileId, queryRequest, c.env, userId);

    const totalTime = Date.now() - startTime;
    
    // Safe access to result.data properties with null checks
    if (result.success && result.data) {
      console.log(`🐱 CUT query completed successfully in ${totalTime}ms: ${result.data.filteredCount}/${result.data.totalRows} rows match filters`);
    } else {
      console.log(`🐱 CUT query completed with error in ${totalTime}ms`);
    }

    return c.json(result);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`🐱 CUT query failed after ${totalTime}ms:`, error);
    
    return c.json({ 
      error: 'Failed to execute query', 
      message: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: totalTime
    }, 500);
  }
});

// 🐱 CHARLIE'S CUT EXPORT ENDPOINT: Export filtered data as CSV
files.post('/:fileId/export/filtered', async (c) => {
  const startTime = Date.now();
  
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const queryRequest: QueryRequest & { filename?: string } = await c.req.json();

    // Validate the query request has fileId
    if (!queryRequest.fileId) {
      queryRequest.fileId = fileId; // Use URL param if not in body
    }

    // Ensure fileId matches URL param for security
    if (queryRequest.fileId !== fileId) {
      return c.json({ error: 'File ID mismatch between URL and request body' }, 400);
    }

    console.log(`🐱 CUT export started for file ${fileId} with ${queryRequest.filters?.length || 0} filters`);

    // Export filtered data using QueryProcessor
    const exportResult = await QueryProcessor.exportFilteredData(
      fileId,
      queryRequest, 
      c.env, 
      userId
    );

    // Check if we got valid export result
    if (!exportResult.success || !exportResult.fileId) {
      console.error('🐱 Export failed - no data generated');
      return c.json({ 
        error: 'Export failed - no data generated', 
        details: exportResult.error 
      }, 500);
    }
    
    // The file has already been saved to R2 and database by QueryProcessor.exportFilteredData
    // We just need to use the fileId and filename it returned
    const exportFileId = exportResult.fileId;
    const exportFilename = exportResult.filename;
    const exportFileSize = exportResult.metadata?.fileSize || 0;

    const totalTime = Date.now() - startTime;
    console.log(`🐱 CUT export completed in ${totalTime}ms: ${exportResult.metadata?.filteredRows || 0}/${exportResult.metadata?.totalRows || 0} rows exported`);

    return c.json({
      success: true,
      downloadUrl: `/api/v1/files/${exportFileId}`,
      savedFile: {
        id: exportFileId,
        filename: exportFilename,
        size: exportFileSize,
        createdAt: new Date().toISOString()
      },
      metadata: {
        ...exportResult.metadata,
        processingTimeMs: totalTime
      },
      message: `Filtered data exported in ${totalTime}ms! ${exportResult.metadata?.filteredRows || 0} rows saved as "${exportFilename}".`
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`🐱 CUT export failed after ${totalTime}ms:`, error);
    
    return c.json({ 
      error: 'Failed to export filtered data', 
      message: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: totalTime
    }, 500);
  }
});

// 🐱 CHARLIE'S PERFORMANCE ANALYSIS ENDPOINT: Get optimal filtering strategy for file
files.get('/:fileId/performance', async (c) => {
  try {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');

    console.log(`🐱 Performance analysis requested for file ${fileId}`);

    // Analyze file performance using QueryProcessor
    const analysis = await QueryProcessor.getPerformanceStrategy(fileId, c.env, userId);

    console.log(`🐱 Performance analysis complete: ${analysis.strategy} strategy recommended for ${analysis.estimatedRows} rows`);

    return c.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    console.error(`🐱 Performance analysis failed:`, error);
    
    return c.json({ 
      error: 'Failed to analyze file performance', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Anonymous/Authenticated CSV processing endpoint
files.post('/process', async (c) => {
  try {
    const userId = c.get('userId') || 'anonymous';
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

    // Read file content
    const content = await file.text();
    const rows = content.trim().split('\n');
    const headers = rows[0].split(',').map(h => h.trim());

    // For anonymous users, store temporarily in R2
    const fileId = crypto.randomUUID();
    const fileKey = userId === 'anonymous' 
      ? `temp/${fileId}/${file.name}`
      : `files/${userId}/${fileId}/${file.name}`;

    // Store file in R2
    await c.env.FILE_STORAGE.put(fileKey, content, {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      },
      customMetadata: {
        userId,
        originalName: file.name,
        size: file.size.toString(),
        uploadedAt: new Date().toISOString(),
        temporary: userId === 'anonymous' ? 'true' : 'false'
      }
    });

    // For authenticated users, save to database
    if (userId !== 'anonymous') {
      await c.env.DB.prepare(
        `INSERT INTO files (id, user_id, filename, original_filename, r2_key, file_size, mime_type, upload_status, tags) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        fileId, 
        userId, 
        file.name, 
        file.name, 
        fileKey, 
        file.size, 
        file.type, 
        'completed', 
        JSON.stringify(['uploaded', 'csv'])
      ).run();
    }

    return c.json({
      success: true,
      columns: headers,
      file_path: fileId,
      rowCount: rows.length - 1,
      message: userId === 'anonymous' 
        ? 'File processed temporarily. Download your results before leaving.'
        : 'File uploaded and saved to your account.'
    });
  } catch (error) {
    console.error('Process error:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

// Anonymous/Authenticated CSV export endpoint
files.post('/export', async (c) => {
  try {
    const userId = c.get('userId') || 'anonymous';
    const { columns, file_path: fileId, filters } = await c.req.json();

    if (!fileId || !columns || columns.length === 0) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    // Get file from R2
    const fileKey = userId === 'anonymous' 
      ? `temp/${fileId}/`
      : `files/${userId}/${fileId}/`;

    // List files with the prefix to find the actual file
    const listResult = await c.env.FILE_STORAGE.list({ prefix: fileKey, limit: 1 });
    if (!listResult.objects || listResult.objects.length === 0) {
      // Try to find it in the database for authenticated users
      if (userId !== 'anonymous') {
        const fileRecord = await c.env.DB.prepare(
          'SELECT r2_key FROM files WHERE id = ? AND user_id = ?'
        ).bind(fileId, userId).first();
        
        if (fileRecord) {
          const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
          if (object) {
            const content = await object.text();
            const filteredCsv = processCSV(content, columns, filters);
            return new Response(filteredCsv, {
              headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="filtered.csv"'
              }
            });
          }
        }
      }
      return c.json({ error: 'File not found' }, 404);
    }

    // Get the file
    const object = await c.env.FILE_STORAGE.get(listResult.objects[0].key);
    if (!object) {
      return c.json({ error: 'File data not found' }, 404);
    }

    const content = await object.text();
    const filteredCsv = processCSV(content, columns, filters);

    return new Response(filteredCsv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="filtered.csv"'
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: 'Export failed' }, 500);
  }
});

// Save filtered CSV to user's files (authenticated only)
files.post('/save', async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId || userId === 'anonymous') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const formData = await c.req.formData();
    const filename = formData.get('filename') as string;
    const metadata = formData.get('metadata') as string;
    const file_path = formData.get('file_path') as string; // The original file ID
    const columns = formData.get('columns') as string;
    const filters = formData.get('filters') as string;

    if (!filename || !file_path) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    // Parse columns and filters
    const selectedColumns = columns ? JSON.parse(columns) : [];
    const appliedFilters = filters ? JSON.parse(filters) : {};

    // Get the original file from R2 or database
    let content: string | null = null;
    
    // First try temp storage (for recently processed files)
    const tempKey = `temp/${file_path}/`;
    const tempList = await c.env.FILE_STORAGE.list({ prefix: tempKey, limit: 1 });
    if (tempList.objects && tempList.objects.length > 0) {
      const object = await c.env.FILE_STORAGE.get(tempList.objects[0].key);
      if (object) {
        content = await object.text();
      }
    }

    // If not found in temp, try user's files
    if (!content) {
      const fileRecord = await c.env.DB.prepare(
        'SELECT r2_key FROM files WHERE id = ? AND user_id = ?'
      ).bind(file_path, userId).first();
      
      if (fileRecord) {
        const object = await c.env.FILE_STORAGE.get(fileRecord.r2_key);
        if (object) {
          content = await object.text();
        }
      }
    }

    if (!content) {
      return c.json({ error: 'Original file not found' }, 404);
    }

    // Process the CSV with filters
    const filteredCsv = processCSV(content, selectedColumns, appliedFilters);

    // Generate new file ID and save
    const newFileId = crypto.randomUUID();
    const newFileKey = `files/${userId}/${newFileId}/${filename}`;

    // Save filtered CSV to R2
    await c.env.FILE_STORAGE.put(newFileKey, filteredCsv, {
      httpMetadata: {
        contentType: 'text/csv',
        contentDisposition: `attachment; filename="${filename}"`
      },
      customMetadata: {
        userId,
        originalName: filename,
        size: filteredCsv.length.toString(),
        uploadedAt: new Date().toISOString(),
        source: 'cut-filtered',
        ...(metadata ? JSON.parse(metadata) : {})
      }
    });

    // Save to database
    await c.env.DB.prepare(
      `INSERT INTO files (id, user_id, filename, original_filename, r2_key, file_size, mime_type, upload_status, tags) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newFileId, 
      userId, 
      filename, 
      filename, 
      newFileKey, 
      filteredCsv.length, 
      'text/csv', 
      'completed', 
      JSON.stringify(['cut-filtered', 'saved', `columns:${selectedColumns.length}`])
    ).run();

    return c.json({
      success: true,
      fileId: newFileId,
      filename,
      message: 'File saved to your collection!'
    });
  } catch (error) {
    console.error('Save error:', error);
    return c.json({ error: 'Failed to save file' }, 500);
  }
});

// Helper function to process CSV with filters
function processCSV(content: string, columns: string[], filters: any): string {
  const rows = content.trim().split('\n');
  const headers = rows[0].split(',').map(h => h.trim());
  
  // Find column indices
  const columnIndices = columns.map(col => headers.indexOf(col)).filter(i => i !== -1);
  
  if (columnIndices.length === 0) {
    return '';
  }

  // Build result CSV
  const resultRows: string[] = [];
  
  // Add headers
  resultRows.push(columnIndices.map(i => headers[i]).join(','));
  
  // Process data rows
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(',');
    let includeRow = true;
    
    // Apply filters
    for (const col of columns) {
      if (filters[col]) {
        const colIndex = headers.indexOf(col);
        if (colIndex !== -1) {
          const value = values[colIndex]?.trim();
          const filter = filters[col];
          
          // Simple filter logic (can be enhanced)
          if (filter.startsWith('>')) {
            const threshold = parseFloat(filter.substring(1));
            if (isNaN(threshold) || parseFloat(value) <= threshold) {
              includeRow = false;
              break;
            }
          } else if (filter.startsWith('<')) {
            const threshold = parseFloat(filter.substring(1));
            if (isNaN(threshold) || parseFloat(value) >= threshold) {
              includeRow = false;
              break;
            }
          } else if (filter.startsWith('!=')) {
            const compareValue = filter.substring(2).trim();
            if (value === compareValue) {
              includeRow = false;
              break;
            }
          } else if (filter.startsWith('=')) {
            const compareValue = filter.substring(1).trim();
            if (value !== compareValue) {
              includeRow = false;
              break;
            }
          } else if (filter.toLowerCase().includes('like')) {
            const pattern = filter.toLowerCase().replace('like', '').trim().replace(/%/g, '.*');
            const regex = new RegExp(pattern, 'i');
            if (!regex.test(value)) {
              includeRow = false;
              break;
            }
          }
        }
      }
    }
    
    if (includeRow) {
      resultRows.push(columnIndices.map(i => values[i] || '').join(','));
    }
  }
  
  return resultRows.join('\n');
}

export default files;
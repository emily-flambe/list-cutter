/**
 * Public API Routes - No Authentication Required
 * 
 * Provides anonymous access to demo features using NYC Squirrel Census data:
 * - Squirrel data download for anonymous users
 * - Field extraction for analysis without login
 * - Crosstab analysis generation for demo purposes
 * 
 * Security: Rate-limited and restricted to squirrel reference data only
 */

import { Hono } from 'hono';
import type { CrosstabRequest, FieldsResponse, CrosstabResponse } from '../types';
import type { CloudflareEnv } from '../types/env';
import { CrosstabProcessor } from '../services/crosstab-processor';

const publicRoutes = new Hono<{ Bindings: CloudflareEnv }>();

// Public squirrel data download endpoint - no authentication required
publicRoutes.get('/squirrel/data', async (c) => {
  try {
    console.log('Public squirrel data request from anonymous user');

    // Get squirrel data from R2
    const object = await c.env.FILE_STORAGE.get('reference-data/squirrel-data-full.csv');
    
    if (!object) {
      return c.json({ 
        error: 'Demo data not found',
        message: 'NYC Squirrel Census data is temporarily unavailable' 
      }, 404);
    }

    // Return file with appropriate headers for demo use
    return new Response(object.body, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="nyc-squirrel-census-demo.csv"',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour since reference data doesn't change
        'X-Demo-Data': 'true'
      }
    });
  } catch (error) {
    console.error('Public squirrel data fetch error:', error);
    return c.json({ 
      error: 'Failed to fetch demo data',
      message: 'Unable to retrieve NYC Squirrel Census data for demo'
    }, 500);
  }
});

// Public squirrel data fields extraction - no authentication required
publicRoutes.get('/squirrel/fields', async (c) => {
  try {
    console.log('Public squirrel fields extraction request from anonymous user');

    // Get squirrel data from R2
    const object = await c.env.FILE_STORAGE.get('reference-data/squirrel-data-full.csv');
    
    if (!object) {
      return c.json({ 
        error: 'Demo data not found',
        message: 'NYC Squirrel Census data is temporarily unavailable'
      }, 404);
    }

    // Read content
    const content = await object.text();
    const fileSize = content.length;

    // Validate processing limits for security
    CrosstabProcessor.validateProcessingLimits(content, 'public field extraction');

    // Extract fields
    const { fields, rowCount } = CrosstabProcessor.extractFields(content);

    const response: FieldsResponse = {
      success: true,
      fields,
      rowCount,
      fileInfo: {
        id: 'demo-squirrel-data',
        filename: 'NYC Squirrel Census Demo Data',
        size: fileSize
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Public squirrel fields extraction error:', error);
    return c.json({ 
      error: 'Failed to extract fields from demo data', 
      message: error instanceof Error ? error.message : 'Unable to analyze NYC Squirrel Census data'
    }, 500);
  }
});

// Public squirrel crosstab analysis - no authentication required
publicRoutes.post('/squirrel/analyze/crosstab', async (c) => {
  const startTime = Date.now();
  let fileSize = 0;
  let analysisMetrics: any = {};
  
  try {
    console.log('Public squirrel crosstab analysis request from anonymous user');
    const { rowVariable, columnVariable, includePercentages }: CrosstabRequest = await c.req.json();

    // Validate input - fail fast for anonymous users
    if (!rowVariable || !columnVariable) {
      return c.json({ 
        error: 'Both rowVariable and columnVariable are required',
        message: 'Please select both row and column variables for the crosstab analysis'
      }, 400);
    }

    if (rowVariable === columnVariable) {
      return c.json({ 
        error: 'Row and column variables must be different',
        message: 'Please select different variables for rows and columns'
      }, 400);
    }

    // Validate field names for security (same validation as authenticated routes)
    const fieldNameRegex = /^[a-zA-Z0-9_\s\-\.]{1,100}$/;
    if (!fieldNameRegex.test(rowVariable) || !fieldNameRegex.test(columnVariable)) {
      return c.json({ 
        error: 'Invalid field names',
        message: 'Field names can only contain letters, numbers, spaces, underscores, hyphens, and dots'
      }, 400);
    }

    // Get squirrel data from R2 with performance monitoring
    const r2StartTime = Date.now();
    const object = await c.env.FILE_STORAGE.get('reference-data/squirrel-data-full.csv');
    const r2Time = Date.now() - r2StartTime;
    
    if (!object) {
      return c.json({ 
        error: 'Demo data not found',
        message: 'NYC Squirrel Census data is temporarily unavailable'
      }, 404);
    }

    // Read content efficiently
    const readStartTime = Date.now();
    const content = await object.text();
    const readTime = Date.now() - readStartTime;
    fileSize = content.length;

    // Validate processing limits for public access
    CrosstabProcessor.validateProcessingLimits(content, 'public crosstab analysis');

    // Generate crosstab with performance tracking
    const analysisStartTime = Date.now();
    const crosstabData = await CrosstabProcessor.generateCrosstab(content, rowVariable, columnVariable);
    const analysisTime = Date.now() - analysisStartTime;

    // Calculate performance metrics
    const totalTime = Date.now() - startTime;
    const processingMetrics = CrosstabProcessor.getPerformanceMetrics('public_crosstab_analysis', startTime, fileSize);
    
    analysisMetrics = {
      r2_retrieval_ms: r2Time,
      file_read_ms: readTime,
      analysis_processing_ms: analysisTime,
      total_time_ms: totalTime,
      throughput_mbps: processingMetrics.throughputMBps,
      file_size_mb: processingMetrics.dataSizeMB,
      rows_processed: crosstabData.grandTotal,
      matrix_size: `${Object.keys(crosstabData.rowTotals).length}x${Object.keys(crosstabData.columnTotals).length}`,
      demo_mode: true
    };
    
    console.log(`Public squirrel crosstab analysis performance: R2:${r2Time}ms, Read:${readTime}ms, Analysis:${analysisTime}ms, Total:${totalTime}ms, Throughput:${processingMetrics.throughputMBps.toFixed(2)}MB/s, Matrix:${analysisMetrics.matrix_size}`);

    const response: CrosstabResponse = {
      success: true,
      data: crosstabData,
      metadata: {
        processedRows: crosstabData.grandTotal,
        uniqueRowValues: Object.keys(crosstabData.rowTotals).length,
        uniqueColumnValues: Object.keys(crosstabData.columnTotals).length,
        performance: analysisMetrics,
        demoMode: true,
        dataSource: 'NYC Squirrel Census 2018'
      }
    };

    return c.json(response);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Public squirrel crosstab analysis failed after ${totalTime}ms:`, error);
    
    // Handle specific error types with user-friendly messages for demo users
    if (error instanceof Error) {
      if (error.message.includes('not found in CSV headers')) {
        return c.json({ 
          error: 'Field not found in demo data',
          message: `The field "${error.message.includes(rowVariable) ? rowVariable : columnVariable}" was not found in the NYC Squirrel Census data. Please select from the available fields.`
        }, 400);
      }
    }
    
    return c.json({ 
      error: 'Failed to generate demo analysis', 
      message: error instanceof Error ? error.message : 'Unable to analyze NYC Squirrel Census data',
      performance: {
        ...analysisMetrics,
        total_time_ms: totalTime,
        error_occurred: true,
        demo_mode: true
      }
    }, 500);
  }
});

// Demo information endpoint
publicRoutes.get('/squirrel/info', async (c) => {
  return c.json({
    success: true,
    demo: {
      name: 'NYC Squirrel Census 2018',
      description: 'The Squirrel Census is a multimedia science, design, and storytelling project focusing on the Eastern gray squirrel, found throughout Central Park.',
      source: 'NYC Parks & Recreation and Squirrel Census volunteers',
      fields: 'Location coordinates, squirrel behaviors, physical characteristics, and interaction data',
      recordCount: 'Approximately 3,000+ squirrel sightings',
      usage: 'Perfect for learning crosstab analysis - try comparing Age vs Primary Fur Color, or Location vs Activities!'
    },
    message: 'Try our analysis features with real NYC data! No login required.',
    suggestedAnalyses: [
      { row: 'Age', column: 'Primary Fur Color', description: 'Compare age distribution across fur colors' },
      { row: 'Location', column: 'Activities', description: 'See what activities happen in different locations' },
      { row: 'Date', column: 'Approaches', description: 'Track seasonal behavior patterns' }
    ]
  });
});

export default publicRoutes;
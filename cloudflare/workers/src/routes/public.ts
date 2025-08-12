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
import { DataTypeDetector } from '../services/data-type-detector';
import { FilterProcessor } from '../services/filter-processor';

const publicRoutes = new Hono<{ Bindings: CloudflareEnv }>();

// Available demo datasets
const DEMO_DATASETS: Record<string, {
  filename: string;
  displayName: string;
  downloadName: string;
  description: string;
}> = {
  'squirrel': {
    filename: 'demo/squirrel-data.csv',
    displayName: 'NYC Squirrel Census',
    downloadName: 'nyc-squirrel-census-demo.csv',
    description: 'NYC Squirrel Census data'
  },
  'npors2025': {
    filename: 'demo/NPORS_2025.csv',
    displayName: '2025 National Public Opinion Reference Survey',
    downloadName: 'npors-2025-demo.csv',
    description: '2025 National Public Opinion Reference Survey data'
  }
};

// Public demo data download endpoint - no authentication required
publicRoutes.get('/demo/:dataset/data', async (c) => {
  try {
    const datasetKey = c.req.param('dataset');
    const dataset = DEMO_DATASETS[datasetKey];
    
    if (!dataset) {
      return c.json({ 
        error: 'Dataset not found',
        message: 'Requested demo dataset is not available',
        availableDatasets: Object.keys(DEMO_DATASETS)
      }, 404);
    }

    console.log(`Public ${dataset.displayName} data request from anonymous user`);

    // Get data from R2
    const object = await c.env.FILE_STORAGE.get(dataset.filename);
    
    if (!object) {
      return c.json({ 
        error: 'Demo data not found',
        message: `${dataset.displayName} data is temporarily unavailable` 
      }, 404);
    }

    // Return file with appropriate headers for demo use
    return new Response(object.body, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${dataset.downloadName}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour since reference data doesn't change
        'X-Demo-Data': 'true',
        'X-Dataset': datasetKey
      }
    });
  } catch (error) {
    console.error('Public demo data fetch error:', error);
    return c.json({ 
      error: 'Failed to fetch demo data',
      message: 'Unable to retrieve demo data'
    }, 500);
  }
});

// Legacy endpoint for backward compatibility
publicRoutes.get('/squirrel/data', async (c) => {
  // Redirect to new endpoint structure
  return c.redirect('/api/v1/public/demo/squirrel/data', 301);
});

// Public demo data fields extraction - no authentication required
publicRoutes.get('/demo/:dataset/fields', async (c) => {
  try {
    const datasetKey = c.req.param('dataset');
    const dataset = DEMO_DATASETS[datasetKey];
    
    if (!dataset) {
      return c.json({ 
        error: 'Dataset not found',
        message: 'Requested demo dataset is not available',
        availableDatasets: Object.keys(DEMO_DATASETS)
      }, 404);
    }

    console.log(`Public ${dataset.displayName} fields extraction request from anonymous user`);

    // Get data from R2
    const object = await c.env.FILE_STORAGE.get(dataset.filename);
    
    if (!object) {
      return c.json({ 
        error: 'Demo data not found',
        message: `${dataset.displayName} data is temporarily unavailable`
      }, 404);
    }

    // Read content and normalize Unicode characters immediately  
    const rawContent = await object.text();
    
    // Debug: Check for problematic characters in raw content
    if (rawContent.includes('───') || rawContent.includes('���')) {
      console.log(`🚨 Found problematic characters in ${dataset.displayName} data:`, {
        hasBoxDrawing: rawContent.includes('───'),
        hasReplacementChars: rawContent.includes('���'),
        sampleContent: rawContent.substring(0, 500)
      });
    }
    
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
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
        id: `demo-${datasetKey}-data`,
        filename: dataset.displayName,
        size: fileSize
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Public demo fields extraction error:', error);
    return c.json({ 
      error: 'Failed to extract fields from demo data', 
      message: error instanceof Error ? error.message : 'Unable to analyze demo data'
    }, 500);
  }
});

// Legacy endpoint for backward compatibility
publicRoutes.get('/squirrel/fields', async (c) => {
  // Redirect to new endpoint structure
  return c.redirect('/api/v1/public/demo/squirrel/fields', 301);
});

// Public demo crosstab analysis - no authentication required
publicRoutes.post('/demo/:dataset/analyze/crosstab', async (c) => {
  const startTime = Date.now();
  let fileSize = 0;
  let analysisMetrics: any = {};
  
  try {
    const datasetKey = c.req.param('dataset');
    const dataset = DEMO_DATASETS[datasetKey];
    
    if (!dataset) {
      return c.json({ 
        error: 'Dataset not found',
        message: 'Requested demo dataset is not available',
        availableDatasets: Object.keys(DEMO_DATASETS)
      }, 404);
    }

    console.log(`Public ${dataset.displayName} crosstab analysis request from anonymous user`);
    const { rowVariable, columnVariable, includePercentages }: CrosstabRequest = await c.req.json();

    // Validate input - fail fast for anonymous users
    if (!rowVariable) {
      return c.json({ 
        error: 'rowVariable is required',
        message: 'Please select a row variable for the analysis'
      }, 400);
    }

    // Allow empty columnVariable for single-row counts
    if (columnVariable && rowVariable === columnVariable) {
      return c.json({ 
        error: 'Row and column variables must be different',
        message: 'Please select different variables for rows and columns'
      }, 400);
    }

    // Validate field names (allow most printable characters)
    const fieldNameRegex = /^[^\r\n"]{1,200}$/;
    if (!fieldNameRegex.test(rowVariable) || (columnVariable && !fieldNameRegex.test(columnVariable))) {
      return c.json({ 
        error: 'Invalid field names',
        message: 'Field names cannot contain newlines or quotes, and must be 1-200 characters'
      }, 400);
    }

    // Get data from R2 with performance monitoring
    const r2StartTime = Date.now();
    const object = await c.env.FILE_STORAGE.get(dataset.filename);
    const r2Time = Date.now() - r2StartTime;
    
    if (!object) {
      return c.json({ 
        error: 'Demo data not found',
        message: `${dataset.displayName} data is temporarily unavailable`
      }, 404);
    }

    // Read content efficiently and normalize Unicode characters immediately  
    const readStartTime = Date.now();
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
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
      demo_mode: true,
      dataset: datasetKey
    };
    
    console.log(`Public ${dataset.displayName} crosstab analysis performance: R2:${r2Time}ms, Read:${readTime}ms, Analysis:${analysisTime}ms, Total:${totalTime}ms, Throughput:${processingMetrics.throughputMBps.toFixed(2)}MB/s, Matrix:${analysisMetrics.matrix_size}`);

    const response: CrosstabResponse = {
      success: true,
      data: crosstabData,
      metadata: {
        processedRows: crosstabData.grandTotal,
        uniqueRowValues: Object.keys(crosstabData.rowTotals).length,
        uniqueColumnValues: Object.keys(crosstabData.columnTotals).length,
        performance: analysisMetrics,
        demoMode: true,
        dataSource: dataset.description,
        dataset: datasetKey
      }
    };

    return c.json(response);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Public demo crosstab analysis failed after ${totalTime}ms:`, error);
    
    // Handle specific error types with user-friendly messages for demo users
    if (error instanceof Error) {
      if (error.message.includes('not found in CSV headers')) {
        const datasetKey = c.req.param('dataset');
        const dataset = DEMO_DATASETS[datasetKey];
        return c.json({ 
          error: 'Field not found in demo data',
          message: `The field "${error.message.includes('rowVariable') ? 'row variable' : 'column variable'}" was not found in the ${dataset?.displayName || 'demo'} data. Please select from the available fields.`
        }, 400);
      }
    }
    
    return c.json({ 
      error: 'Failed to generate demo analysis', 
      message: error instanceof Error ? error.message : 'Unable to analyze demo data',
      performance: {
        ...analysisMetrics,
        total_time_ms: totalTime,
        error_occurred: true,
        demo_mode: true
      }
    }, 500);
  }
});

// Legacy endpoint for backward compatibility
publicRoutes.post('/squirrel/analyze/crosstab', async (c) => {
  // Forward request to new endpoint structure
  const body = await c.req.json();
  const baseUrl = new URL(c.req.url).origin;
  const newUrl = `${baseUrl}/api/v1/public/demo/squirrel/analyze/crosstab`;
  
  const response = await fetch(newUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  return new Response(response.body, { 
    status: response.status, 
    headers: response.headers 
  });
});

// List available demo datasets
publicRoutes.get('/demo/datasets', async (c) => {
  const datasets = Object.entries(DEMO_DATASETS).map(([key, dataset]) => ({
    id: key,
    name: dataset.displayName,
    description: dataset.description,
    filename: dataset.downloadName
  }));

  return c.json({
    success: true,
    datasets,
    message: 'Available demo datasets for analysis. No login required.'
  });
});

// Demo dataset information endpoint
publicRoutes.get('/demo/:dataset/info', async (c) => {
  const datasetKey = c.req.param('dataset');
  const dataset = DEMO_DATASETS[datasetKey];
  
  if (!dataset) {
    return c.json({ 
      error: 'Dataset not found',
      message: 'Requested demo dataset is not available',
      availableDatasets: Object.keys(DEMO_DATASETS)
    }, 404);
  }

  // Dataset-specific information
  const datasetInfo = {
    squirrel: {
      name: 'NYC Squirrel Census',
      description: 'The Squirrel Census is a multimedia science, design, and storytelling project focusing on the Eastern gray squirrel, found throughout Central Park.',
      source: 'NYC Parks & Recreation and Squirrel Census volunteers',
      fields: 'Location coordinates, squirrel behaviors, physical characteristics, and interaction data',
      recordCount: 'Approximately 3,000+ squirrel sightings',
      usage: 'Perfect for learning crosstab analysis - try comparing Age vs Primary Fur Color, or Location vs Activities!',
      suggestedAnalyses: [
        { row: 'Age', column: 'Primary Fur Color', description: 'Compare age distribution across fur colors' },
        { row: 'Location', column: 'Activities', description: 'See what activities happen in different locations' },
        { row: 'Date', column: 'Approaches', description: 'Track seasonal behavior patterns' }
      ]
    },
    npors2025: {
      name: '2025 National Public Opinion Reference Survey',
      description: 'National Public Opinion Reference Survey providing insights into American public opinion across various political and social topics.',
      source: 'National public opinion polling organization',
      fields: 'Demographics, political preferences, policy opinions, social attitudes, and voting behavior data',
      recordCount: 'Representative sample of U.S. adult population',
      usage: 'Perfect for analyzing public opinion patterns across demographics and political preferences!',
      suggestedAnalyses: [
        { row: 'Political_Party', column: 'Age_Group', description: 'Compare political affiliation across age groups' },
        { row: 'Education_Level', column: 'Policy_Opinion', description: 'See how education correlates with policy views' },
        { row: 'Region', column: 'Voting_Intention', description: 'Track voting patterns by geographic region' }
      ]
    }
  };

  const info = datasetInfo[datasetKey] || {
    name: dataset.displayName,
    description: dataset.description,
    source: 'Demo dataset',
    fields: 'Various data fields for analysis',
    recordCount: 'Sample data records',
    usage: 'Perfect for learning crosstab analysis!',
    suggestedAnalyses: []
  };

  return c.json({
    success: true,
    demo: info,
    message: 'Try our analysis features with real data! No login required.',
    dataset: datasetKey
  });
});

// Legacy endpoint for backward compatibility
publicRoutes.get('/squirrel/info', async (c) => {
  // Redirect to new endpoint structure
  return c.redirect('/api/v1/public/demo/squirrel/info', 301);
});

// Additional endpoints for QueryBuilder (CUT) compatibility
// Map "columns" to "fields" for API consistency
publicRoutes.get('/demo/:dataset/columns', async (c) => {
  try {
    const datasetKey = c.req.param('dataset');
    const dataset = DEMO_DATASETS[datasetKey];
    
    if (!dataset) {
      return c.json({ 
        error: 'Dataset not found',
        availableDatasets: Object.keys(DEMO_DATASETS)
      }, 404);
    }

    // Get data from R2 (reuse the same logic as fields endpoint)
    const object = await c.env.FILE_STORAGE.get(dataset.filename);
    
    if (!object) {
      return c.json({ 
        error: 'Demo data not found',
        message: `${dataset.displayName} data is temporarily unavailable`
      }, 404);
    }

    // Read content and normalize Unicode characters immediately  
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
    const fileSize = content.length;

    // Validate processing limits for security
    CrosstabProcessor.validateProcessingLimits(content, 'public column extraction');

    // Use DataTypeDetector to analyze column types and metadata
    const analysis = await DataTypeDetector.analyzeColumnTypes(content);

    // Generate filter suggestions based on detected types
    const filterSuggestions = DataTypeDetector.getFilterSuggestions(analysis.columns);

    // Transform response for QueryBuilder compatibility
    const response = {
      success: true,
      columns: analysis.columns, // QueryBuilder expects enriched column metadata
      rowCount: analysis.fileInfo.totalRows,
      filterSuggestions,
      fileInfo: {
        id: `demo-${datasetKey}`,
        filename: dataset.displayName,
        size: fileSize,
        totalColumns: analysis.fileInfo.totalColumns,
        totalRows: analysis.fileInfo.totalRows
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Demo columns extraction error:', error);
    return c.json({ 
      error: 'Failed to extract columns from demo data', 
      message: error instanceof Error ? error.message : 'Unable to analyze demo data'
    }, 500);
  }
});

// Performance strategy endpoint for QueryBuilder
publicRoutes.get('/demo/:dataset/performance', async (c) => {
  const datasetKey = c.req.param('dataset');
  const dataset = DEMO_DATASETS[datasetKey];
  
  if (!dataset) {
    return c.json({ 
      error: 'Dataset not found',
      availableDatasets: Object.keys(DEMO_DATASETS)
    }, 404);
  }

  // Return appropriate performance strategy based on demo data size
  return c.json({
    strategy: 'realtime',
    estimatedRows: 3000,
    fileSizeMB: 0.5,
    updateInterval: 100,
    description: `Demo mode performance strategy for ${dataset.displayName}`
  });
});

// Query endpoint for QueryBuilder filtering
publicRoutes.post('/demo/:dataset/query', async (c) => {
  try {
    const datasetKey = c.req.param('dataset');
    const dataset = DEMO_DATASETS[datasetKey];
    
    if (!dataset) {
      return c.json({ 
        error: 'Dataset not found',
        availableDatasets: Object.keys(DEMO_DATASETS)
      }, 404);
    }

    const { filters = [], includePreview = true, previewLimit = 100 } = await c.req.json();
    
    console.log(`🐱 Demo query for ${dataset.displayName} with ${filters.length} filters`);

    // Get the CSV data from R2
    const object = await c.env.FILE_STORAGE.get(dataset.filename);
    
    if (!object) {
      return c.json({ 
        error: 'Demo data not found',
        message: `${dataset.displayName} data is temporarily unavailable`
      }, 404);
    }

    // Process the CSV content
    const rawContent = await object.text();
    const content = CrosstabProcessor.normalizeUnicodeCharacters(rawContent);
    
    // Apply filters using FilterProcessor
    const filteredResult = await FilterProcessor.applyFilters(
      content,
      filters,
      includePreview,
      previewLimit
    );
    
    return c.json({
      success: true,
      data: filteredResult
    });
  } catch (error) {
    console.error('Demo query error:', error);
    return c.json({ 
      error: 'Query execution failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default publicRoutes;
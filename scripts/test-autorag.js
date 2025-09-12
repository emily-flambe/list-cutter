#!/usr/bin/env node

/**
 * Test AutoRAG Instance
 * 
 * This script tests the AutoRAG configuration by running sample queries
 * and validating the responses
 */

const testQueries = [
  "How do I upload a CSV file?",
  "What are the file size limits?",
  "How do I create a cross-tab analysis?",
  "Can I export to Excel?",
  "How do I generate synthetic data?",
  "What is the maximum number of rows I can process?",
  "How do I filter data?",
  "What file formats are supported?",
  "How do I track file lineage?",
  "How do I use the SQL preview feature?"
];

/**
 * Test AutoRAG via Workers AI binding
 * This function is designed to run as a Worker
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Check if this is a test request
    if (url.pathname !== '/test-autorag') {
      return new Response('Not found', { status: 404 });
    }
    
    // Ensure AutoRAG instance name is configured
    if (!env.AUTORAG_INSTANCE_NAME) {
      return new Response(JSON.stringify({
        error: 'AUTORAG_INSTANCE_NAME not configured in environment'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const results = [];
    const startTime = Date.now();
    
    for (const query of testQueries) {
      try {
        const queryStart = Date.now();
        
        // Call AutoRAG with the query
        const response = await env.AI
          .autorag(env.AUTORAG_INSTANCE_NAME)
          .query({
            query,
            rewriteQuery: true,
            maxResults: 3,
            includeMetadata: true
          });
        
        const queryTime = Date.now() - queryStart;
        
        results.push({
          query,
          success: true,
          answer: response.answer || 'No answer generated',
          sources: response.sources ? response.sources.length : 0,
          confidence: response.confidence || 0,
          responseTime: queryTime,
          metadata: {
            modelUsed: response.metadata?.model,
            tokensUsed: response.metadata?.tokens,
            cached: response.metadata?.cached || false
          }
        });
        
      } catch (error) {
        results.push({
          query,
          success: false,
          error: error.message,
          responseTime: 0
        });
      }
    }
    
    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const avgResponseTime = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.responseTime, 0) / successCount || 0;
    
    const summary = {
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'unknown',
      autoragInstance: env.AUTORAG_INSTANCE_NAME,
      totalQueries: testQueries.length,
      successfulQueries: successCount,
      failedQueries: testQueries.length - successCount,
      totalTime,
      averageResponseTime: Math.round(avgResponseTime),
      results
    };
    
    // Log summary to console for debugging
    console.log('AutoRAG Test Summary:', {
      successful: successCount,
      failed: testQueries.length - successCount,
      avgTime: `${Math.round(avgResponseTime)}ms`
    });
    
    return new Response(JSON.stringify(summary, null, 2), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Test-Duration': String(totalTime),
        'X-Success-Rate': `${(successCount / testQueries.length * 100).toFixed(1)}%`
      }
    });
  }
};

/**
 * Command-line test runner (for local testing)
 */
if (typeof module !== 'undefined' && require.main === module) {
  console.log('AutoRAG Test Script');
  console.log('===================\n');
  console.log('This script is designed to run as a Cloudflare Worker.');
  console.log('To test AutoRAG locally:\n');
  console.log('1. Deploy this script as a Worker');
  console.log('2. Configure AUTORAG_INSTANCE_NAME in wrangler.toml');
  console.log('3. Run: curl https://your-worker.workers.dev/test-autorag\n');
  console.log('Or use it directly in your Worker with:');
  console.log('  import testAutoRAG from "./test-autorag.js";\n');
}
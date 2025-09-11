#!/usr/bin/env node

/**
 * Direct test of AutoRAG instance through Cloudflare Worker
 * This tests if the AutoRAG instance is properly configured and indexed
 */

async function testAutoRAG() {
  const queries = [
    "What is Cutty?",
    "How do I upload a CSV file?",
    "CSV upload",
    "getting started",
    "features"
  ];

  console.log('Testing AutoRAG instance "cutty-rag" through the Worker API...\n');

  for (const query of queries) {
    console.log(`Query: "${query}"`);
    
    try {
      const response = await fetch('https://cutty-dev.emilycogsdill.com/api/v1/assistant/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        console.log(`  ❌ HTTP Error: ${response.status} ${response.statusText}`);
        const error = await response.text();
        console.log(`  Error: ${error}`);
        continue;
      }

      const data = await response.json();
      
      console.log(`  ✅ Response received`);
      console.log(`  Answer: ${data.answer?.substring(0, 100)}...`);
      console.log(`  Sources found: ${data.sources?.length || 0}`);
      
      if (data.sources && data.sources.length > 0) {
        console.log('  Source files:');
        data.sources.forEach(source => {
          console.log(`    - ${source.filename || source.title || 'Unknown'}`);
        });
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('\nDiagnostic Information:');
  console.log('- AutoRAG Instance Name: cutty-rag');
  console.log('- Expected Data Source: R2 bucket "cutty-docs"');
  console.log('- Documents uploaded: 35 markdown files');
  console.log('');
  console.log('If all queries return "I couldn\'t find a specific answer", then:');
  console.log('1. The AutoRAG instance may not be properly indexed');
  console.log('2. The data source configuration might be incorrect');
  console.log('3. The instance name might not match');
  console.log('');
  console.log('Check the Cloudflare Dashboard at:');
  console.log('https://dash.cloudflare.com/facf6619808dc039df729531bbb26d1d/ai/autorag/rag/cutty-rag/overview');
}

testAutoRAG().catch(console.error);
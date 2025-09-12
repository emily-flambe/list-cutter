#!/usr/bin/env node

/**
 * Test different AutoRAG methods to debug why it's not returning results
 */

async function testAutoRAGMethods() {
  const baseUrl = 'https://cutty-dev.emilycogsdill.com/api/v1/assistant';
  
  console.log('Testing AutoRAG through different approaches...\n');
  
  // Test 1: Simple query
  console.log('Test 1: Simple query');
  try {
    const response = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: "cutty" })
    });
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Try different query formats
  const testQueries = [
    "what is cutty",
    "csv",
    "upload",
    "file",
    "getting started",
    "how to use cutty",
    "features",
    "data processing"
  ];
  
  console.log('Test 2: Different query formats');
  for (const query of testQueries) {
    try {
      const response = await fetch(`${baseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await response.json();
      console.log(`Query: "${query}"`);
      console.log(`  Answer starts with: ${data.answer?.substring(0, 50)}...`);
      console.log(`  Sources: ${data.sources?.length || 0}`);
      if (data.sources?.length > 0) {
        console.log('  FOUND SOURCES!');
        data.sources.forEach(s => console.log(`    - ${s.filename || s.title || s.id}`));
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  console.log('\n---\n');
  console.log('Debugging info:');
  console.log('- AutoRAG instance: cutty-rag');
  console.log('- Status in dashboard: Ready');
  console.log('- Files found: 36');
  console.log('- Index results: 36 successful');
  console.log('- R2 bucket: cutty-docs');
  console.log('');
  console.log('If no sources are returned despite successful indexing:');
  console.log('1. The model configuration might be wrong');
  console.log('2. The score threshold might be too high (currently 0.3)');
  console.log('3. The query rewriting might be failing');
  console.log('4. The AutoRAG binding might not be configured correctly');
}

testAutoRAGMethods().catch(console.error);
#!/usr/bin/env node

/**
 * Test script for CuttyAgent
 * Usage: node test-agent.js
 */

const BASE_URL = 'http://localhost:8788';

async function testAgent() {
  console.log('🧪 Testing CuttyAgent...\n');

  // Test 1: Basic chat
  console.log('Test 1: Basic chat message');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello Cutty! Can you tell me what you can help with?',
        sessionId: 'test-session-1',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value);
      process.stdout.write(decoder.decode(value));
    }

    console.log('\n✅ Test 1 passed!\n');
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  // Test 2: Get supported states
  console.log('\nTest 2: Get supported states');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Which states can you generate data for?',
        sessionId: 'test-session-2',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value);
      process.stdout.write(decoder.decode(value));
    }

    console.log('\n✅ Test 2 passed!\n');
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  // Test 3: Generate synthetic data
  console.log('\nTest 3: Generate synthetic data');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Generate 5 synthetic voter records for California',
        sessionId: 'test-session-3',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value);
      process.stdout.write(decoder.decode(value));
    }

    console.log('\n✅ Test 3 passed!\n');
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }

  // Test 4: Health check
  console.log('\nTest 4: Agent health check');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/agent/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('Health check response:', data);
    console.log('✅ Test 4 passed!\n');
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
  }
}

// Run the tests
console.log('🚀 Starting CuttyAgent tests...');
console.log(`   Using base URL: ${BASE_URL}`);
console.log('   Make sure the worker is running with: npm run dev\n');

testAgent().catch(console.error);
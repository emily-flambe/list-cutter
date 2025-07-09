import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🌐 Starting global E2E test setup...');
  
  // Start the development server if not already running
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:8787';
  
  // Wait for server to be available
  console.log(`⏳ Waiting for server at ${baseURL}...`);
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Verify server is responding
    await page.goto(`${baseURL}/health`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    const response = await page.locator('text="healthy"').first();
    await response.waitFor({ timeout: 10000 });
    
    console.log('✅ Server is ready for E2E testing');
    
    // Create test data if needed
    await createTestUsers(page, baseURL);
    await createTestFiles(page, baseURL);
    
  } catch (error) {
    console.error('❌ Failed to verify server readiness:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('🎯 Global E2E test setup completed');
}

async function createTestUsers(page: any, baseURL: string) {
  console.log('👤 Creating test users...');
  
  // Create a standard test user
  try {
    await page.goto(`${baseURL}/api/accounts/register`, {
      waitUntil: 'networkidle'
    });
    
    const response = await page.evaluate(async (url) => {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'e2etestuser',
          email: 'e2etest@example.com',
          password: 'testpass123',
          password2: 'testpass123'
        })
      });
    }, `${baseURL}/api/accounts/register`);
    
    console.log('✅ Test users created');
  } catch (error) {
    console.log('ℹ️ Test users may already exist or creation failed:', error.message);
  }
}

async function createTestFiles(page: any, baseURL: string) {
  console.log('📁 Creating test files...');
  
  try {
    // Login first to get auth token
    const loginResponse = await page.evaluate(async (url) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'e2etestuser',
          password: 'testpass123'
        })
      });
      return response.json();
    }, `${baseURL}/api/accounts/login`);
    
    if (loginResponse.access_token) {
      // Upload a test CSV file
      const csvContent = 'name,age,city\nJohn,25,NYC\nJane,30,LA\nBob,35,Chicago';
      
      await page.evaluate(async ({ url, token, content }) => {
        const formData = new FormData();
        const blob = new Blob([content], { type: 'text/csv' });
        formData.append('file', blob, 'e2e-test.csv');
        
        return fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      }, {
        url: `${baseURL}/api/list_cutter/upload`,
        token: loginResponse.access_token,
        content: csvContent
      });
      
      console.log('✅ Test files created');
    }
  } catch (error) {
    console.log('ℹ️ Test file creation failed:', error.message);
  }
}

export default globalSetup;
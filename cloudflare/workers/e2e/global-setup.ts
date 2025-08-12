import { chromium, FullConfig } from '@playwright/test';

/**
 * Pinkie Pie's Global Test Setup 🎉
 * Setting up the party before all the tests begin!
 */

async function globalSetup(config: FullConfig) {
  console.log('🎉 Pinkie Pie: Setting up the E2E testing party!');
  
  // Launch browser for setup tasks
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for services to be ready
    console.log('🔧 Checking if backend service is ready...');
    const backendUrl = process.env.BASE_URL || process.env.BACKEND_URL || 'http://localhost:8788';
    
    // Retry logic for service readiness
    let retries = 0;
    const maxRetries = 30; // 30 attempts with 2 second intervals = 1 minute
    
    while (retries < maxRetries) {
      try {
        const response = await page.goto(`${backendUrl}/health`, { 
          waitUntil: 'networkidle',
          timeout: 5000 
        });
        
        if (response && response.ok()) {
          console.log('✅ Backend service is ready!');
          break;
        }
      } catch (error) {
        retries++;
        console.log(`⏳ Backend not ready yet (attempt ${retries}/${maxRetries}), waiting...`);
        await page.waitForTimeout(2000);
      }
    }
    
    if (retries >= maxRetries) {
      throw new Error('Backend service failed to start within timeout period');
    }
    
    // Check frontend service
    console.log('🔧 Checking if frontend service is ready...');
    const frontendUrl = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    
    retries = 0;
    while (retries < maxRetries) {
      try {
        const response = await page.goto(frontendUrl, { 
          waitUntil: 'networkidle',
          timeout: 5000 
        });
        
        if (response && response.ok()) {
          console.log('✅ Frontend service is ready!');
          break;
        }
      } catch (error) {
        retries++;
        console.log(`⏳ Frontend not ready yet (attempt ${retries}/${maxRetries}), waiting...`);
        await page.waitForTimeout(2000);
      }
    }
    
    if (retries >= maxRetries) {
      throw new Error('Frontend service failed to start within timeout period');
    }
    
    // Clean up any existing test data
    console.log('🧹 Cleaning up any existing test data...');
    // TODO: Add cleanup logic if needed
    
    console.log('🎊 Global setup complete! Ready to party with E2E tests!');
    
  } finally {
    await browser.close();
  }
}

export default globalSetup;
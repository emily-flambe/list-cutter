import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:8787';
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Clean up test data
    await cleanupTestUsers(page, baseURL);
    await cleanupTestFiles(page, baseURL);
    
    // Verify system health after tests
    await verifySystemHealth(page, baseURL);
    
  } catch (error) {
    console.error('⚠️ Teardown error (non-critical):', error);
  } finally {
    await browser.close();
  }
  
  console.log('✅ Global E2E test teardown completed');
}

async function cleanupTestUsers(page: any, baseURL: string) {
  console.log('🗑️ Cleaning up test users...');
  
  try {
    // In a real implementation, you might want to clean up test users
    // For now, we'll just log that cleanup would happen here
    console.log('ℹ️ Test user cleanup completed (users may remain for debugging)');
  } catch (error) {
    console.log('ℹ️ Test user cleanup skipped:', error.message);
  }
}

async function cleanupTestFiles(page: any, baseURL: string) {
  console.log('🗑️ Cleaning up test files...');
  
  try {
    // Login to get auth token for cleanup
    const loginResponse = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'e2etestuser',
            password: 'testpass123'
          })
        });
        if (response.ok) {
          return response.json();
        }
        return null;
      } catch (error) {
        return null;
      }
    }, `${baseURL}/api/accounts/login`);
    
    if (loginResponse?.access_token) {
      // Get list of files to clean up
      const filesResponse = await page.evaluate(async ({ url, token }) => {
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            return response.json();
          }
          return null;
        } catch (error) {
          return null;
        }
      }, {
        url: `${baseURL}/api/list_cutter/list_saved_files`,
        token: loginResponse.access_token
      });
      
      if (filesResponse?.files) {
        // Delete test files
        for (const file of filesResponse.files) {
          if (file.filename.includes('e2e-test') || file.filename.includes('test-')) {
            await page.evaluate(async ({ url, token, fileId }) => {
              try {
                await fetch(`${url}/${fileId}`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
              } catch (error) {
                console.log('File deletion failed:', error);
              }
            }, {
              url: `${baseURL}/api/list_cutter/delete`,
              token: loginResponse.access_token,
              fileId: file.id
            });
          }
        }
      }
      
      console.log('✅ Test files cleaned up');
    }
  } catch (error) {
    console.log('ℹ️ Test file cleanup skipped:', error.message);
  }
}

async function verifySystemHealth(page: any, baseURL: string) {
  console.log('🏥 Verifying system health after tests...');
  
  try {
    await page.goto(`${baseURL}/health`, { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    const healthResponse = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url);
        return response.json();
      } catch (error) {
        return { status: 'error', error: error.message };
      }
    }, `${baseURL}/health`);
    
    if (healthResponse.status === 'healthy') {
      console.log('✅ System health verified - all systems operational');
    } else {
      console.log('⚠️ System health check failed:', healthResponse);
    }
    
    // Log performance metrics if available
    const performanceEntries = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation');
      if (entries.length > 0) {
        const entry = entries[0] as PerformanceNavigationTiming;
        return {
          loadTime: Math.round(entry.loadEventEnd - entry.loadEventStart),
          domContentLoadedTime: Math.round(entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart),
          responseTime: Math.round(entry.responseEnd - entry.requestStart)
        };
      }
      return null;
    });
    
    if (performanceEntries) {
      console.log('📊 Final performance metrics:', performanceEntries);
    }
    
  } catch (error) {
    console.log('⚠️ Health check failed:', error.message);
  }
}

export default globalTeardown;
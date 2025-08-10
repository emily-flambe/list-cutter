# Debugging Guide: Using Puppeteer for Testing Cutty

This guide explains how to use Puppeteer to test user interactions, authentication flows, and data operations in the Cutty list management application.

## Overview

Puppeteer is essential for testing Cutty's complex user flows including authentication, file operations, list management, and data persistence. Since Cutty runs on Cloudflare Workers with edge computing, automated testing helps ensure functionality across different deployment environments.

## Setup Requirements

- Node.js installed
- Puppeteer package installed (`npm install puppeteer`)
- Development environment running (`make build-deploy-dev`)
- `.dev.vars` file configured with JWT_SECRET and API_KEY_SALT
- Access to `cutty-dev.emilycogsdill.com` for testing

## Core Testing Patterns

### 1. Basic Browser Configuration

```javascript
const puppeteer = require('puppeteer');

async function createCuttyBrowser() {
    const browser = await puppeteer.launch({ 
        headless: false,           // Show browser for debugging
        defaultViewport: { width: 1200, height: 900 },
        slowMo: 100,              // Delay for edge computing latency
        args: [
            '--disable-web-security',  // For local dev testing
            '--disable-features=VizDisplayCompositor'
        ]
    });
    
    return browser;
}
```

### 2. Environment Configuration

```javascript
const ENVIRONMENTS = {
    dev: 'https://cutty-dev.emilycogsdill.com',
    prod: 'https://cutty.emilycogsdill.com'
};

async function setupTestEnvironment(env = 'dev') {
    const browser = await createCuttyBrowser();
    const page = await browser.newPage();
    
    // Enable request/response logging
    page.on('request', req => console.log('→', req.method(), req.url()));
    page.on('response', res => console.log('←', res.status(), res.url()));
    
    await page.goto(ENVIRONMENTS[env]);
    return { browser, page };
}
```

## Authentication Testing

### Google OAuth Flow Testing

```javascript
async function testGoogleOAuthFlow() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        // Navigate to login
        await page.goto('https://cutty-dev.emilycogsdill.com/auth/login');
        
        // Click Google OAuth button
        await page.waitForSelector('.google-oauth-button');
        await page.click('.google-oauth-button');
        
        // Wait for Google OAuth redirect
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        
        // Handle Google OAuth popup or redirect
        if (page.url().includes('accounts.google.com')) {
            console.log('Google OAuth redirect detected');
            
            // Fill in test credentials (use test account)
            await page.waitForSelector('#identifierId');
            await page.type('#identifierId', 'test@example.com');
            await page.click('#identifierNext');
            
            await page.waitForSelector('[type="password"]');
            await page.type('[type="password"]', 'testpassword');
            await page.click('#passwordNext');
        }
        
        // Wait for redirect back to Cutty
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        
        // Verify successful authentication
        const isAuthenticated = await page.evaluate(() => {
            return localStorage.getItem('cutty_auth_token') !== null;
        });
        
        console.log('Authentication successful:', isAuthenticated);
        
        // Take screenshot of authenticated state
        await page.screenshot({ 
            path: 'debug-auth-success.png', 
            fullPage: true 
        });
        
    } catch (error) {
        console.error('OAuth test failed:', error);
        await page.screenshot({ path: 'debug-auth-error.png', fullPage: true });
    } finally {
        await browser.close();
    }
}
```

### JWT Token Management Testing

```javascript
async function testJWTTokenFlow() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        // Test token expiration and refresh
        await page.evaluateOnNewDocument(() => {
            // Mock an expired token
            localStorage.setItem('cutty_auth_token', 'expired.jwt.token');
        });
        
        await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
        
        // Should redirect to login due to expired token
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        
        const currentUrl = page.url();
        const redirectedToLogin = currentUrl.includes('/auth/login');
        
        console.log('Expired token handling:', {
            redirectedToLogin,
            currentUrl
        });
        
        // Test API key authentication
        await page.goto('https://cutty-dev.emilycogsdill.com/api/v1/files/list');
        
        // Should require authentication
        const apiResponse = await page.evaluate(() => {
            return fetch('/api/v1/files/list').then(r => r.status);
        });
        
        console.log('API without auth status:', apiResponse);
        
    } catch (error) {
        console.error('JWT test failed:', error);
    } finally {
        await browser.close();
    }
}
```

## File Operations Testing

### CSV Upload and Processing

```javascript
async function testCSVUploadFlow() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        // Navigate to upload section
        await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
        
        // Wait for file upload component
        await page.waitForSelector('.file-upload-zone');
        
        // Create test CSV file
        const testCSV = `name,age,city
John,25,New York
Jane,30,San Francisco
Bob,35,Chicago`;
        
        // Simulate file upload
        const fileInput = await page.$('input[type="file"]');
        
        if (fileInput) {
            // Create temporary file
            const fs = require('fs');
            const path = require('path');
            const tempFile = path.join(__dirname, 'test-data.csv');
            
            fs.writeFileSync(tempFile, testCSV);
            
            await fileInput.uploadFile(tempFile);
            
            // Wait for upload processing
            await page.waitForSelector('.upload-success', { timeout: 10000 });
            
            // Verify CSV parsing
            const parsedData = await page.evaluate(() => {
                return window.cuttyData ? window.cuttyData.rows.length : 0;
            });
            
            console.log('CSV rows parsed:', parsedData);
            
            // Test column detection
            const columns = await page.evaluate(() => {
                const headers = document.querySelectorAll('.column-header');
                return Array.from(headers).map(h => h.textContent);
            });
            
            console.log('Detected columns:', columns);
            
            // Clean up
            fs.unlinkSync(tempFile);
            
        } else {
            console.log('File input not found');
        }
        
        await page.screenshot({ path: 'debug-csv-upload.png', fullPage: true });
        
    } catch (error) {
        console.error('CSV upload test failed:', error);
        await page.screenshot({ path: 'debug-csv-error.png', fullPage: true });
    } finally {
        await browser.close();
    }
}
```

### Data Export Testing

```javascript
async function testDataExportFlow() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        // Load sample data first
        await testCSVUploadFlow(); // Helper to get data loaded
        
        // Test different export formats
        const exportFormats = ['.csv', '.json', '.xlsx'];
        
        for (const format of exportFormats) {
            // Click export button
            await page.waitForSelector('.export-button');
            await page.click('.export-button');
            
            // Select format
            await page.waitForSelector(`[data-format="${format}"]`);
            await page.click(`[data-format="${format}"]`);
            
            // Wait for download to start
            const downloadPromise = new Promise((resolve) => {
                page.on('response', async (response) => {
                    if (response.headers()['content-disposition']) {
                        console.log(`${format} download started:`, response.url());
                        resolve(response);
                    }
                });
            });
            
            await page.click('.confirm-export');
            await downloadPromise;
            
            console.log(`Successfully tested ${format} export`);
        }
        
    } catch (error) {
        console.error('Export test failed:', error);
    } finally {
        await browser.close();
    }
}
```

## List Management Testing

### CUT Feature Testing (List Cutting/Filtering)

```javascript
async function testCUTFeatureFlow() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        // Navigate to CUT feature
        await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
        
        // Upload test data
        await uploadTestData(page);
        
        // Test column selection
        await page.waitForSelector('.column-selector');
        const columns = await page.$$('.column-option');
        
        // Select first column for filtering
        if (columns.length > 0) {
            await columns[0].click();
            console.log('Selected column for filtering');
        }
        
        // Test filter operations
        const filterOperations = [
            { type: 'contains', value: 'test' },
            { type: 'equals', value: 'exact' },
            { type: 'greater_than', value: '10' }
        ];
        
        for (const operation of filterOperations) {
            await page.waitForSelector('.filter-type-selector');
            await page.select('.filter-type-selector', operation.type);
            
            await page.waitForSelector('.filter-value-input');
            await page.fill('.filter-value-input', operation.value);
            
            await page.click('.apply-filter-btn');
            
            // Wait for results
            await page.waitForSelector('.filtered-results');
            
            const resultCount = await page.evaluate(() => {
                return document.querySelectorAll('.data-row').length;
            });
            
            console.log(`Filter ${operation.type} with "${operation.value}":`, resultCount, 'results');
            
            // Take screenshot of results
            await page.screenshot({ 
                path: `debug-filter-${operation.type}.png`, 
                fullPage: true 
            });
        }
        
        // Test bulk operations
        await testBulkOperations(page);
        
    } catch (error) {
        console.error('CUT feature test failed:', error);
    } finally {
        await browser.close();
    }
}

async function testBulkOperations(page) {
    // Select multiple rows
    const checkboxes = await page.$$('.row-checkbox');
    
    if (checkboxes.length >= 3) {
        await checkboxes[0].click();
        await checkboxes[1].click();
        await checkboxes[2].click();
        
        console.log('Selected 3 rows for bulk operation');
        
        // Test bulk delete
        await page.click('.bulk-delete-btn');
        await page.click('.confirm-delete');
        
        // Verify deletion
        const remainingRows = await page.evaluate(() => {
            return document.querySelectorAll('.data-row').length;
        });
        
        console.log('Rows remaining after bulk delete:', remainingRows);
    }
}
```

## Performance and Load Testing

### Edge Computing Response Times

```javascript
async function testEdgePerformance() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        const performanceResults = [];
        
        // Test multiple API endpoints
        const endpoints = [
            '/api/v1/files/list',
            '/api/v1/auth/verify',
            '/api/v1/export/csv',
            '/do-stuff/cut'
        ];
        
        for (const endpoint of endpoints) {
            const startTime = Date.now();
            
            await page.goto(`https://cutty-dev.emilycogsdill.com${endpoint}`);
            await page.waitForLoadState('networkidle');
            
            const loadTime = Date.now() - startTime;
            
            performanceResults.push({
                endpoint,
                loadTime,
                timestamp: new Date().toISOString()
            });
            
            console.log(`${endpoint}: ${loadTime}ms`);
        }
        
        // Test concurrent requests
        const concurrentTests = Array(5).fill().map(async (_, i) => {
            const testPage = await browser.newPage();
            const start = Date.now();
            
            await testPage.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
            await testPage.waitForLoadState('networkidle');
            
            const duration = Date.now() - start;
            await testPage.close();
            
            return { test: i + 1, duration };
        });
        
        const concurrentResults = await Promise.all(concurrentTests);
        console.log('Concurrent load test results:', concurrentResults);
        
        // Save performance data
        const fs = require('fs');
        fs.writeFileSync('performance-results.json', JSON.stringify({
            sequential: performanceResults,
            concurrent: concurrentResults
        }, null, 2));
        
    } catch (error) {
        console.error('Performance test failed:', error);
    } finally {
        await browser.close();
    }
}
```

## Data Persistence Testing

### Database Operations Validation

```javascript
async function testDataPersistence() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        // Upload data and perform operations
        await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
        await uploadTestData(page);
        
        // Make some changes
        await page.click('.edit-row-btn');
        await page.fill('.edit-input', 'Modified Value');
        await page.click('.save-changes');
        
        // Wait for save confirmation
        await page.waitForSelector('.save-success');
        
        // Refresh page to test persistence
        await page.reload();
        await page.waitForSelector('.data-table');
        
        // Check if changes persisted
        const modifiedValue = await page.textContent('.modified-cell');
        const isPersisted = modifiedValue === 'Modified Value';
        
        console.log('Data persistence test:', isPersisted ? 'PASSED' : 'FAILED');
        
        // Test across sessions
        await testCrossSessionPersistence(browser);
        
    } catch (error) {
        console.error('Persistence test failed:', error);
    } finally {
        await browser.close();
    }
}

async function testCrossSessionPersistence(browser) {
    // Open new incognito context
    const context = await browser.createIncognitoBrowserContext();
    const newPage = await context.newPage();
    
    // Login and check if data is still there
    await newPage.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
    
    // Data should persist across sessions for authenticated users
    const hasData = await newPage.evaluate(() => {
        return document.querySelectorAll('.data-row').length > 0;
    });
    
    console.log('Cross-session persistence:', hasData ? 'PASSED' : 'FAILED');
    
    await context.close();
}
```

## UI State Validation

### Responsive Design Testing

```javascript
async function testResponsiveDesign() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        const viewports = [
            { name: 'mobile', width: 375, height: 667 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'desktop', width: 1200, height: 800 },
            { name: 'large', width: 1920, height: 1080 }
        ];
        
        for (const viewport of viewports) {
            await page.setViewport(viewport);
            await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
            
            // Check if navigation is accessible
            const navVisible = await page.isVisible('.main-navigation');
            const menuToggle = await page.isVisible('.mobile-menu-toggle');
            
            console.log(`${viewport.name}:`, {
                navVisible,
                menuToggle,
                width: viewport.width
            });
            
            // Take screenshot for visual verification
            await page.screenshot({ 
                path: `debug-responsive-${viewport.name}.png`,
                fullPage: true 
            });
            
            // Test key functionality at each size
            if (viewport.width >= 768) {
                await testDesktopFeatures(page);
            } else {
                await testMobileFeatures(page);
            }
        }
        
    } catch (error) {
        console.error('Responsive test failed:', error);
    } finally {
        await browser.close();
    }
}

async function testDesktopFeatures(page) {
    // Test features available on desktop
    const desktopElements = [
        '.sidebar',
        '.toolbar',
        '.bulk-operations',
        '.advanced-filters'
    ];
    
    for (const selector of desktopElements) {
        const isVisible = await page.isVisible(selector);
        console.log(`Desktop element ${selector}:`, isVisible ? 'visible' : 'hidden');
    }
}

async function testMobileFeatures(page) {
    // Test mobile-specific features
    const mobileElements = [
        '.mobile-menu',
        '.swipe-actions',
        '.compact-view'
    ];
    
    for (const selector of mobileElements) {
        const isVisible = await page.isVisible(selector);
        console.log(`Mobile element ${selector}:`, isVisible ? 'visible' : 'hidden');
    }
}
```

## Error Handling Testing

### Network Failure Simulation

```javascript
async function testNetworkFailures() {
    const { browser, page } = await setupTestEnvironment('dev');
    
    try {
        // Simulate network failures
        await page.setOfflineMode(true);
        
        await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
        
        // Check for offline message
        const offlineMessage = await page.isVisible('.offline-notification');
        console.log('Offline notification shown:', offlineMessage);
        
        // Test offline functionality
        await page.setOfflineMode(false);
        await page.reload();
        
        // Simulate slow network
        await page.emulateNetworkConditions({
            offline: false,
            downloadThroughput: 50 * 1024, // 50kb/s
            uploadThroughput: 50 * 1024,
            latency: 2000 // 2s latency
        });
        
        const slowLoadStart = Date.now();
        await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
        await page.waitForSelector('.data-table');
        const slowLoadTime = Date.now() - slowLoadStart;
        
        console.log('Slow network load time:', slowLoadTime, 'ms');
        
        // Test timeout handling
        await testTimeoutHandling(page);
        
    } catch (error) {
        console.error('Network failure test failed:', error);
    } finally {
        await browser.close();
    }
}

async function testTimeoutHandling(page) {
    // Intercept requests and delay responses
    await page.route('**/api/**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10s delay
        route.continue();
    });
    
    // Try to make an API call
    const timeoutResult = await page.evaluate(() => {
        return fetch('/api/v1/files/list', { timeout: 5000 })
            .then(() => 'success')
            .catch(() => 'timeout');
    });
    
    console.log('Timeout handling result:', timeoutResult);
}
```

## Debugging Best Practices

### 1. Enhanced Logging

```javascript
// Enable comprehensive logging
async function setupDebugLogging(page) {
    page.on('console', msg => {
        console.log(`[${msg.type().toUpperCase()}]`, msg.text());
    });
    
    page.on('pageerror', error => {
        console.log('[PAGE ERROR]', error.message);
    });
    
    page.on('requestfailed', request => {
        console.log('[REQUEST FAILED]', request.url(), request.failure().errorText);
    });
    
    page.on('response', response => {
        if (response.status() >= 400) {
            console.log('[HTTP ERROR]', response.status(), response.url());
        }
    });
}
```

### 2. State Capture Utilities

```javascript
async function captureApplicationState(page) {
    const state = await page.evaluate(() => {
        return {
            url: window.location.href,
            localStorage: { ...localStorage },
            sessionStorage: { ...sessionStorage },
            cookies: document.cookie,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };
    });
    
    console.log('Application State:', JSON.stringify(state, null, 2));
    return state;
}
```

### 3. Visual Debugging

```javascript
async function visualDebugSession(page) {
    // Take screenshot with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ 
        path: `debug-${timestamp}.png`, 
        fullPage: true 
    });
    
    // Highlight active elements
    await page.addStyleTag({
        content: `
            .debug-active { 
                border: 3px solid red !important; 
                background: rgba(255,0,0,0.1) !important; 
            }
        `
    });
    
    // Add debug info overlay
    await page.evaluate(() => {
        const debugInfo = document.createElement('div');
        debugInfo.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: black;
            color: white;
            padding: 10px;
            z-index: 10000;
            font-family: monospace;
            font-size: 12px;
        `;
        debugInfo.innerHTML = `
            <div>URL: ${window.location.href}</div>
            <div>Time: ${new Date().toLocaleTimeString()}</div>
            <div>User Agent: ${navigator.userAgent.substring(0, 50)}...</div>
        `;
        document.body.appendChild(debugInfo);
    });
}
```

## Common Issues and Solutions

### Cloudflare Workers Specific Issues

#### Cold Start Delays
- Add warmup requests before main test
- Account for edge computing initialization time
- Use longer timeouts for first requests

```javascript
async function warmupWorker(page) {
    // Warm up the worker
    await page.goto('https://cutty-dev.emilycogsdill.com/api/v1/health');
    await page.waitForResponse(response => response.url().includes('health'));
    console.log('Worker warmed up');
}
```

#### Edge Cache Issues
- Clear cache between tests
- Use cache-busting parameters for consistent testing

```javascript
await page.goto(`https://cutty-dev.emilycogsdill.com/do-stuff/cut?t=${Date.now()}`);
```

### Authentication State Management
- Always verify token presence before protected operations
- Handle token expiration gracefully
- Test both OAuth and API key flows

```javascript
async function ensureAuthentication(page) {
    const hasToken = await page.evaluate(() => {
        return localStorage.getItem('cutty_auth_token') !== null;
    });
    
    if (!hasToken) {
        // Trigger authentication flow
        await page.goto('https://cutty-dev.emilycogsdill.com/auth/login');
        // Handle OAuth or provide API key
    }
}
```

## Running Tests

### Test Execution Scripts

Create test files in the project root:

```bash
# Run authentication tests
node puppeteer-tests/test-auth.js

# Run file operations tests  
node puppeteer-tests/test-file-ops.js

# Run performance tests
node puppeteer-tests/test-performance.js

# Run full test suite
node puppeteer-tests/run-all-tests.js
```

### Integration with CI/CD

```javascript
// test-runner.js
async function runTestSuite() {
    const tests = [
        testGoogleOAuthFlow,
        testCSVUploadFlow,
        testCUTFeatureFlow,
        testDataPersistence,
        testEdgePerformance
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            console.log(`Running ${test.name}...`);
            await test();
            results.push({ test: test.name, status: 'PASSED' });
        } catch (error) {
            console.error(`${test.name} failed:`, error.message);
            results.push({ 
                test: test.name, 
                status: 'FAILED', 
                error: error.message 
            });
        }
    }
    
    // Generate test report
    const report = {
        timestamp: new Date().toISOString(),
        environment: process.env.TEST_ENV || 'dev',
        results,
        summary: {
            total: results.length,
            passed: results.filter(r => r.status === 'PASSED').length,
            failed: results.filter(r => r.status === 'FAILED').length
        }
    };
    
    require('fs').writeFileSync('test-report.json', JSON.stringify(report, null, 2));
    console.log('Test Summary:', report.summary);
    
    return report.summary.failed === 0;
}

if (require.main === module) {
    runTestSuite()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}
```

## Integration with Development Workflow

1. **Start development environment**: `make build-deploy-dev`
2. **Verify deployment**: Check https://cutty-dev.emilycogsdill.com/do-stuff/cut
3. **Run Puppeteer tests**: `node puppeteer-tests/test-suite.js`
4. **Review screenshots**: Check generated PNG files in project root
5. **Debug failures**: Use visual debugging and state capture
6. **Iterate**: Modify code and re-run specific tests

### Pre-deployment Testing Checklist

```javascript
async function preDeploymentTests() {
    const criticalTests = [
        'Authentication flow works',
        'File upload processes correctly',
        'Data exports in all formats',
        'CUT feature filters data',
        'Mobile responsive design',
        'API endpoints respond correctly'
    ];
    
    console.log('Running pre-deployment tests...');
    // Execute critical test suite
    // Block deployment if any critical test fails
}
```

This comprehensive testing approach ensures Cutty's reliability across edge computing environments, authentication flows, and complex data operations while providing clear debugging capabilities for development teams.
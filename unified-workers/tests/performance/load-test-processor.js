/**
 * Artillery Load Test Processor
 * Custom functions for load testing scenarios
 */

const { faker } = require('@faker-js/faker');

// Test user credentials for load testing
const TEST_USERS = [
  { username: 'loadtest1', password: 'testpass123' },
  { username: 'loadtest2', password: 'testpass123' },
  { username: 'loadtest3', password: 'testpass123' },
  { username: 'loadtest4', password: 'testpass123' },
  { username: 'loadtest5', password: 'testpass123' },
];

// Performance tracking
const performanceMetrics = {
  slowRequests: 0,
  fastRequests: 0,
  errors: 0,
  totalRequests: 0,
};

/**
 * Login with a test user
 */
async function loginTestUser(context, events, done) {
  // Select a random test user
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  
  try {
    const response = await fetch(`${context.target}/api/accounts/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        password: user.password,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      context.vars.accessToken = data.access_token;
      context.vars.username = user.username;
      
      // Track performance
      performanceMetrics.totalRequests++;
      if (response.headers.get('x-response-time')) {
        const responseTime = parseInt(response.headers.get('x-response-time'));
        if (responseTime > 200) {
          performanceMetrics.slowRequests++;
        } else {
          performanceMetrics.fastRequests++;
        }
      }
    } else {
      performanceMetrics.errors++;
      console.warn(`Login failed for ${user.username}: ${response.status}`);
    }
  } catch (error) {
    performanceMetrics.errors++;
    console.error('Login error:', error.message);
  }
  
  return done();
}

/**
 * Generate random CSV data for testing
 */
function generateRandomCSV(context, events, done) {
  const headers = ['name', 'age', 'city', 'country', 'email'];
  const rows = [];
  
  // Generate 10-50 random rows
  const numRows = Math.floor(Math.random() * 40) + 10;
  
  for (let i = 0; i < numRows; i++) {
    const row = [
      faker.person.fullName(),
      Math.floor(Math.random() * 50) + 18,
      faker.location.city(),
      faker.location.country(),
      faker.internet.email(),
    ];
    rows.push(row.join(','));
  }
  
  const csvContent = headers.join(',') + '\n' + rows.join('\n');
  context.vars.randomCSV = csvContent;
  
  return done();
}

/**
 * Upload file with form data
 */
async function uploadCSVFile(context, events, done) {
  if (!context.vars.accessToken) {
    console.warn('No access token available for file upload');
    return done();
  }
  
  try {
    const csvContent = context.vars.randomCSV || 'name,age\nJohn,25\nJane,30';
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', blob, `load-test-${Date.now()}.csv`);
    
    const response = await fetch(`${context.target}/api/list_cutter/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${context.vars.accessToken}`,
      },
      body: formData,
    });
    
    if (response.ok) {
      const data = await response.json();
      context.vars.uploadedFileId = data.file_id;
      
      // Track performance
      performanceMetrics.totalRequests++;
      const responseTime = parseInt(response.headers.get('x-response-time') || '0');
      if (responseTime > 500) {
        performanceMetrics.slowRequests++;
      } else {
        performanceMetrics.fastRequests++;
      }
    } else {
      performanceMetrics.errors++;
      console.warn(`File upload failed: ${response.status}`);
    }
  } catch (error) {
    performanceMetrics.errors++;
    console.error('Upload error:', error.message);
  }
  
  return done();
}

/**
 * Simulate realistic user behavior with think time
 */
function addThinkTime(context, events, done) {
  // Random think time between 1-5 seconds to simulate real user behavior
  const thinkTime = Math.floor(Math.random() * 4000) + 1000;
  
  setTimeout(() => {
    return done();
  }, thinkTime);
}

/**
 * Generate complex filter criteria for CSV processing
 */
function generateFilterCriteria(context, events, done) {
  const filterOptions = [
    { age: { min: 25, max: 35 } },
    { city: 'NYC' },
    { country: 'USA' },
    { age: { min: 18 } },
    {},  // No filters
  ];
  
  const selectedFilter = filterOptions[Math.floor(Math.random() * filterOptions.length)];
  context.vars.filterCriteria = selectedFilter;
  
  return done();
}

/**
 * Measure Core Web Vitals simulation
 */
async function measureCoreWebVitals(context, events, done) {
  const startTime = Date.now();
  
  try {
    // Simulate loading the main page
    const response = await fetch(`${context.target}/`);
    const loadTime = Date.now() - startTime;
    
    // Simulate Core Web Vitals metrics
    context.vars.fcp = loadTime + Math.random() * 100; // First Contentful Paint
    context.vars.lcp = loadTime + Math.random() * 200; // Largest Contentful Paint
    context.vars.cls = Math.random() * 0.1; // Cumulative Layout Shift
    context.vars.fid = Math.random() * 100; // First Input Delay
    
    // Log if metrics are outside acceptable ranges
    if (context.vars.lcp > 2500) {
      console.warn(`Poor LCP detected: ${context.vars.lcp}ms`);
    }
    if (context.vars.cls > 0.1) {
      console.warn(`Poor CLS detected: ${context.vars.cls}`);
    }
    if (context.vars.fid > 100) {
      console.warn(`Poor FID detected: ${context.vars.fid}ms`);
    }
    
  } catch (error) {
    console.error('Core Web Vitals measurement error:', error.message);
  }
  
  return done();
}

/**
 * Stress test with rapid requests
 */
async function stressTestRapidRequests(context, events, done) {
  const promises = [];
  const numRequests = 5; // Send 5 rapid requests
  
  for (let i = 0; i < numRequests; i++) {
    const promise = fetch(`${context.target}/health`)
      .then(response => {
        performanceMetrics.totalRequests++;
        if (response.ok) {
          performanceMetrics.fastRequests++;
        } else {
          performanceMetrics.errors++;
        }
      })
      .catch(error => {
        performanceMetrics.errors++;
        console.error(`Rapid request ${i} failed:`, error.message);
      });
    
    promises.push(promise);
  }
  
  await Promise.all(promises);
  return done();
}

/**
 * Cleanup test data
 */
async function cleanupTestData(context, events, done) {
  if (!context.vars.accessToken || !context.vars.uploadedFileId) {
    return done();
  }
  
  try {
    await fetch(`${context.target}/api/list_cutter/delete/${context.vars.uploadedFileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${context.vars.accessToken}`,
      },
    });
  } catch (error) {
    console.warn('Cleanup failed:', error.message);
  }
  
  return done();
}

/**
 * Report performance metrics
 */
function reportMetrics(context, events, done) {
  if (performanceMetrics.totalRequests > 0) {
    const errorRate = (performanceMetrics.errors / performanceMetrics.totalRequests) * 100;
    const slowRequestRate = (performanceMetrics.slowRequests / performanceMetrics.totalRequests) * 100;
    
    console.log(`📊 Performance Metrics:
      Total Requests: ${performanceMetrics.totalRequests}
      Error Rate: ${errorRate.toFixed(2)}%
      Slow Request Rate: ${slowRequestRate.toFixed(2)}%
      Fast Requests: ${performanceMetrics.fastRequests}
      Slow Requests: ${performanceMetrics.slowRequests}
      Errors: ${performanceMetrics.errors}
    `);
    
    // Reset metrics for next phase
    Object.keys(performanceMetrics).forEach(key => {
      performanceMetrics[key] = 0;
    });
  }
  
  return done();
}

// Export functions for Artillery
module.exports = {
  loginTestUser,
  generateRandomCSV,
  uploadCSVFile,
  addThinkTime,
  generateFilterCriteria,
  measureCoreWebVitals,
  stressTestRapidRequests,
  cleanupTestData,
  reportMetrics,
};
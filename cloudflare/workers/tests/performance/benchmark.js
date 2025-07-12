/**
 * Benchmark Tests for Critical Functions
 * 
 * Performance benchmarks for JWT operations, database queries, and critical paths.
 */

const Benchmark = require('benchmark');

// Mock environment for testing
const mockEnv = {
  JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long',
};

// Import functions to benchmark (these would be actual imports in real implementation)
// For now, we'll create mock functions that simulate the actual operations

// Mock JWT operations
async function mockGenerateJWT(payload, secret, expiresIn) {
  // Simulate JWT generation time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
  return 'mock.jwt.token';
}

async function mockVerifyJWT(token, secret) {
  // Simulate JWT verification time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 3));
  return { user_id: 1, username: 'test', exp: Math.floor(Date.now() / 1000) + 600 };
}

async function mockHashPassword(password) {
  // Simulate password hashing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
  return 'hashed_password';
}

async function mockVerifyPassword(password, hash) {
  // Simulate password verification time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
  return true;
}

async function mockDatabaseQuery() {
  // Simulate database query time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
  return { id: 1, username: 'test' };
}

// Benchmark Suite
const suite = new Benchmark.Suite();

console.log('Starting Cutty Workers Performance Benchmarks...\n');

// JWT Generation Benchmark
suite.add('JWT Generation', {
  defer: true,
  fn: async function(deferred) {
    await mockGenerateJWT(
      { user_id: 1, username: 'test', token_type: 'access' },
      mockEnv.JWT_SECRET,
      '10m'
    );
    deferred.resolve();
  }
});

// JWT Verification Benchmark
suite.add('JWT Verification', {
  defer: true,
  fn: async function(deferred) {
    await mockVerifyJWT('mock.jwt.token', mockEnv.JWT_SECRET);
    deferred.resolve();
  }
});

// Password Hashing Benchmark
suite.add('Password Hashing', {
  defer: true,
  fn: async function(deferred) {
    await mockHashPassword('TestPassword123!');
    deferred.resolve();
  }
});

// Password Verification Benchmark
suite.add('Password Verification', {
  defer: true,
  fn: async function(deferred) {
    await mockVerifyPassword('TestPassword123!', 'hashed_password');
    deferred.resolve();
  }
});

// Database Query Benchmark
suite.add('Database Query', {
  defer: true,
  fn: async function(deferred) {
    await mockDatabaseQuery();
    deferred.resolve();
  }
});

// JSON Parsing Benchmark
suite.add('JSON Parsing', function() {
  const data = {
    user: { id: 1, username: 'test', email: 'test@example.com' },
    permissions: ['read', 'write'],
    metadata: { created_at: new Date().toISOString() }
  };
  JSON.stringify(data);
  JSON.parse(JSON.stringify(data));
});

// String Operations Benchmark
suite.add('String Operations', function() {
  const username = 'testuser';
  const email = 'test@example.com';
  const domain = email.split('@')[1];
  const normalized = username.toLowerCase().trim();
  const validation = /^[a-zA-Z0-9_-]+$/.test(normalized);
});

// Array Operations Benchmark
suite.add('Array Operations', function() {
  const permissions = ['read', 'write', 'delete', 'admin'];
  const hasPermission = permissions.includes('write');
  const filtered = permissions.filter(p => p !== 'admin');
  const mapped = permissions.map(p => p.toUpperCase());
});

// Object Operations Benchmark
suite.add('Object Operations', function() {
  const user = { id: 1, username: 'test' };
  const extended = { ...user, email: 'test@example.com', created_at: Date.now() };
  const keys = Object.keys(extended);
  const values = Object.values(extended);
});

// Add event listeners for results
suite.on('cycle', function(event) {
  const benchmark = event.target;
  const hz = benchmark.hz;
  const rme = benchmark.stats.rme;
  const mean = benchmark.stats.mean * 1000; // Convert to ms
  
  console.log(`${benchmark.name}:`);
  console.log(`  Operations/sec: ${hz.toLocaleString()} ±${rme.toFixed(2)}%`);
  console.log(`  Mean time: ${mean.toFixed(3)}ms`);
  console.log(`  Samples: ${benchmark.stats.sample.length}`);
  console.log('');
});

suite.on('complete', function() {
  console.log('Benchmark Summary:');
  console.log('=================');
  
  const results = this.slice().sort((a, b) => b.hz - a.hz);
  
  results.forEach((benchmark, index) => {
    const rank = index + 1;
    const hz = benchmark.hz.toLocaleString();
    const name = benchmark.name;
    console.log(`${rank}. ${name}: ${hz} ops/sec`);
  });
  
  console.log('\nPerformance Thresholds:');
  console.log('======================');
  
  results.forEach(benchmark => {
    const name = benchmark.name;
    const hz = benchmark.hz;
    let status = 'UNKNOWN';
    let threshold = 0;
    
    // Define performance thresholds for different operations
    switch (name) {
      case 'JWT Generation':
        threshold = 1000; // 1000 ops/sec minimum
        break;
      case 'JWT Verification':
        threshold = 2000; // 2000 ops/sec minimum
        break;
      case 'Password Hashing':
        threshold = 50; // 50 ops/sec minimum (intentionally slow)
        break;
      case 'Password Verification':
        threshold = 100; // 100 ops/sec minimum
        break;
      case 'Database Query':
        threshold = 500; // 500 ops/sec minimum
        break;
      case 'JSON Parsing':
        threshold = 10000; // 10000 ops/sec minimum
        break;
      case 'String Operations':
        threshold = 100000; // 100000 ops/sec minimum
        break;
      case 'Array Operations':
        threshold = 50000; // 50000 ops/sec minimum
        break;
      case 'Object Operations':
        threshold = 100000; // 100000 ops/sec minimum
        break;
    }
    
    status = hz >= threshold ? 'PASS' : 'FAIL';
    const percentage = ((hz / threshold) * 100).toFixed(1);
    
    console.log(`${name}: ${status} (${percentage}% of threshold: ${threshold.toLocaleString()} ops/sec)`);
  });
  
  console.log('\nBenchmark completed successfully!');
  
  // Exit with error code if any benchmarks failed thresholds
  const failures = results.filter(benchmark => {
    const thresholds = {
      'JWT Generation': 1000,
      'JWT Verification': 2000,
      'Password Hashing': 50,
      'Password Verification': 100,
      'Database Query': 500,
      'JSON Parsing': 10000,
      'String Operations': 100000,
      'Array Operations': 50000,
      'Object Operations': 100000,
    };
    
    const threshold = thresholds[benchmark.name] || 0;
    return benchmark.hz < threshold;
  });
  
  if (failures.length > 0) {
    console.log(`\nWARNING: ${failures.length} benchmark(s) failed to meet performance thresholds!`);
    process.exit(1);
  }
});

suite.on('error', function(event) {
  console.error('Benchmark error:', event.target.error);
  process.exit(1);
});

// Start the benchmark suite
suite.run({ async: true });

// Export for potential use in other scripts
module.exports = {
  runBenchmarks: () => suite.run({ async: true }),
  getBenchmarkResults: () => suite.slice(),
};
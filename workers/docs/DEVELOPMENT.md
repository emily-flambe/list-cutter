# Development Guide

This guide provides detailed instructions for setting up, developing, and maintaining the Cutty authentication and file management system.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version 18 or higher
- **Wrangler CLI**: Version 3.0 or higher (`npm install -g wrangler`)
- **Cloudflare Account**: With Workers, D1, R2, and KV access
- **Git**: For version control

### Environment Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-org/cutty.git
   cd cutty/workers
   npm install
   ```

2. **Configure Wrangler**
   ```bash
   # Authenticate with Cloudflare
   wrangler login
   
   # Verify authentication
   wrangler whoami
   ```

3. **Create Development Resources**
   ```bash
   # Create development KV namespace
   wrangler kv:namespace create "AUTH_KV" --preview
   
   # Create development database
   wrangler d1 create cutty-dev
   
   # Deploy database schema
   wrangler d1 execute cutty-dev --file=schema.sql
   
   # Create R2 bucket for development
   wrangler r2 bucket create cutty-dev-files
   ```

4. **Set Development Secrets**
   ```bash
   # Generate secure secrets
   wrangler secret put JWT_SECRET --env=dev
   # Enter a 256-bit (32 character) secret: your-super-secure-jwt-secret-here
   
   wrangler secret put ENCRYPTION_KEY --env=dev
   # Enter encryption key: your-encryption-key-here
   
   wrangler secret put API_KEY_SALT --env=dev
   # Enter API key salt: your-api-key-salt-here
   ```

5. **Configure wrangler.toml**
   ```toml
   name = "cutty"
   main = "src/index.ts"
   compatibility_date = "2024-12-30"
   
   [env.dev]
   name = "cutty-dev"
   
   [[env.dev.kv_namespaces]]
   binding = "AUTH_KV"
   id = "your-dev-kv-namespace-id"
   preview_id = "your-dev-kv-preview-id"
   
   [[env.dev.d1_databases]]
   binding = "DB"
   database_name = "cutty-dev"
   database_id = "your-dev-database-id"
   
   [[env.dev.r2_buckets]]
   binding = "R2_BUCKET"
   bucket_name = "cutty-dev-files"
   
   [env.dev.vars]
   ENVIRONMENT = "development"
   MAX_FILE_SIZE = "10485760"  # 10MB
   ```

## 🔄 Development Workflow

### 1. Start Development Server
```bash
# Start local development server
npm run dev

# Access local server
curl http://localhost:8787/health
```

### 2. Run Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth/jwt.test.ts

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### 3. Code Quality Checks
```bash
# TypeScript type checking
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### 4. Database Operations
```bash
# Execute SQL commands
wrangler d1 execute cutty-dev --env=dev --command="SELECT * FROM users LIMIT 5"

# Execute SQL file
wrangler d1 execute cutty-dev --env=dev --file=migrations/001_add_column.sql

# Export database (for backup/analysis)
wrangler d1 export cutty-dev --env=dev --output=backup.sql
```

### 5. KV Operations
```bash
# List KV keys
wrangler kv:key list --binding=AUTH_KV --env=dev

# Get KV value
wrangler kv:key get "user:1:sessions" --binding=AUTH_KV --env=dev

# Set KV value (for testing)
wrangler kv:key put "test_key" "test_value" --binding=AUTH_KV --env=dev

# Delete KV key
wrangler kv:key delete "test_key" --binding=AUTH_KV --env=dev
```

### 6. R2 Operations
```bash
# List R2 objects
wrangler r2 object list cutty-dev-files

# Upload test file
wrangler r2 object put cutty-dev-files/test.csv --file=test.csv

# Download file
wrangler r2 object get cutty-dev-files/test.csv --file=downloaded.csv
```

## 🧪 Testing Strategy

### Unit Tests
Focus on testing individual functions and classes in isolation:

```typescript
// Example: JWT service test
import { generateJWT, verifyJWT } from '../src/services/auth/jwt';

describe('JWT Service', () => {
  test('should generate and verify valid tokens', async () => {
    const payload = {
      user_id: 1,
      username: 'testuser',
      token_type: 'access' as const
    };
    
    const token = await generateJWT(payload, 'test-secret', '10m');
    const verified = await verifyJWT(token, 'test-secret');
    
    expect(verified).toBeTruthy();
    expect(verified?.user_id).toBe(1);
    expect(verified?.username).toBe('testuser');
  });
});
```

### Integration Tests
Test complete request/response cycles using the Workers runtime:

```typescript
import { unstable_dev } from 'wrangler';

describe('Authentication API', () => {
  let worker: any;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  test('should register new user', async () => {
    const response = await worker.fetch('/api/accounts/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'TestPassword123!',
        password2: 'TestPassword123!'
      })
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.user.username).toBe('testuser');
    expect(data.access_token).toBeTruthy();
  });
});
```

### Load Tests
Test performance under load to ensure scalability:

```javascript
// Example using k6 load testing
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  let response = http.get('https://cutty-dev.your-subdomain.workers.dev/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## 🏛️ Architecture Patterns

### Service Layer Pattern
Encapsulate business logic in dedicated service classes:

```typescript
// services/auth/AuthService.ts
export class AuthService {
  constructor(private env: Env) {}
  
  async authenticateUser(credentials: LoginCredentials): Promise<User | null> {
    // Validation logic
    const user = await this.userRepository.findByUsername(credentials.username);
    if (!user) return null;
    
    // Password verification
    const isValid = await this.passwordService.verify(
      credentials.password, 
      user.password
    );
    
    return isValid ? user : null;
  }
}
```

### Middleware Pattern
Handle cross-cutting concerns like authentication and logging:

```typescript
// middleware/auth.ts
export async function authMiddleware(
  request: Request,
  env: Env,
  next: () => Promise<Response>
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  
  if (!payload) {
    return new Response('Invalid token', { status: 401 });
  }
  
  // Attach user context to request
  (request as any).user = payload;
  
  return next();
}
```

### Repository Pattern
Abstract data access logic:

```typescript
// services/storage/UserRepository.ts
export class UserRepository {
  constructor(private db: D1Database) {}
  
  async findById(id: number): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first();
    
    return result ? this.mapToUser(result) : null;
  }
  
  async create(userData: UserCreate): Promise<User> {
    const result = await this.db
      .prepare(`
        INSERT INTO users (username, email, password, created_at)
        VALUES (?, ?, ?, ?)
        RETURNING *
      `)
      .bind(
        userData.username,
        userData.email,
        userData.password,
        Date.now()
      )
      .first();
    
    return this.mapToUser(result);
  }
  
  private mapToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      created_at: new Date(row.created_at).toISOString()
    };
  }
}
```

## 🚀 Performance Optimization

### Database Optimization

1. **Use Indexes for Frequently Queried Columns**
   ```sql
   -- Add indexes to improve query performance
   CREATE INDEX idx_users_username ON users(username);
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
   CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);
   ```

2. **Limit Query Result Sets**
   ```typescript
   // Use LIMIT to prevent large result sets
   const recentEvents = await env.DB
     .prepare('SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 100')
     .all();
   ```

3. **Use Prepared Statements**
   ```typescript
   // Prepare statements for reuse
   const findUserStmt = env.DB.prepare('SELECT * FROM users WHERE id = ?');
   const user = await findUserStmt.bind(userId).first();
   ```

### KV Storage Optimization

1. **Use Appropriate TTL Values**
   ```typescript
   // Set TTL based on data sensitivity
   await env.AUTH_KV.put(
     `session:${sessionId}`,
     JSON.stringify(sessionData),
     { expirationTtl: 3600 } // 1 hour
   );
   ```

2. **Batch Operations When Possible**
   ```typescript
   // Batch multiple KV operations
   const promises = sessionIds.map(id => 
     env.AUTH_KV.delete(`session:${id}`)
   );
   await Promise.all(promises);
   ```

3. **Consider Data Size Limits**
   ```typescript
   // KV values are limited to 25MB
   if (data.length > 25 * 1024 * 1024) {
     throw new Error('Data too large for KV storage');
   }
   ```

### Response Optimization

1. **Minimize Response Payload Size**
   ```typescript
   // Only return necessary fields
   const publicUser = {
     id: user.id,
     username: user.username,
     // Don't include sensitive fields like password hash
   };
   ```

2. **Use Appropriate HTTP Status Codes**
   ```typescript
   // Be specific with status codes
   if (!user) {
     return new Response(
       JSON.stringify({ error: 'User not found' }),
       { status: 404, headers: { 'Content-Type': 'application/json' } }
     );
   }
   ```

3. **Implement Response Caching**
   ```typescript
   // Cache static responses
   return new Response(JSON.stringify(data), {
     headers: {
       'Content-Type': 'application/json',
       'Cache-Control': 'public, max-age=3600'
     }
   });
   ```

## 🐛 Debugging Tips

### Local Debugging

1. **Enable Debug Logging**
   ```bash
   # Set debug environment variable
   wrangler secret put DEBUG_MODE --env=dev
   # Enter: true
   ```

2. **View Real-time Logs**
   ```bash
   # Watch logs in real-time
   wrangler tail --env=dev --format=pretty
   
   # Filter logs by level
   wrangler tail --env=dev --format=pretty | grep ERROR
   ```

3. **Use Console Debugging**
   ```typescript
   // Add debug logs in development
   if (env.DEBUG_MODE === 'true') {
     console.log('Debug: User authentication attempt', {
       username: credentials.username,
       timestamp: Date.now()
     });
   }
   ```

### Production Debugging

1. **View Production Logs**
   ```bash
   # View production logs
   wrangler tail --env=production
   
   # View historical logs in Cloudflare dashboard
   # Workers -> your-worker -> Logs
   ```

2. **Check Deployment Status**
   ```bash
   # List recent deployments
   wrangler deployments list --env=production
   
   # Get deployment details
   wrangler deployment view <deployment-id>
   ```

3. **Monitor Performance Metrics**
   ```bash
   # Check worker analytics
   # Cloudflare Dashboard -> Workers -> Analytics
   ```

### Common Debug Scenarios

1. **JWT Token Validation Failures**
   ```typescript
   // Debug token validation
   console.log('Token verification debug:', {
     tokenPresent: !!token,
     tokenFormat: token?.substring(0, 20) + '...',
     secretPresent: !!env.JWT_SECRET,
     verificationResult: payload ? 'success' : 'failed'
   });
   ```

2. **Database Connection Issues**
   ```typescript
   // Test database connectivity
   try {
     const testResult = await env.DB
       .prepare('SELECT 1 as test')
       .first();
     console.log('Database connection test:', testResult);
   } catch (error) {
     console.error('Database connection failed:', error);
   }
   ```

3. **KV Storage Problems**
   ```typescript
   // Debug KV operations
   try {
     await env.AUTH_KV.put('test_key', 'test_value');
     const value = await env.AUTH_KV.get('test_key');
     console.log('KV test result:', value);
     await env.AUTH_KV.delete('test_key');
   } catch (error) {
     console.error('KV operation failed:', error);
   }
   ```

## 🚀 Release Process

### Pre-release Checklist

1. **Code Quality**
   - [ ] All tests passing
   - [ ] TypeScript compilation successful
   - [ ] Linting passes without errors
   - [ ] Code coverage > 80%

2. **Security Review**
   - [ ] No sensitive data in logs
   - [ ] All secrets properly configured
   - [ ] Security headers implemented
   - [ ] Rate limiting tested

3. **Documentation**
   - [ ] API documentation updated
   - [ ] Changelog updated
   - [ ] Breaking changes documented
   - [ ] Migration guide provided (if needed)

### Staging Deployment

1. **Deploy to Staging**
   ```bash
   # Deploy to staging environment
   npm run deploy:staging
   
   # Verify staging deployment
   curl https://cutty-staging.your-domain.com/health
   ```

2. **Run Staging Tests**
   ```bash
   # Run integration tests against staging
   npm run test:staging
   
   # Run load tests
   npm run test:load:staging
   ```

3. **Verify Features**
   ```bash
   # Test critical user flows
   # - User registration and login
   # - API key generation and usage
   # - File upload and processing
   # - Security monitoring
   ```

### Production Deployment

1. **Final Checks**
   ```bash
   # Ensure staging tests pass
   npm run test:staging
   
   # Check for any pending migrations
   wrangler d1 migrations list --env=production
   ```

2. **Deploy to Production**
   ```bash
   # Deploy to production
   npm run deploy:production
   
   # Verify production deployment
   curl https://cutty.your-domain.com/health
   ```

3. **Post-deployment Verification**
   ```bash
   # Run production health checks
   npm run test:production:health
   
   # Monitor error rates for 15 minutes
   # Check Cloudflare dashboard for anomalies
   ```

### Rollback Procedure

1. **Quick Rollback**
   ```bash
   # List recent deployments
   wrangler deployments list --env=production
   
   # Rollback to previous deployment
   wrangler rollback <previous-deployment-id> --env=production
   ```

2. **Verify Rollback**
   ```bash
   # Test critical endpoints
   curl https://cutty.your-domain.com/health
   curl https://cutty.your-domain.com/api/accounts/login -X POST \
        -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}'
   ```

## 📊 Monitoring and Observability

### Metrics Collection

```typescript
// Custom metrics for monitoring
class MetricsCollector {
  async recordAPICall(endpoint: string, method: string, statusCode: number, duration: number) {
    await this.env.ANALYTICS?.writeDataPoint({
      blobs: [endpoint, method],
      doubles: [duration],
      indexes: [statusCode.toString()]
    });
  }
  
  async recordSecurityEvent(eventType: string, severity: 'low' | 'medium' | 'high') {
    await this.env.ANALYTICS?.writeDataPoint({
      blobs: [eventType, severity],
      doubles: [Date.now()]
    });
  }
}
```

### Health Check Implementation

```typescript
// Comprehensive health checks
export async function healthCheck(env: Env): Promise<HealthStatus> {
  const checks = await Promise.allSettled([
    // Database connectivity
    env.DB.prepare('SELECT 1').first(),
    
    // KV availability
    env.AUTH_KV.get('health_check_test'),
    
    // R2 connectivity
    env.R2_BUCKET.head('health_check_test'),
  ]);
  
  return {
    status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
    services: {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      kv: checks[1].status === 'fulfilled' ? 'up' : 'down',
      r2: checks[2].status === 'fulfilled' ? 'up' : 'down'
    },
    timestamp: new Date().toISOString()
  };
}
```

This development guide provides comprehensive instructions for working with the Cutty authentication system. Follow these practices to maintain code quality, security, and reliability throughout the development lifecycle.
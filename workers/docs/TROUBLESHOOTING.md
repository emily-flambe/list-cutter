# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Cutty authentication and file management system.

## 🚨 Emergency Procedures

### Service Down

If the service is completely unresponsive:

1. **Check Cloudflare Status**
   ```bash
   # Check service status
   curl -I https://cutty.your-domain.com/health
   
   # If no response, check Cloudflare status
   # Visit: https://www.cloudflarestatus.com/
   ```

2. **Quick Health Check**
   ```bash
   # Check all health endpoints
   curl https://cutty.your-domain.com/health
   curl https://cutty.your-domain.com/health/auth
   ```

3. **Immediate Rollback** (if needed)
   ```bash
   # List recent deployments
   wrangler deployments list --env=production
   
   # Rollback to last known good deployment
   wrangler rollback <deployment-id> --env=production
   ```

### Security Incident

If you suspect a security breach:

1. **Block Suspicious IPs**
   ```bash
   # Emergency IP block
   curl -X POST https://cutty.your-domain.com/api/analytics/security/block-ip \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"ip_address": "suspicious.ip.address", "reason": "security_incident"}'
   ```

2. **Invalidate All Tokens**
   ```bash
   # Force all users to re-authenticate (nuclear option)
   wrangler kv:namespace delete AUTH_KV --env=production
   wrangler kv:namespace create "AUTH_KV" --env=production
   # Update wrangler.toml with new namespace ID
   ```

3. **Check Security Events**
   ```bash
   # Review recent security events
   curl https://cutty.your-domain.com/api/analytics/security/events \
        -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

## 🔐 Authentication Issues

### JWT Token Problems

#### Problem: "Invalid token" errors
**Symptoms**: 401 responses on authenticated endpoints, token verification failures

**Diagnosis Steps**:
```bash
# 1. Check if JWT_SECRET is set correctly
wrangler secret list --env=production | grep JWT_SECRET

# 2. Decode token to check structure (without verifying signature)
# Use jwt.io or:
node -e "console.log(JSON.parse(Buffer.from('$TOKEN'.split('.')[1], 'base64')))"

# 3. Check token expiration
# Token payload should show 'exp' field with Unix timestamp
```

**Solutions**:
1. **Secret Mismatch**
   ```bash
   # Verify JWT_SECRET is correct
   wrangler secret put JWT_SECRET --env=production
   ```

2. **Token Expired**
   ```bash
   # Client should refresh token
   curl -X POST https://cutty.your-domain.com/api/accounts/token/refresh \
        -H "Content-Type: application/json" \
        -d '{"refresh_token": "$REFRESH_TOKEN"}'
   ```

3. **Token Format Issues**
   ```bash
   # Ensure token includes 'Bearer ' prefix
   # Correct: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   # Wrong:   Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Clock Skew**
   ```bash
   # Check if server time is synchronized
   # Tokens may fail if server clock is significantly off
   date
   ```

#### Problem: Token blacklisted unexpectedly
**Symptoms**: Valid tokens rejected, users forced to re-login

**Diagnosis Steps**:
```bash
# Check if token is in blacklist
wrangler kv:key get "blacklist:$TOKEN_JTI" --binding=AUTH_KV --env=production

# Check for recent logout events
curl https://cutty.your-domain.com/api/analytics/security/events?event_type=logout \
     -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Solutions**:
1. **Investigate Logout Cause**
   - Check security events for forced logouts
   - Look for security incidents that triggered mass token invalidation
   - Review application logs for unexpected token blacklisting

2. **Clear Blacklist Entry** (if appropriate)
   ```bash
   # Only if token was blacklisted in error
   wrangler kv:key delete "blacklist:$TOKEN_JTI" --binding=AUTH_KV --env=production
   ```

### Login/Registration Issues

#### Problem: "User already exists" on registration
**Symptoms**: 409 errors during user registration with available usernames

**Diagnosis Steps**:
```bash
# Check if user actually exists
wrangler d1 execute cutty-db --env=production \
  --command="SELECT username, email FROM users WHERE username = 'username' OR email = 'email'"

# Check for case sensitivity issues
wrangler d1 execute cutty-db --env=production \
  --command="SELECT username FROM users WHERE LOWER(username) = LOWER('username')"
```

**Solutions**:
1. **Case Sensitivity**
   ```sql
   -- Make username comparison case-insensitive
   SELECT * FROM users WHERE LOWER(username) = LOWER(?);
   ```

2. **Email Conflicts**
   ```bash
   # Check if email is already registered
   wrangler d1 execute cutty-db --env=production \
     --command="SELECT username, email FROM users WHERE email = 'user@example.com'"
   ```

3. **Database Constraints**
   ```sql
   -- Check table constraints
   PRAGMA table_info(users);
   ```

#### Problem: "Invalid credentials" with correct password
**Symptoms**: Login fails with correct username/password combination

**Diagnosis Steps**:
```bash
# Check if user exists
wrangler d1 execute cutty-db --env=production \
  --command="SELECT id, username, email, created_at FROM users WHERE username = 'username'"

# Check password hash format
wrangler d1 execute cutty-db --env=production \
  --command="SELECT LEFT(password, 20) as password_prefix FROM users WHERE username = 'username'"
```

**Solutions**:
1. **Password Hash Compatibility**
   ```typescript
   // Ensure PBKDF2 hash is Django-compatible
   // Format: pbkdf2_sha256$600000$salt$hash
   ```

2. **Account Status**
   ```sql
   -- Check if account is active (if you have this field)
   SELECT is_active FROM users WHERE username = 'username';
   ```

3. **Rate Limiting**
   ```bash
   # Check if IP is rate limited
   curl -I https://cutty.your-domain.com/api/accounts/login
   # Look for X-RateLimit headers
   ```

## 🗄️ Database Issues

### Connection Problems

#### Problem: Database connection failures
**Symptoms**: D1 connection errors, query timeouts, 500 errors

**Diagnosis Steps**:
```bash
# 1. Test basic database connectivity
wrangler d1 execute cutty-db --env=production --command="SELECT 1 as test"

# 2. Check database binding in wrangler.toml
cat wrangler.toml | grep -A 5 "d1_databases"

# 3. Verify database exists
wrangler d1 list

# 4. Check database size and limits
wrangler d1 info cutty-db
```

**Solutions**:
1. **Database Binding Issues**
   ```toml
   # Ensure correct database ID in wrangler.toml
   [[d1_databases]]
   binding = "DB"
   database_name = "cutty-db"
   database_id = "your-actual-database-id"
   ```

2. **Database Limits**
   ```bash
   # Check if hitting D1 limits
   # Free tier: 5 GB storage, 25 million row reads/day
   wrangler d1 info cutty-db
   ```

3. **Network Issues**
   ```bash
   # Test from different location
   curl -X POST https://cutty.your-domain.com/api/accounts/login \
        -H "Content-Type: application/json" \
        -d '{"username": "test", "password": "test"}'
   ```

#### Problem: Schema deployment fails
**Symptoms**: SQL syntax errors, table creation failures

**Diagnosis Steps**:
```bash
# Check current schema
wrangler d1 execute cutty-db --env=production \
  --command="SELECT name FROM sqlite_master WHERE type='table'"

# Validate SQL syntax
wrangler d1 execute cutty-db --env=production --file=schema.sql --dry-run
```

**Solutions**:
1. **SQL Syntax**
   ```sql
   -- Ensure D1/SQLite compatibility
   -- Use INTEGER instead of SERIAL
   -- Use TEXT instead of VARCHAR
   -- Check foreign key syntax
   ```

2. **Migration Strategy**
   ```bash
   # Apply schema changes incrementally
   wrangler d1 execute cutty-db --env=production \
     --command="ALTER TABLE users ADD COLUMN new_field TEXT"
   ```

### Query Issues

#### Problem: SQL query failures
**Symptoms**: Database query errors, constraint violations

**Diagnosis Steps**:
```bash
# Test queries manually
wrangler d1 execute cutty-db --env=production \
  --command="SELECT * FROM users LIMIT 1"

# Check table structure
wrangler d1 execute cutty-db --env=production \
  --command="PRAGMA table_info(users)"

# Check foreign key constraints
wrangler d1 execute cutty-db --env=production \
  --command="PRAGMA foreign_key_list(api_keys)"
```

**Solutions**:
1. **Parameterized Queries**
   ```typescript
   // Always use parameterized queries
   const user = await env.DB
     .prepare('SELECT * FROM users WHERE id = ?')
     .bind(userId)
     .first();
   ```

2. **Data Type Issues**
   ```sql
   -- Ensure correct data types
   -- SQLite is flexible but be explicit
   INSERT INTO users (id, created_at) VALUES (1, 1640995200000);
   ```

3. **Constraint Violations**
   ```sql
   -- Check constraints before insert/update
   SELECT COUNT(*) FROM users WHERE username = ?;
   ```

## 🚦 Rate Limiting Issues

### False Positives

#### Problem: Legitimate users blocked
**Symptoms**: 429 responses for normal usage patterns

**Diagnosis Steps**:
```bash
# Check current rate limit status
curl -I https://cutty.your-domain.com/api/accounts/login

# Check security events for rate limiting
curl https://cutty.your-domain.com/api/analytics/security/events?event_type=rate_limit \
     -H "Authorization: Bearer $ADMIN_TOKEN"

# Check blocked IPs
curl https://cutty.your-domain.com/api/analytics/security/blocked-ips \
     -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Solutions**:
1. **Adjust Rate Limits**
   ```typescript
   // Review rate limiting thresholds
   const RATE_LIMITS = {
     IP_LIMIT: 200,        // Increase from 100
     USER_LIMIT: 120,      // Increase from 60
     API_KEY_LIMIT: 5000   // Increase from 1000
   };
   ```

2. **Whitelist IPs**
   ```bash
   # Unblock specific IP
   curl -X POST https://cutty.your-domain.com/api/analytics/security/unblock-ip \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"ip_address": "192.168.1.1"}'
   ```

3. **Review IP Detection**
   ```typescript
   // Ensure correct IP detection
   const clientIP = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Forwarded-For') ||
                   request.headers.get('X-Real-IP');
   ```

#### Problem: Rate limiting not working
**Symptoms**: No protection against abuse, excessive requests allowed

**Diagnosis Steps**:
```bash
# Test rate limiting
for i in {1..150}; do
  curl -w "%{http_code}\n" -o /dev/null -s \
    https://cutty.your-domain.com/api/accounts/login \
    -X POST -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done

# Check rate limiting middleware is active
# Look for rate limiting headers in responses
```

**Solutions**:
1. **Enable Rate Limiting**
   ```typescript
   // Ensure rate limiting middleware is applied
   import { rateLimitMiddleware } from './middleware/rateLimit';
   
   // Apply before route handlers
   const response = await rateLimitMiddleware(request, env, () => {
     return handleRoute(request, env);
   });
   ```

2. **Configure KV Storage**
   ```bash
   # Ensure AUTH_KV namespace is properly configured
   wrangler kv:namespace list
   ```

3. **Check Cloudflare Settings**
   ```bash
   # Verify Cloudflare rate limiting rules
   # Check Cloudflare Dashboard -> Security -> WAF -> Rate limiting rules
   ```

## 🔑 API Key Issues

### Key Generation Problems

#### Problem: API key creation fails
**Symptoms**: 500 errors during key generation, database errors

**Diagnosis Steps**:
```bash
# Check if API_KEY_SALT is set
wrangler secret list --env=production | grep API_KEY_SALT

# Test database connectivity for api_keys table
wrangler d1 execute cutty-db --env=production \
  --command="SELECT COUNT(*) FROM api_keys"

# Check table structure
wrangler d1 execute cutty-db --env=production \
  --command="PRAGMA table_info(api_keys)"
```

**Solutions**:
1. **Missing API Key Salt**
   ```bash
   # Set the API key salt secret
   wrangler secret put API_KEY_SALT --env=production
   # Enter a secure random string
   ```

2. **Database Schema Issues**
   ```sql
   -- Ensure api_keys table exists with correct structure
   CREATE TABLE IF NOT EXISTS api_keys (
     key_id TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL,
     name TEXT NOT NULL,
     key_hash TEXT NOT NULL,
     key_prefix TEXT NOT NULL,
     permissions TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     last_used INTEGER,
     expires_at INTEGER,
     is_active INTEGER DEFAULT 1,
     rate_limit_override INTEGER,
     FOREIGN KEY (user_id) REFERENCES users (id)
   );
   ```

3. **Duplicate Key IDs**
   ```typescript
   // Ensure UUID generation is working
   const keyId = crypto.randomUUID();
   // Check for uniqueness before insert
   ```

#### Problem: API key validation fails
**Symptoms**: Valid API keys rejected, authentication errors

**Diagnosis Steps**:
```bash
# Check API key format
echo "cutty_abc123..." | cut -c1-6  # Should be "cutty_"

# Test API key authentication
curl https://cutty.your-domain.com/api/accounts/user \
     -H "Authorization: Bearer cutty_your-api-key-here"

# Check if key exists in database
wrangler d1 execute cutty-db --env=production \
  --command="SELECT key_id, name, is_active, expires_at FROM api_keys WHERE key_id = 'key-id'"
```

**Solutions**:
1. **Key Format**
   ```bash
   # Ensure API key starts with 'cutty_'
   # Total length should be 38 characters (cutty_ + 32 chars)
   ```

2. **Key Expiration**
   ```sql
   -- Check if key has expired
   SELECT key_id, expires_at, (expires_at < strftime('%s', 'now') * 1000) as is_expired 
   FROM api_keys WHERE key_id = ?;
   ```

3. **Key Active Status**
   ```sql
   -- Ensure key is active
   UPDATE api_keys SET is_active = 1 WHERE key_id = ?;
   ```

### Permission Issues

#### Problem: API key permission denied
**Symptoms**: 403 errors with valid API keys

**Diagnosis Steps**:
```bash
# Check API key permissions
wrangler d1 execute cutty-db --env=production \
  --command="SELECT permissions FROM api_keys WHERE key_id = 'key-id'"

# Check required permissions for endpoint
# Review API documentation for endpoint permission requirements
```

**Solutions**:
1. **Add Missing Permissions**
   ```sql
   -- Update API key permissions
   UPDATE api_keys 
   SET permissions = '["files:read", "files:write", "list:process"]'
   WHERE key_id = 'key-id';
   ```

2. **Permission Validation**
   ```typescript
   // Ensure permission checking is working correctly
   const hasPermission = apiKey.permissions.includes('files:read');
   ```

3. **Endpoint Documentation**
   ```bash
   # Check API documentation for correct permissions
   curl https://cutty.your-domain.com/docs
   ```

## ⚡ Performance Issues

### Slow Response Times

#### Problem: API responses are slow
**Symptoms**: High response times, timeouts, poor user experience

**Diagnosis Steps**:
```bash
# Measure response times
time curl https://cutty.your-domain.com/api/accounts/user \
       -H "Authorization: Bearer $TOKEN"

# Check Cloudflare analytics
# Dashboard -> Analytics -> Performance

# Test different endpoints
curl -w "Total time: %{time_total}s\n" \
     https://cutty.your-domain.com/health
```

**Solutions**:
1. **Database Query Optimization**
   ```sql
   -- Add indexes for frequently queried columns
   CREATE INDEX idx_users_username ON users(username);
   CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
   CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);
   ```

2. **Reduce Query Complexity**
   ```typescript
   // Limit result sets
   const recentEvents = await env.DB
     .prepare('SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 50')
     .all();
   
   // Use specific column selection
   const users = await env.DB
     .prepare('SELECT id, username FROM users WHERE active = 1')
     .all();
   ```

3. **KV Storage Optimization**
   ```typescript
   // Use batch operations
   const promises = keys.map(key => env.AUTH_KV.get(key));
   const results = await Promise.all(promises);
   ```

#### Problem: Memory usage high
**Symptoms**: Worker memory limits hit, out of memory errors

**Diagnosis Steps**:
```bash
# Check worker memory usage in Cloudflare dashboard
# Workers -> your-worker -> Metrics -> Memory Usage

# Look for memory-intensive operations in code
# Large JSON parsing, file processing, etc.
```

**Solutions**:
1. **Optimize Data Structures**
   ```typescript
   // Use streaming for large files
   const stream = new ReadableStream({
     start(controller) {
       // Process data in chunks
     }
   });
   ```

2. **Limit Data Processing**
   ```typescript
   // Implement file size limits
   if (fileSize > MAX_FILE_SIZE) {
     throw new Error('File too large');
   }
   ```

3. **Memory-Efficient Parsing**
   ```typescript
   // Use streaming JSON parser for large payloads
   // Process CSV files line by line instead of loading entirely
   ```

### Database Performance

#### Problem: Database queries slow
**Symptoms**: Query timeout errors, high database response times

**Diagnosis Steps**:
```bash
# Test query performance
time wrangler d1 execute cutty-db --env=production \
  --command="SELECT * FROM users WHERE username = 'test'"

# Check query execution plan
wrangler d1 execute cutty-db --env=production \
  --command="EXPLAIN QUERY PLAN SELECT * FROM users WHERE username = ?"
```

**Solutions**:
1. **Add Database Indexes**
   ```sql
   -- Create indexes for common queries
   CREATE INDEX idx_users_username ON users(username);
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_api_keys_user_hash ON api_keys(user_id, key_hash);
   CREATE INDEX idx_security_events_timestamp_type ON security_events(timestamp, event_type);
   ```

2. **Optimize Query Logic**
   ```sql
   -- Use LIMIT to prevent large result sets
   SELECT * FROM security_events 
   ORDER BY timestamp DESC 
   LIMIT 100;
   
   -- Use specific WHERE clauses
   SELECT id, username FROM users 
   WHERE created_at > ? 
   AND is_active = 1;
   ```

3. **Use Prepared Statements**
   ```typescript
   // Prepare statements for reuse
   const stmt = env.DB.prepare('SELECT * FROM users WHERE id = ?');
   const user = await stmt.bind(userId).first();
   ```

## 🛡️ Security Issues

### Brute Force Attacks

#### Problem: Account brute force attempts
**Symptoms**: Multiple failed login attempts, suspicious activity

**Diagnosis Steps**:
```bash
# Check failed login attempts
curl https://cutty.your-domain.com/api/analytics/security/events?event_type=login&success=false \
     -H "Authorization: Bearer $ADMIN_TOKEN"

# Check blocked IPs
curl https://cutty.your-domain.com/api/analytics/security/blocked-ips \
     -H "Authorization: Bearer $ADMIN_TOKEN"

# Monitor real-time events
wrangler tail --env=production | grep "failed_login"
```

**Solutions**:
1. **Verify Rate Limiting**
   ```typescript
   // Ensure progressive delays are working
   const attempts = await getFailedAttempts(ip);
   const delay = Math.min(attempts * 1000, 30000); // Max 30 seconds
   await new Promise(resolve => setTimeout(resolve, delay));
   ```

2. **Block Malicious IPs**
   ```bash
   # Block IP address
   curl -X POST https://cutty.your-domain.com/api/analytics/security/block-ip \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"ip_address": "malicious.ip", "reason": "brute_force_attack"}'
   ```

3. **Review Security Rules**
   ```typescript
   // Adjust brute force detection thresholds
   const BRUTE_FORCE_THRESHOLD = 5; // failed attempts
   const BLOCK_DURATION = 3600000;  // 1 hour in ms
   ```

#### Problem: API abuse
**Symptoms**: Excessive API calls, resource exhaustion

**Diagnosis Steps**:
```bash
# Check API usage patterns
curl https://cutty.your-domain.com/api/analytics/security/metrics \
     -H "Authorization: Bearer $ADMIN_TOKEN"

# Monitor request patterns
wrangler tail --env=production | grep "rate_limit"

# Check API key usage
curl https://cutty.your-domain.com/api/api-keys/usage \
     -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Solutions**:
1. **Implement API Rate Limiting**
   ```typescript
   // Set strict limits for API keys
   const API_RATE_LIMITS = {
     default: 60,      // requests per minute
     premium: 1000,    // for premium users
     admin: 10000      // for admin operations
   };
   ```

2. **Block Abusive Keys**
   ```sql
   -- Revoke abusive API keys
   UPDATE api_keys SET is_active = 0 
   WHERE key_id = 'abusive-key-id';
   ```

3. **Monitor Usage Patterns**
   ```bash
   # Set up alerts for unusual activity
   # Use Cloudflare Analytics to track patterns
   ```

### Token Security

#### Problem: Token compromise suspected
**Symptoms**: Unauthorized access, suspicious activity

**Diagnosis Steps**:
```bash
# Check recent security events for user
curl "https://cutty.your-domain.com/api/analytics/security/events?user_id=123" \
     -H "Authorization: Bearer $ADMIN_TOKEN"

# Review login locations and times
# Check for impossible travel patterns

# Look for token manipulation attempts
grep "token_manipulation" /var/log/workers.log
```

**Solutions**:
1. **Invalidate User Tokens**
   ```bash
   # Force user to re-authenticate
   # Blacklist all active tokens for user
   curl -X POST https://cutty.your-domain.com/api/admin/invalidate-user-tokens \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"user_id": 123}'
   ```

2. **Reset JWT Secret** (nuclear option)
   ```bash
   # This invalidates ALL tokens
   wrangler secret put JWT_SECRET --env=production
   # Enter new 256-bit secret
   ```

3. **Enable Additional Monitoring**
   ```typescript
   // Add IP tracking to tokens
   // Implement device fingerprinting
   // Add geographical restrictions
   ```

## 📊 Monitoring and Debugging

### Debug Mode

Enable comprehensive logging for troubleshooting:

```bash
# Enable debug mode
wrangler secret put DEBUG_MODE --env=production
# Enter: true

# View detailed logs
wrangler tail --env=production --format=pretty

# Disable debug mode when done (important for production)
wrangler secret put DEBUG_MODE --env=production
# Enter: false
```

### Health Checks

Verify system components:

```bash
# Basic health check
curl https://cutty.your-domain.com/health

# Authentication system health
curl https://cutty.your-domain.com/health/auth

# Detailed component check
curl https://cutty.your-domain.com/health/auth | jq '.services'
```

### Database Debugging

Check database connectivity and data:

```bash
# Test database connection
wrangler d1 execute cutty-db --env=production --command="SELECT 1 as test"

# Check table structure
wrangler d1 execute cutty-db --env=production \
  --command="SELECT name FROM sqlite_master WHERE type='table'"

# Verify data integrity
wrangler d1 execute cutty-db --env=production \
  --command="SELECT COUNT(*) as user_count FROM users"
```

### KV Storage Debugging

Check KV operations:

```bash
# List KV namespaces
wrangler kv:namespace list

# Check KV keys
wrangler kv:key list --binding=AUTH_KV --env=production

# Get specific KV value
wrangler kv:key get "refresh_token:some-jti" --binding=AUTH_KV --env=production

# Clean up test data
wrangler kv:key delete "test_key" --binding=AUTH_KV --env=production
```

## 🚨 Error Codes Reference

### Authentication Errors
- `AUTH_001`: Invalid JWT token format or signature
- `AUTH_002`: JWT token expired
- `AUTH_003`: JWT token blacklisted
- `AUTH_004`: Invalid login credentials
- `AUTH_005`: User account not found
- `AUTH_006`: Account temporarily locked (rate limiting)
- `AUTH_007`: Password reset required
- `AUTH_008`: Account disabled

### API Key Errors
- `API_001`: Invalid API key format (must start with cutty_)
- `API_002`: API key not found in database
- `API_003`: API key expired
- `API_004`: API key revoked or inactive
- `API_005`: Insufficient permissions for operation
- `API_006`: API key rate limit exceeded

### Database Errors
- `DB_001`: Database connection failed
- `DB_002`: Query execution timeout
- `DB_003`: Database constraint violation
- `DB_004`: Transaction rollback failed
- `DB_005`: Database schema mismatch

### Rate Limiting Errors
- `RATE_001`: IP address rate limit exceeded
- `RATE_002`: User rate limit exceeded
- `RATE_003`: API key rate limit exceeded
- `RATE_004`: Global rate limit exceeded

### File Operation Errors
- `FILE_001`: File upload failed
- `FILE_002`: File not found
- `FILE_003`: File access denied
- `FILE_004`: File size limit exceeded
- `FILE_005`: Invalid file format

## 📞 Support Escalation

If issues persist after following troubleshooting steps:

### Information to Gather

1. **Error Details**
   - Exact error message
   - HTTP status code
   - Request ID (if available)
   - Timestamp of occurrence

2. **Environment Information**
   ```bash
   # Deployment info
   wrangler deployments list --env=production
   
   # Resource status
   wrangler kv:namespace list
   wrangler d1 list
   ```

3. **Reproduction Steps**
   - Exact steps to reproduce the issue
   - Request/response examples
   - Frequency of occurrence

### Log Collection

```bash
# Collect recent logs
wrangler tail --env=production --format=json > logs.json

# Get deployment information
wrangler deployments view <deployment-id> > deployment-info.txt

# Export critical data (sanitize sensitive information)
wrangler d1 execute cutty-db --env=production \
  --command="SELECT COUNT(*) as user_count FROM users" > stats.txt
```

### Contact Information

- **GitHub Issues**: https://github.com/your-org/cutty/issues
- **Security Issues**: security@cutty.your-domain.com
- **Documentation**: https://cutty.your-domain.com/docs

## 🔧 Maintenance Tasks

### Regular Maintenance

Perform these tasks regularly to maintain system health:

```bash
# Weekly: Clean up expired tokens
wrangler kv:key list --binding=AUTH_KV --env=production | 
  grep "blacklist:" | 
  # Script to check expiration and clean up

# Monthly: Database maintenance
wrangler d1 execute cutty-db --env=production \
  --command="DELETE FROM security_events WHERE timestamp < (strftime('%s', 'now') - 2592000) * 1000"

# Quarterly: Review and rotate secrets
wrangler secret put JWT_SECRET --env=production
wrangler secret put API_KEY_SALT --env=production
```

### Performance Monitoring

```bash
# Check response times
curl -w "@curl-format.txt" https://cutty.your-domain.com/health

# Monitor database performance
wrangler d1 execute cutty-db --env=production \
  --command="PRAGMA optimize"

# Review analytics
# Visit Cloudflare Dashboard -> Workers -> Analytics
```

This troubleshooting guide covers the most common issues you might encounter. Keep it updated as you discover new issues and solutions.
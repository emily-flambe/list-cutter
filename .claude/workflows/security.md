# Security Procedures

## Security Framework

### Security Principles
- **Defense in Depth**: Multiple security layers
- **Zero Trust**: Verify everything, trust nothing  
- **Least Privilege**: Minimum necessary access
- **Security by Design**: Built-in security from start
- **Continuous Monitoring**: Real-time threat detection

### Compliance Standards
- **OWASP Top 10**: Full compliance implemented
- **Data Protection**: Secure handling of user data
- **Privacy**: Minimal data collection and retention
- **Audit Trail**: Comprehensive security logging

## Authentication Security

### JWT Security Implementation
```typescript
// JWT configuration
const JWT_CONFIG = {
  algorithm: 'HS256',
  expiresIn: '15m',        // Short-lived access tokens
  refreshExpiresIn: '7d',   // Longer refresh tokens
  issuer: 'cutty-api',
  audience: 'cutty-users'
};

// Token validation middleware
export const validateJWT = async (token: string) => {
  try {
    const payload = await jose.jwtVerify(token, jwtSecret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });
    return payload;
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
};
```

### API Key Security
```typescript
// API key hashing
export const hashApiKey = async (key: string, salt: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// API key validation
export const validateApiKey = async (providedKey: string, storedHash: string, salt: string) => {
  const providedHash = await hashApiKey(providedKey, salt);
  return providedHash === storedHash;
};
```

### Password Security
```typescript
// Password hashing (bcrypt equivalent for Workers)
export const hashPassword = async (password: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
```

## Authorization Controls

### Role-Based Access Control
```typescript
interface UserRole {
  name: string;
  permissions: Permission[];
}

interface Permission {
  resource: string;
  actions: string[];
}

// Permission checking
export const hasPermission = (user: User, resource: string, action: string): boolean => {
  return user.roles.some(role =>
    role.permissions.some(permission =>
      permission.resource === resource &&
      permission.actions.includes(action)
    )
  );
};
```

### File Access Control
```typescript
// File ownership validation
export const validateFileAccess = async (userId: string, fileId: string, action: 'read' | 'write' | 'delete') => {
  const file = await getFileById(fileId);
  
  if (!file) {
    throw new NotFoundError('File not found');
  }
  
  if (file.userId !== userId) {
    throw new ForbiddenError('Access denied to file');
  }
  
  // Additional action-specific checks
  if (action === 'delete' && file.isSystemFile) {
    throw new ForbiddenError('Cannot delete system file');
  }
  
  return file;
};
```

## Input Validation

### Zod Schema Validation
```typescript
import { z } from 'zod';

// User registration schema
export const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  name: z.string().min(1).max(100).trim()
});

// File upload schema
export const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/),
  size: z.number().min(1).max(10 * 1024 * 1024), // 10MB max
  contentType: z.string().regex(/^[a-zA-Z0-9\/.-]+$/)
});

// CSV processing schema
export const CSVProcessingSchema = z.object({
  columns: z.array(z.string().min(1).max(100)).max(50),
  filters: z.array(z.object({
    column: z.string().min(1).max(100),
    operator: z.enum(['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN']),
    value: z.string().max(1000)
  })).max(20)
});
```

### File Validation
```typescript
// File type validation
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain'
];

export const validateFileType = (contentType: string): boolean => {
  return ALLOWED_MIME_TYPES.includes(contentType);
};

// File content validation
export const validateCSVContent = async (fileContent: string): Promise<boolean> => {
  try {
    // Basic CSV structure validation
    const lines = fileContent.split('\n');
    if (lines.length < 2) return false; // At least header + 1 data row
    
    // Check for malicious content
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i
    ];
    
    return !maliciousPatterns.some(pattern => pattern.test(fileContent));
  } catch {
    return false;
  }
};
```

## Rate Limiting

### Rate Limiting Implementation
```typescript
interface RateLimit {
  requests: number;
  windowMs: number;
  blockDurationMs: number;
}

const RATE_LIMITS: Record<string, RateLimit> = {
  login: { requests: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 }, // 5 per 15min
  register: { requests: 3, windowMs: 60 * 60 * 1000, blockDurationMs: 60 * 60 * 1000 }, // 3 per hour
  fileUpload: { requests: 20, windowMs: 60 * 60 * 1000, blockDurationMs: 5 * 60 * 1000 }, // 20 per hour
  apiGeneral: { requests: 100, windowMs: 60 * 60 * 1000, blockDurationMs: 60 * 1000 } // 100 per hour
};

export const rateLimitMiddleware = (limitType: keyof typeof RATE_LIMITS) => {
  return async (c: Context, next: Next) => {
    const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
    const limit = RATE_LIMITS[limitType];
    
    const isLimited = await checkRateLimit(clientIP, limitType, limit);
    
    if (isLimited) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }
    
    await next();
  };
};
```

## Security Headers

### Security Headers Implementation
```typescript
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "form-action 'self'"
  ].join('; '),
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

export const applySecurityHeaders = (response: Response): Response => {
  Object.entries(securityHeaders).forEach(([name, value]) => {
    response.headers.set(name, value);
  });
  return response;
};
```

## Threat Detection

### Security Event Monitoring
```typescript
interface SecurityEvent {
  type: 'auth_failure' | 'rate_limit' | 'suspicious_activity' | 'data_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  details: Record<string, any>;
}

export const logSecurityEvent = async (event: SecurityEvent) => {
  // Log to D1 database
  await insertSecurityEvent(event);
  
  // Send to monitoring service
  if (event.severity === 'critical') {
    await sendCriticalAlert(event);
  }
  
  // Update threat intelligence
  await updateThreatIntelligence(event);
};
```

### Automated Threat Response
```typescript
export const handleThreatDetection = async (event: SecurityEvent) => {
  switch (event.type) {
    case 'auth_failure':
      if (await getFailedAttempts(event.ipAddress, '1h') > 10) {
        await blockIP(event.ipAddress, '1h');
        await logSecurityEvent({
          ...event,
          type: 'suspicious_activity',
          severity: 'high'
        });
      }
      break;
      
    case 'rate_limit':
      if (await getRateLimitViolations(event.ipAddress, '1h') > 5) {
        await blockIP(event.ipAddress, '24h');
      }
      break;
      
    case 'suspicious_activity':
      await quarantineUser(event.userId);
      await sendSecurityAlert(event);
      break;
  }
};
```

## Security Testing

### Security Test Suite
```bash
# Run all security tests
npm test tests/security/

# Specific security test categories
npm test tests/security/auth-bypass.test.ts
npm test tests/security/input-validation.test.ts
npm test tests/security/rate-limiting.test.ts
npm test tests/security/file-access-control.test.ts
npm test tests/security/jwt-security.test.ts
```

### Penetration Testing
```bash
# Automated security scanning
npm run security:scan

# OWASP ZAP integration
npm run security:zap

# SQL injection testing
npm run security:sql-injection

# XSS testing
npm run security:xss
```

## Incident Response

### Incident Classification
- **P0 - Critical**: Data breach, system compromise
- **P1 - High**: Authentication bypass, privilege escalation
- **P2 - Medium**: Rate limiting bypass, minor data exposure
- **P3 - Low**: Security warning, informational alert

### Incident Response Process
1. **Detection**: Automated monitoring triggers alert
2. **Assessment**: Determine severity and impact
3. **Containment**: Isolate affected systems
4. **Investigation**: Analyze attack vectors and extent
5. **Eradication**: Remove threats and vulnerabilities
6. **Recovery**: Restore normal operations
7. **Lessons Learned**: Update security measures

### Emergency Contacts
```typescript
const SECURITY_CONTACTS = {
  P0: ['security-team@company.com', '+1-555-0199'],
  P1: ['security-team@company.com'],
  P2: ['dev-team@company.com'],
  P3: ['monitoring@company.com']
};
```

## Compliance and Auditing

### Security Audit Trail
```typescript
interface AuditEvent {
  eventType: string;
  userId?: string;
  resource: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
  details?: Record<string, any>;
}

export const auditLog = async (event: AuditEvent) => {
  await insertAuditEvent(event);
  
  // Send to compliance monitoring
  if (isComplianceRelevant(event)) {
    await sendToComplianceSystem(event);
  }
};
```

### Compliance Reporting
```bash
# Generate security report
npm run security:report

# Compliance audit
npm run security:compliance-audit

# Vulnerability assessment
npm run security:vulnerability-scan
```

## Security Maintenance

### Regular Security Tasks
- **Weekly**: Security scan execution
- **Monthly**: Dependency vulnerability check
- **Quarterly**: Security configuration review
- **Annually**: Full security audit and penetration testing

### Security Updates
```bash
# Update security dependencies
npm audit fix

# Check for security vulnerabilities
npm audit

# Update Cloudflare security settings
# Review and update security policies
```
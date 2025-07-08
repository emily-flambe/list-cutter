# Security Configuration Management System

This document describes the comprehensive security configuration management system implemented for the Cutty Cloudflare Workers application.

## Overview

The security configuration management system provides centralized, dynamic security policy management with:
- Centralized configuration storage via KV
- Dynamic configuration updates without redeployment
- Performance monitoring for all security features
- Security metrics collection and reporting
- Real-time security health monitoring
- Integration testing framework

## Architecture

### Core Components

1. **SecurityConfigManager** (`/src/config/security-config.ts`)
   - Centralized security policy management
   - Dynamic configuration updates via KV store
   - Environment-specific configuration
   - Configuration validation and integrity checks

2. **SecurityMonitorService** (`/src/services/security/security-monitor.ts`)
   - Real-time security monitoring
   - Performance tracking for security operations
   - Threat detection and alerting
   - Security health assessment

3. **SecurityMetricsCollector** (`/src/services/security/metrics-collector.ts`)
   - Comprehensive metrics collection
   - Dashboard data generation
   - Trend analysis and reporting
   - Metrics export functionality

4. **SecurityHeadersMiddleware** (`/src/middleware/security-headers.ts`)
   - Dynamic security headers management
   - CSP policy enforcement
   - Nonce generation for inline scripts
   - Security level-based header configuration

## Configuration Structure

### Security Policy Schema

```typescript
interface SecurityPolicy {
  auth: {
    jwtExpirationSeconds: number;
    refreshTokenExpirationSeconds: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    requireMfa: boolean;
    passwordMinLength: number;
    passwordRequireSpecialChars: boolean;
    allowedOrigins: string[];
  };
  
  fileUpload: {
    maxFileSize: number;
    maxFilesPerHour: number;
    maxTotalSizePerHour: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    enableMagicByteValidation: boolean;
    enableContentScanning: boolean;
    quarantineHighRiskFiles: boolean;
    virusScanTimeout: number;
  };
  
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
  
  headers: {
    contentSecurityPolicy: string;
    strictTransportSecurity: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
    referrerPolicy: string;
    permissionsPolicy: string;
    expectCt: string;
    crossOriginResourcePolicy: string;
    crossOriginOpenerPolicy: string;
    crossOriginEmbedderPolicy: string;
  };
  
  dataProtection: {
    enableEncryptionAtRest: boolean;
    enableEncryptionInTransit: boolean;
    piiDetectionEnabled: boolean;
    dataRetentionDays: number;
    enableAuditLogging: boolean;
    enableDataLineageTracking: boolean;
  };
  
  monitoring: {
    enableSecurityMetrics: boolean;
    enableThreatDetection: boolean;
    enableAnomalyDetection: boolean;
    alertThresholds: {
      failedLoginAttempts: number;
      suspiciousFileUploads: number;
      rateLimitExceeded: number;
      securityViolations: number;
    };
    metricsRetentionDays: number;
  };
}
```

### Environment-Specific Defaults

#### Development Environment
- MFA disabled for easier testing
- Higher rate limits for development workflows
- Relaxed authentication policies
- Extended logging for debugging

#### Production Environment
- MFA enabled by default
- Stricter rate limits
- Enhanced security headers
- Comprehensive monitoring and alerting

## API Endpoints

### Security Configuration

#### Get Configuration Summary
```http
GET /api/security/config
```

Returns:
```json
{
  "version": "1.0.0",
  "environment": "production",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "enabledFeatures": ["MFA", "ContentScanning", "RateLimit", "Encryption"],
  "securityLevel": "high"
}
```

#### Update Configuration
```http
POST /api/security/config/update
Content-Type: application/json

{
  "auth": {
    "maxLoginAttempts": 3
  },
  "rateLimit": {
    "maxRequests": 50
  }
}
```

### Security Monitoring

#### Get Security Dashboard
```http
GET /api/security/dashboard
```

Returns comprehensive security dashboard data including:
- Security event summary
- Performance metrics
- Active alerts
- Threat analysis
- System health status

#### Get Security Metrics
```http
GET /api/security/metrics?timeRange=24h&format=dashboard
```

Query parameters:
- `timeRange`: `1h`, `24h`, `7d`, `30d`
- `format`: `json`, `dashboard`, `export`
- `exportFormat`: `json`, `csv` (when format=export)

### Alert Management

#### Resolve Security Alert
```http
POST /api/security/alerts/{alertId}/resolve
Content-Type: application/json

{
  "resolvedBy": "security-team"
}
```

### CSP Reporting

#### CSP Violation Reports
```http
POST /api/security/csp-report
Content-Type: application/csp-report
```

Automatically handles Content Security Policy violation reports.

## Performance Monitoring

### Security Overhead Tracking

The system tracks performance overhead for all security operations:

- **Authentication latency**: Time spent on authentication checks
- **File validation latency**: Time spent validating uploaded files
- **Rate limit check latency**: Time spent checking rate limits
- **Total security overhead**: Combined time for all security operations

### Performance Thresholds

- **Development**: 100ms total security overhead
- **Staging**: 100ms total security overhead  
- **Production**: 50ms total security overhead

Operations exceeding thresholds generate alerts for performance optimization.

## Metrics Collection

### Collected Metrics

1. **Authentication Metrics**
   - `security.auth.attempts`: Authentication attempt count
   - `security.auth.failures`: Failed authentication count
   - `security.auth.duration`: Authentication processing time

2. **File Upload Metrics**
   - `security.file.validations`: File validation count
   - `security.file.validation_duration`: File validation time
   - `security.file.threats`: Threat detection count

3. **Rate Limiting Metrics**
   - `security.rate_limit.checks`: Rate limit check count
   - `security.rate_limit.violations`: Rate limit violation count

4. **General Security Metrics**
   - `security.events.count`: Security event count by type
   - `security.events.response_time`: Response time for security operations
   - `security.performance.duration`: Performance timing data

### Metrics Storage

- **Real-time**: Cloudflare Analytics Engine for high-frequency data
- **Historical**: KV storage for aggregated daily metrics
- **Retention**: Configurable retention periods (default: 30 days)

## Security Headers Configuration

### Dynamic Header Management

The security headers middleware provides:

1. **Content Security Policy (CSP)**
   - Dynamic nonce generation for inline scripts
   - Environment-specific policies
   - Violation reporting to `/api/security/csp-report`

2. **Transport Security**
   - Strict Transport Security (HSTS)
   - Certificate Transparency (Expect-CT)

3. **Cross-Origin Policies**
   - Cross-Origin Resource Policy (CORP)
   - Cross-Origin Opener Policy (COOP)
   - Cross-Origin Embedder Policy (COEP)

4. **Content Protection**
   - X-Frame-Options for clickjacking protection
   - X-Content-Type-Options for MIME sniffing protection
   - Referrer Policy for privacy protection

### Security Level-Based Headers

Headers adapt based on request security level:

- **Low**: Basic security headers
- **Medium**: Enhanced headers for API endpoints
- **High**: Maximum security for authentication and file operations

## Integration Testing

### Test Coverage

The integration testing framework (`/tests/security/security-integration.test.ts`) covers:

1. **Configuration Management**
   - Default configuration loading
   - Dynamic configuration updates
   - Configuration validation
   - Environment-specific settings

2. **Security Monitoring**
   - Event recording and aggregation
   - Performance metric tracking
   - Dashboard data generation
   - Alert generation and resolution

3. **Metrics Collection**
   - Real-time metrics collection
   - Data export functionality
   - Dashboard data generation
   - Performance tracking

4. **End-to-End Workflows**
   - Complete authentication workflows
   - File upload security workflows
   - Security incident response
   - Performance validation

### Running Tests

```bash
# Run all security tests
npm test tests/security/

# Run specific test suite
npm test tests/security/security-integration.test.ts

# Run with coverage
npm run test:coverage tests/security/
```

## Deployment Configuration

### KV Namespace Setup

Create the following KV namespaces:

```bash
# Security configuration storage
wrangler kv:namespace create "SECURITY_CONFIG"
wrangler kv:namespace create "SECURITY_CONFIG" --preview

# Security events storage
wrangler kv:namespace create "SECURITY_EVENTS"
wrangler kv:namespace create "SECURITY_EVENTS" --preview

# Security metrics storage
wrangler kv:namespace create "SECURITY_METRICS"
wrangler kv:namespace create "SECURITY_METRICS" --preview
```

Update `wrangler.toml` with the generated namespace IDs.

### Environment Variables

Required environment variables:

```bash
# Performance monitoring
SECURITY_PERFORMANCE_THRESHOLD=100  # milliseconds
SECURITY_METRICS_RETENTION_DAYS=30
SECURITY_ENABLE_REAL_TIME_MONITORING=true

# Optional: Alert webhook URL
SECURITY_ALERT_WEBHOOK=https://hooks.slack.com/your-webhook-url
```

### Analytics Engine Setup

Create an Analytics Engine dataset for real-time metrics:

```bash
wrangler analytics create "cutty_security_analytics"
```

## Security Best Practices

### Configuration Management

1. **Least Privilege**: Configure minimum required permissions
2. **Environment Separation**: Use different configurations per environment
3. **Regular Updates**: Review and update security policies monthly
4. **Monitoring**: Monitor configuration changes and their impact

### Performance Optimization

1. **Caching**: Leverage configuration caching to reduce KV reads
2. **Batching**: Batch metrics collection to reduce overhead
3. **Async Processing**: Use async processing for non-critical operations
4. **Thresholds**: Set appropriate performance thresholds per environment

### Incident Response

1. **Alerting**: Configure alerts for security threshold violations
2. **Escalation**: Define escalation procedures for critical alerts
3. **Documentation**: Maintain incident response playbooks
4. **Testing**: Regularly test incident response procedures

## Troubleshooting

### Common Issues

1. **Configuration Not Loading**
   - Check KV namespace bindings in `wrangler.toml`
   - Verify KV namespace IDs are correct
   - Ensure fallback to defaults is enabled

2. **Performance Alerts**
   - Review security operation timing
   - Check for resource contention
   - Consider adjusting performance thresholds

3. **Metrics Not Collecting**
   - Verify Analytics Engine binding
   - Check metrics collection configuration
   - Ensure proper error handling

### Debug Endpoints

Use the following endpoints for debugging:

- `/health` - Overall system health including security status
- `/api/security/config` - Current configuration summary
- `/api/security/dashboard` - Security monitoring dashboard
- `/api/security/metrics` - Raw metrics data

### Monitoring Dashboard

The security dashboard provides real-time visibility into:

- Security event trends
- Performance metrics
- Active threats and alerts
- System health status
- Configuration changes

Access the dashboard at `/api/security/dashboard` or integrate with your monitoring tools.

## Future Enhancements

1. **Machine Learning Integration**: Anomaly detection using ML models
2. **Advanced Threat Detection**: Integration with threat intelligence feeds
3. **Automated Response**: Automated incident response capabilities
4. **Compliance Reporting**: Automated compliance report generation
5. **Security Scoring**: Security posture scoring and recommendations

## Support

For issues or questions regarding the security configuration system:

1. Check the troubleshooting section above
2. Review the integration tests for usage examples
3. Monitor the security dashboard for system health
4. Check application logs for detailed error information
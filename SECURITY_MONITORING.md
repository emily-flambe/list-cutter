# Security Monitoring Implementation

This document describes the comprehensive security monitoring system implemented for the authentication and security layer.

## Overview

The security monitoring system provides:
- **Event Logging**: Comprehensive audit trails for all security events
- **Threat Detection**: Real-time detection of security threats and automated response
- **Performance Monitoring**: Metrics collection for authentication and API performance
- **Analytics**: Daily aggregation and reporting of security metrics
- **IP Blocking**: Automated and manual IP blocking capabilities

## Components

### 1. SecurityLogger (`/services/security/logger.ts`)

Handles comprehensive logging of all security events including:
- Authentication events (login, logout, registration, token refresh)
- Security violations (rate limits, invalid tokens, unauthorized access)
- API requests with performance metrics
- System errors and anomalies

**Key Features:**
- Dual storage: KV for recent events, D1 for long-term storage
- Automatic threat pattern detection
- Structured event logging with metadata
- Non-blocking operation to avoid impacting performance

### 2. ThreatDetector (`/services/security/threats.ts`)

Real-time threat detection with predefined rules:
- **Brute Force Detection**: Multiple failed login attempts
- **Token Manipulation**: Repeated invalid token usage
- **Account Enumeration**: Systematic username enumeration
- **Rate Limit Bypass**: Attempts to circumvent rate limiting
- **Distributed Attacks**: Coordinated attacks from multiple IPs
- **Suspicious User Agents**: Automated tools and crawlers

**Response Actions:**
- Automatic IP blocking with severity-based duration
- Security alerts and notifications
- Event logging for audit trails

### 3. MetricsCollector (`/services/security/metrics.ts`)

Performance monitoring and metrics collection:
- **Authentication Metrics**: Login/registration performance
- **API Metrics**: Response times, error rates, request counts
- **System Metrics**: Resource usage tracking
- **Active Users**: Real-time user activity tracking

**Features:**
- Time-windowed aggregation (1-minute windows)
- Percentile calculations (P95 response times)
- Error rate monitoring
- Request timing middleware

### 4. SecurityAnalyticsAggregator (`/services/security/aggregator.ts`)

Daily analytics processing and reporting:
- **Daily Aggregation**: Process events into daily summaries
- **Trend Analysis**: Identify patterns and anomalies
- **Security Summaries**: Comprehensive security overviews
- **Performance Baselines**: Establish normal operation parameters

## Database Schema

### Security Events Table
```sql
CREATE TABLE security_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  endpoint TEXT,
  method TEXT,
  success INTEGER NOT NULL,
  error_code TEXT,
  error_message TEXT,
  metadata TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);
```

### Security Analytics Table
```sql
CREATE TABLE security_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failure_count INTEGER NOT NULL,
  unique_users INTEGER,
  unique_ips INTEGER,
  avg_response_time REAL,
  created_at TEXT NOT NULL,
  UNIQUE(date, event_type)
);
```

## API Endpoints

### Analytics Endpoints

#### GET `/api/analytics/security`
Get comprehensive security analytics for a date range.

**Parameters:**
- `days` (optional): Number of days to analyze (default: 7, max: 90)
- `start_date` (optional): Start date in YYYY-MM-DD format
- `end_date` (optional): End date in YYYY-MM-DD format

#### GET `/api/analytics/security/metrics`
Get real-time security metrics and performance data.

**Parameters:**
- `minutes` (optional): Time range in minutes (default: 60, max: 1440)

#### GET `/api/analytics/security/events`
Get recent security events with filtering.

**Parameters:**
- `limit` (optional): Maximum events to return (default: 100, max: 1000)
- `offset` (optional): Pagination offset (default: 0)
- `event_type` (optional): Filter by event type
- `ip_address` (optional): Filter by IP address
- `user_id` (optional): Filter by user ID
- `hours` (optional): Hours back to search (default: 24)

#### GET `/api/analytics/security/blocked-ips`
Get currently blocked IP addresses.

**Parameters:**
- `limit` (optional): Maximum IPs to return (default: 100, max: 500)

### Management Endpoints

#### POST `/api/analytics/security/block-ip`
Manually block an IP address.

**Body:**
```json
{
  "ip_address": "192.168.1.1",
  "reason": "Manual block reason",
  "severity": "medium",
  "duration_seconds": 3600
}
```

#### POST `/api/analytics/security/unblock-ip`
Unblock an IP address.

**Body:**
```json
{
  "ip_address": "192.168.1.1",
  "reason": "Unblock reason"
}
```

#### POST `/api/analytics/security/aggregate`
Trigger manual analytics aggregation.

**Body:**
```json
{
  "date": "2024-01-15",
  "start_date": "2024-01-01",
  "end_date": "2024-01-15"
}
```

## Integration

### Middleware Integration

The security monitoring is integrated into the existing middleware stack:

1. **Security Middleware**: Enhanced with IP blocking, event logging, and threat detection
2. **Authentication Routes**: All auth routes now log events and metrics
3. **Response Middleware**: Completes request lifecycle monitoring

### Event Types

**Authentication Events:**
- `login_success` / `login_failed`
- `registration_success` / `registration_failed`
- `logout_success` / `logout_failed`
- `token_refresh_success` / `token_refresh_failed`

**Security Events:**
- `rate_limit_exceeded`
- `invalid_token`
- `unauthorized_access`
- `blocked_ip_attempt`
- `threat_detected`
- `ip_blocked_automatic` / `ip_blocked_manual`

**System Events:**
- `api_request`
- `api_error`
- `security_middleware_error`

## Configuration

### Threat Detection Rules

Rules can be customized in `/services/security/threats.ts`:

```typescript
{
  name: 'brute_force_login',
  description: 'Multiple failed login attempts from same IP',
  condition: (events) => {
    const failedLogins = events.filter(e => 
      e.event_type === 'login_failed' && 
      Date.now() - e.timestamp < 300000 // 5 minutes
    );
    return failedLogins.length >= 5;
  },
  severity: 'high',
  action: 'block'
}
```

### IP Block Durations

Block durations by severity:
- **Critical**: 24 hours (86400 seconds)
- **High**: 1 hour (3600 seconds)
- **Medium**: 15 minutes (900 seconds)
- **Low**: 5 minutes (300 seconds)

## Monitoring and Alerting

### Console Logging
All security alerts are logged to console with structured data:

```typescript
console.warn('SECURITY ALERT: brute_force_login', {
  ip_address: '192.168.1.1',
  severity: 'high',
  timestamp: '2024-01-15T10:30:00.000Z'
});
```

### Production Integration
For production deployments, integrate with:
- **Slack/Discord**: Webhook notifications for critical alerts
- **Email**: SMTP notifications for security incidents
- **PagerDuty**: Incident management for high-severity threats
- **Monitoring Systems**: Prometheus, Grafana, DataDog integration

## Performance Considerations

### Non-Blocking Operations
- All logging operations are asynchronous and non-blocking
- Monitoring failures do not impact authentication flow
- Graceful degradation on service errors

### Storage Optimization
- KV storage for recent events with TTL (30 days)
- D1 database for long-term analytics and reporting
- Automatic cleanup of expired data

### Rate Limiting
- Metrics collection uses 1-minute windows to prevent excessive KV writes
- Event batching for high-volume scenarios
- Configurable retention periods

## Security Best Practices

### Data Privacy
- No sensitive data (passwords, tokens) stored in logs
- IP addresses and user agents for security purposes only
- Configurable data retention periods

### Access Control
- All analytics endpoints require authentication
- Role-based access control for security management
- Audit logging for administrative actions

### Incident Response
- Automated threat response with manual override capability
- Comprehensive audit trails for forensic analysis
- Real-time alerting for critical security events

## Development and Testing

### Local Development
```bash
# Trigger daily aggregation
curl -X POST http://localhost:8787/api/analytics/security/aggregate \
  -H "Authorization: Bearer <token>"

# Check security metrics
curl -X GET http://localhost:8787/api/analytics/security/metrics \
  -H "Authorization: Bearer <token>"
```

### Testing Scenarios
- Simulate brute force attacks for testing detection
- Test rate limiting and IP blocking functionality
- Verify analytics aggregation and reporting
- Validate error handling and graceful degradation

## Future Enhancements

### Planned Features
1. **Machine Learning**: Anomaly detection using ML models
2. **Geolocation**: IP geolocation for attack analysis
3. **Reputation**: IP reputation scoring and blacklists
4. **Behavioral Analysis**: User behavior anomaly detection
5. **Advanced Reporting**: Custom dashboards and reports

### Integration Opportunities
1. **SIEM Integration**: Security Information and Event Management
2. **Threat Intelligence**: External threat feeds integration
3. **Compliance**: SOC 2, GDPR compliance features
4. **Mobile Security**: Mobile-specific threat detection
5. **API Security**: Advanced API security monitoring

This security monitoring implementation provides a robust foundation for authentication security with comprehensive logging, threat detection, and analytics capabilities.
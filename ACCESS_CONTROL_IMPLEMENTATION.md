# File Access Control and Permissions System Implementation

## Overview

This document outlines the comprehensive file access control and permissions system implemented for R2 operations. The system provides enterprise-grade security with role-based access control, secure file sharing, and comprehensive audit logging.

## Architecture

### Core Components

1. **Access Control Service** (`/src/services/security/access-control.ts`)
   - File ownership validation
   - Permission checking and enforcement
   - Role-based access control management

2. **File Sharing Service** (`/src/services/security/file-sharing.ts`)
   - Time-limited token generation
   - Secure token validation
   - Share management and revocation

3. **File Auth Middleware** (`/src/middleware/file-auth.ts`)
   - Request-level permission validation
   - Authentication and authorization
   - Rate limiting and security headers

4. **Secure R2 Service** (`/src/services/storage/secure-r2-service.ts`)
   - Access-controlled R2 operations
   - Integration with permission system
   - Enhanced security for storage operations

5. **Audit Logger** (`/src/services/security/audit-logger.ts`)
   - Comprehensive access logging
   - Security incident detection
   - Compliance reporting

## Permission System

### File Roles

- **OWNER**: Full control (read, write, delete, share, admin)
- **EDITOR**: Read, write, and share permissions
- **VIEWER**: Read-only access
- **NONE**: No access (default)

### File Operations

- **READ**: View file content
- **WRITE**: Modify file content
- **DELETE**: Remove file (owner only)
- **SHARE**: Create share tokens
- **ADMIN**: Manage permissions and settings

### Role Hierarchy

```
OWNER > EDITOR > VIEWER > NONE
```

Each role inherits permissions from lower roles and adds additional capabilities.

## Security Features

### 1. File Ownership Validation

- Every file operation validates ownership or permissions
- Database-backed permission tracking
- Expiring permission grants supported

### 2. Secure File Sharing

- Time-limited access tokens
- Operation-specific permissions
- IP whitelisting support
- Usage tracking and limits

### 3. Comprehensive Audit Logging

- All access attempts logged
- Security incident detection
- Real-time monitoring integration
- Compliance export capabilities

### 4. Rate Limiting

- Per-user and per-IP rate limits
- Operation-specific limiting
- Automatic blocking for abuse

### 5. Security Monitoring

- Suspicious activity detection
- Automated incident response
- Security alert system
- Real-time dashboard

## Database Schema

### Core Tables

1. **file_permissions**: Role-based access control
2. **file_share_tokens**: Secure sharing tokens
3. **file_visibility**: Public/private settings
4. **file_access_audit**: Comprehensive access log
5. **security_policies**: Configurable security settings

### Monitoring Tables

1. **security_incidents**: Security event tracking
2. **security_alerts**: Active security notifications
3. **ip_reputation**: IP address scoring
4. **user_behavior_analytics**: Anomaly detection
5. **security_actions_log**: Automated responses

## Implementation Files

### TypeScript Types
- `/src/types/permissions.ts` - Complete type definitions

### Core Services
- `/src/services/security/access-control.ts` - Access control logic
- `/src/services/security/file-sharing.ts` - Share token management
- `/src/services/security/audit-logger.ts` - Audit and monitoring
- `/src/services/storage/secure-r2-service.ts` - Secure R2 wrapper

### Middleware
- `/src/middleware/file-auth.ts` - Authentication middleware

### Database Migrations
- `/migrations/0003_access_control_schema.sql` - Permissions tables
- `/migrations/0004_security_incidents_schema.sql` - Security monitoring

### Tests
- `/tests/access-control.test.ts` - Comprehensive test suite

## Usage Examples

### Basic File Access Check

```typescript
import { fileAuth, FileOperation } from './middleware/file-auth';

// Protect file read endpoint
app.get('/files/:fileId/download', 
  fileAuth({ operation: FileOperation.READ }),
  async (c) => {
    const fileAuth = getFileAuthContext(c);
    // File access validated, proceed with download
  }
);
```

### Permission Grant

```typescript
const accessControl = new AccessControlService(db);

await accessControl.grantPermission(ownerId, {
  fileId: 'file-123',
  userId: 'user-456',
  role: FileRole.EDITOR,
  permissions: [FileOperation.READ, FileOperation.WRITE],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
});
```

### Share Token Creation

```typescript
const sharingService = new FileSharingService(db, kv);

const shareResponse = await sharingService.createShareToken(userId, {
  fileId: 'file-123',
  permissions: [FileOperation.READ],
  expiresIn: 3600, // 1 hour
  maxUses: 10,
  description: 'Quarterly report access'
});
```

### Secure File Operations

```typescript
const secureR2 = new SecureR2StorageService(bucket, db);

// Upload with access control
const result = await secureR2.uploadFile(fileData, {
  userId: 'user-123',
  fileId: 'file-456',
  fileName: 'document.pdf',
  contentType: 'application/pdf',
  requestContext: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    requestId: 'req-123'
  }
});
```

## Security Policies

### Default Configuration

```typescript
const securityPolicy = {
  maxTokenLifetime: 7 * 24 * 60 * 60, // 7 days
  maxSharesPerFile: 100,
  allowPublicSharing: true,
  requireOwnershipForDelete: true,
  requireOwnershipForShare: false,
  auditAllOperations: true,
  ipWhitelistEnabled: false,
  rateLimitEnabled: true
};
```

### Rate Limits

- **File Read**: 1000 requests/hour per user
- **File Write**: 100 requests/hour per user
- **Share Creation**: 10 requests/hour per user
- **Failed Auth**: 10 attempts/5 minutes (auto-block)

## Performance Considerations

### Optimization Features

1. **KV Store Caching**: Share tokens cached for fast validation
2. **Batch Operations**: Bulk permission checks supported
3. **Database Indexing**: Optimized queries for common operations
4. **Audit Batching**: Efficient log aggregation

### Performance Targets

- **Permission Check**: <75ms per operation
- **Share Token Validation**: <50ms per token
- **Audit Logging**: <25ms per event
- **Database Queries**: <100ms for complex operations

## Monitoring and Alerting

### Security Dashboards

- Active security alerts view
- File access analytics
- User behavior monitoring
- System health metrics

### Automated Responses

- IP blocking for abuse patterns
- Token revocation for suspicious activity
- User suspension for security violations
- File quarantine for integrity issues

## Compliance Features

### Audit Trail

- Complete access history
- Permission change tracking
- Share activity logging
- Security incident records

### Data Export

- Compliance report generation
- Audit log export (JSON/CSV)
- User activity summaries
- Security incident reports

## Error Handling

### Custom Error Types

- `AccessControlError`: Base access control errors
- `InsufficientPermissionsError`: Permission denied
- `FileNotFoundError`: File access errors
- `InvalidShareTokenError`: Token validation errors
- `ShareTokenExpiredError`: Expired token errors

### Graceful Degradation

- Fallback to database on KV failures
- Read-only mode for maintenance
- Circuit breaker patterns
- Retry mechanisms with backoff

## Future Enhancements

### Planned Features

1. **Advanced Analytics**: ML-based anomaly detection
2. **Integration APIs**: Third-party security tools
3. **Mobile Support**: Native app authentication
4. **Federated Access**: SSO integration
5. **Blockchain Audit**: Immutable audit trail

### Scalability Improvements

1. **Distributed Caching**: Multi-region KV stores
2. **Event Streaming**: Real-time security events
3. **Microservice Split**: Dedicated security services
4. **Edge Computing**: Regional permission caching

## Support and Maintenance

### Regular Tasks

- Audit log cleanup (automated)
- Performance monitoring
- Security policy updates
- Incident response procedures

### Troubleshooting

- Permission debugging tools
- Audit trail analysis
- Performance profiling
- Security incident investigation

## Conclusion

This comprehensive access control system provides enterprise-grade security for file operations while maintaining high performance and usability. The modular design allows for easy extension and customization based on specific requirements.

For questions or support, refer to the test suite and documentation within each service file.
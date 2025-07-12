# Cutty Authentication & File Management System

A comprehensive authentication, security, and file management system built on Cloudflare Workers, featuring JWT-based authentication, API key management, security monitoring, and CSV file processing capabilities.

## 🔥 Features

### 🔐 Authentication & Security
- **JWT Authentication**: Secure token-based authentication with access/refresh tokens
- **Token Rotation**: Automatic refresh token rotation for enhanced security
- **API Key Management**: Programmatic access with granular permissions
- **Password Security**: Django-compatible PBKDF2 password hashing (600,000 iterations)
- **Security Monitoring**: Real-time threat detection and security analytics
- **Rate Limiting**: Comprehensive rate limiting with IP and user-based controls
- **Token Blacklisting**: Immediate token invalidation on logout or security events

### 📁 File Management
- **CSV Processing**: Upload, filter, and process CSV files
- **File Lineage**: Track file relationships and transformations
- **R2 Storage**: Secure file storage with Cloudflare R2
- **Metadata Management**: Rich file metadata and tagging system
- **Access Control**: User-based file access permissions

### 🛡️ Security Features
- **Brute Force Protection**: Automatic detection and blocking
- **Account Enumeration Prevention**: Consistent response timing
- **IP Blocking**: Automatic and manual IP blocking capabilities
- **Security Event Logging**: Comprehensive audit trail
- **Threat Intelligence**: Real-time threat detection and response

## 🏗️ Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   React Frontend    │    │   Cloudflare        │    │   Cloudflare        │
│                     │    │   Workers API       │    │   Services          │
│ • Authentication    │◄──►│                     │◄──►│                     │
│ • File Management   │    │ • JWT Auth          │    │ • D1 Database       │
│ • API Key Mgmt      │    │ • API Keys          │    │ • Workers KV        │
│ • Security Console  │    │ • File Processing   │    │ • R2 Storage        │
│                     │    │ • Security Monitor  │    │ • Rate Limiting     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers access
- Wrangler CLI installed: `npm install -g wrangler`

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/cutty.git
cd cutty/workers

# Install dependencies
npm install

# Authenticate with Cloudflare
wrangler login

# Create required Cloudflare resources
npm run setup:resources
```

### Environment Setup

```bash
# Create KV namespaces
wrangler kv:namespace create "AUTH_KV"
wrangler kv:namespace create "AUTH_KV" --preview  # For dev environment

# Create D1 database
wrangler d1 create cutty-db

# Deploy database schema
wrangler d1 execute cutty-db --file=schema.sql

# Set required secrets
wrangler secret put JWT_SECRET          # 256-bit secret key
wrangler secret put ENCRYPTION_KEY      # Encryption key for sensitive data
wrangler secret put API_KEY_SALT       # Salt for API key hashing
```

### Configuration

Update `wrangler.toml` with your resource IDs:

```toml
name = "cutty"
main = "src/index.ts"
compatibility_date = "2024-12-30"

# Replace with your actual IDs
[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "cutty-db"
database_id = "your-database-id"

[vars]
ENVIRONMENT = "development"
MAX_FILE_SIZE = "10485760"  # 10MB
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
```

## 📖 API Documentation

### Interactive Documentation
- **Production**: https://cutty.emilycogsdill.com/docs
- **Development**: http://localhost:8787/docs

### Quick API Reference

#### Authentication Endpoints
```bash
# Register new user
POST /api/accounts/register
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "password2": "SecurePassword123!"
}

# User login
POST /api/accounts/login
{
  "username": "newuser",
  "password": "SecurePassword123!"
}

# Refresh token
POST /api/accounts/token/refresh
{
  "refresh_token": "your-refresh-token"
}

# Get user info
GET /api/accounts/user
Authorization: Bearer your-access-token
```

#### API Key Management
```bash
# Create API key
POST /api/api-keys
Authorization: Bearer your-access-token
{
  "name": "Mobile App Key",
  "permissions": ["files:read", "files:write"],
  "expires_in_days": 90
}

# List API keys
GET /api/api-keys
Authorization: Bearer your-access-token

# Get API key usage
GET /api/api-keys/{keyId}/usage
Authorization: Bearer your-access-token
```

## 🔑 Authentication Methods

### 1. JWT Tokens (User Sessions)
```bash
# Include in Authorization header
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Token lifespan
Access Token:  10 minutes
Refresh Token: 1 day
```

### 2. API Keys (Programmatic Access)
```bash
# Include in Authorization header
Authorization: Bearer cutty_YWJjZGVmZ2hpams123456789012345678

# Features
- Custom permissions
- Rate limiting (1-10,000 req/min)
- Usage tracking
- Expiration dates
```

## 🛡️ Security Features

### Password Security
- **Hashing**: PBKDF2 with 600,000 iterations
- **Format**: Django-compatible password format
- **Validation**: Strong password requirements
- **Protection**: Constant-time comparison

### Token Security
- **Short-lived Access Tokens**: 10-minute expiration
- **Token Rotation**: Refresh tokens rotated on use
- **Blacklisting**: Immediate token invalidation
- **Secure Storage**: Tokens stored in Workers KV with TTL

### Rate Limiting
- **IP-based**: 100 requests/minute per IP
- **User-based**: 60 requests/minute per authenticated user
- **API Key**: Custom limits (1-10,000 requests/minute)
- **Progressive**: Increasing delays for repeated violations

### Threat Detection
- **Brute Force**: Automatic detection and blocking
- **Account Enumeration**: Prevention mechanisms
- **Token Manipulation**: Detection and alerting
- **IP Reputation**: Automatic blocking of malicious IPs

## 📊 Monitoring & Analytics

### Security Analytics
```bash
# Get security metrics
GET /api/analytics/security/metrics
Authorization: Bearer your-token

# Get security events
GET /api/analytics/security/events
Authorization: Bearer your-token

# Get blocked IPs
GET /api/analytics/security/blocked-ips
Authorization: Bearer your-token
```

### Health Checks
```bash
# Basic health check
GET /health

# Authentication system health
GET /health/auth
```

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_login INTEGER
);
```

### API Keys Table
```sql
CREATE TABLE api_keys (
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

### Security Events Table
```sql
CREATE TABLE security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    user_id INTEGER,
    ip_address TEXT,
    success INTEGER NOT NULL,
    metadata TEXT
);
```

## 🚀 Deployment

### Staging Deployment
```bash
npm run deploy:staging
```

### Production Deployment
```bash
# Run tests first
npm test

# Deploy to production
npm run deploy:production

# Verify deployment
curl https://cutty.emilycogsdill.com/health
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | 256-bit secret for JWT signing |
| `ENCRYPTION_KEY` | Yes | Key for encrypting sensitive data |
| `API_KEY_SALT` | Yes | Salt for API key hashing |
| `ENVIRONMENT` | No | Environment name (dev/staging/prod) |
| `MAX_FILE_SIZE` | No | Maximum file upload size in bytes |

### Rollback Procedure
```bash
# List recent deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback [deployment-id]
```

## 🔧 Development

### Project Structure
```
src/
├── index.ts                 # Main worker entry point
├── types/                   # TypeScript type definitions
├── middleware/              # Authentication and security middleware
│   ├── auth.ts             # JWT authentication middleware
│   ├── apiKeyAuth.ts       # API key authentication
│   ├── security.ts         # Security headers and monitoring
│   └── cors.ts             # CORS handling
├── services/               # Business logic services
│   ├── auth/               # Authentication services
│   │   ├── jwt.ts          # JWT token management
│   │   ├── apiKeys.ts      # API key management
│   │   └── password.ts     # Password utilities
│   ├── security/           # Security services
│   │   ├── logger.ts       # Security event logging
│   │   ├── metrics.ts      # Security metrics collection
│   │   └── threats.ts      # Threat detection
│   └── storage/            # Data access layer
│       ├── d1.ts           # D1 database operations
│       └── r2.ts           # R2 storage operations
├── routes/                 # API route handlers
│   ├── accounts/           # User account routes
│   ├── api-keys/           # API key management routes
│   ├── analytics/          # Security analytics routes
│   ├── list_cutter/        # File processing routes
│   └── docs/               # API documentation routes
└── utils/                  # Utility functions
```

### Code Standards

#### TypeScript
- Use strict TypeScript configuration
- Define interfaces for all data structures
- Use enums for constants
- Add JSDoc comments for public APIs

#### Error Handling
- Use consistent error response format
- Log errors with appropriate context
- Handle edge cases gracefully
- Provide meaningful error messages

#### Security
- Never log sensitive data (passwords, tokens, API keys)
- Validate all inputs at API boundaries
- Use parameterized queries for database operations
- Implement proper rate limiting for all endpoints

### Testing

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

## 📋 Troubleshooting

### Common Issues

#### Authentication Errors
```bash
# Check JWT secret
wrangler secret list | grep JWT_SECRET

# Verify token format
curl -H "Authorization: Bearer your-token" \
     https://cutty.emilycogsdill.com/api/accounts/user
```

#### Database Connection Issues
```bash
# Test database connectivity
wrangler d1 execute cutty-db --command="SELECT 1"

# Check database schema
wrangler d1 execute cutty-db --command="PRAGMA table_info(users)"
```

#### Rate Limiting Problems
```bash
# Check current rate limits
curl -I https://cutty.emilycogsdill.com/api/accounts/login

# Reset IP blocks (admin only)
curl -X POST https://cutty.emilycogsdill.com/api/analytics/security/unblock-ip \
     -H "Authorization: Bearer admin-token" \
     -d '{"ip_address": "192.168.1.1"}'
```

For more detailed troubleshooting, see [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Add JSDoc comments for public APIs
- Write comprehensive tests
- Update documentation for new features
- Follow security best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: https://cutty.emilycogsdill.com/docs
- **GitHub Issues**: https://github.com/your-org/cutty/issues
- **Security Issues**: security@cutty.emilycogsdill.com

## 🙏 Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Powered by [Cloudflare D1](https://developers.cloudflare.com/d1/)
- File storage via [Cloudflare R2](https://developers.cloudflare.com/r2/)
- JWT handling with [jose](https://github.com/panva/jose)

---

**Cutty Authentication System v1.0.0** - Production-ready authentication and file management for modern web applications.
# Cutty - List Cutter Application

> **Note:** While the GitHub repository is named "list-cutter", the preferred identity for all Cloudflare deployments and resources is "cutty".

A comprehensive CSV processing application with Django backend and React frontend, built for high performance and security.

## 🚀 Current Status: Phase 7 - Testing & Optimization

The application is currently in Phase 7, featuring comprehensive testing infrastructure, performance optimization, and security hardening.

### Key Features
- **Secure Authentication**: JWT-based auth with API key support
- **File Processing**: CSV cutting and processing with streaming support
- **Performance Optimization**: Multi-layer caching and performance monitoring
- **Security**: Comprehensive security middleware and threat detection
- **Testing**: 90%+ test coverage with E2E, unit, integration, and security tests
- **Monitoring**: Real-time metrics, alerting, and health monitoring

## 🏗️ Architecture

### Cloudflare Workers Backend
- **Location**: `cloudflare/workers/`
- **Framework**: Hono.js with TypeScript
- **Testing**: Vitest + Playwright E2E tests
- **Security**: Multi-layer security middleware
- **Performance**: Unified caching middleware with adaptive optimization

### Django API (Legacy/Migration)
- **Location**: `app/`
- **Purpose**: Original backend being migrated to Cloudflare Workers
- **Framework**: Django REST Framework

### React Frontend
- **Location**: `app/frontend/`
- **Framework**: React + Vite
- **Features**: File upload, processing, user management

## 🛠️ Development Setup

### Quick Start
```bash
# Start the full development environment
make build
make up
```

### Cloudflare Workers Development
```bash
cd cloudflare/workers

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm run test:performance

# Run security tests
npm test tests/security/

# Run E2E tests
npm run test:e2e
```

## 🌐 Production Deployment

The application is deployed on Cloudflare's edge network:

👉 **Production**: https://cutty.emilyflam.be 👈

## CSV List Cutter BASIC (No account needed)

After uploading a CSV, select the columns to keep.

Columns can be filtered using SQL-like conditions, for example:

- `<= 20`
- `!= "NY"`
- `BETWEEN 50 AND 100`
- `IN ('Alice', 'Bob')`

The list cutter applies these conditions while streaming the CSV into a new CSV, which you can download.

## CSV List Cutter PRO (Account needed)

If you create an account and log in, you can save files in your own personal file manager, including files you cut from other files!

## 🧪 Testing Framework

### Coverage Targets
- **Lines**: 90%
- **Functions**: 90%
- **Branches**: 85%
- **Statements**: 90%

### Test Categories
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Service interaction testing
3. **Security Tests**: Authentication, authorization, and threat detection
4. **Performance Tests**: Load testing and performance benchmarks
5. **E2E Tests**: Complete user journey testing with Playwright

### Running Specific Tests
```bash
# Authentication tests
npm run test:auth

# Security tests
npm test tests/security/

# Performance benchmarks
npm run test:benchmark

# E2E with UI
npm run test:e2e:ui
```

## 🔒 Security Features

- **Multi-layer Authentication**: JWT tokens + API keys
- **Threat Detection**: Real-time security monitoring
- **File Validation**: Comprehensive upload validation
- **Rate Limiting**: Intelligent rate limiting with bypass detection
- **Security Headers**: Complete security header implementation
- **Audit Logging**: Comprehensive security event logging

## 📊 Performance Features

- **Unified Caching**: Multi-layer caching with adaptive optimization
- **Performance Monitoring**: Real-time performance metrics
- **Compression**: Intelligent response compression
- **Edge Optimization**: Cloudflare edge network utilization
- **Database Optimization**: Query optimization and connection pooling

## 🔧 Development Tools

- **TypeScript**: Full type safety
- **ESLint**: Code quality enforcement
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality checks
- **Vitest**: Fast unit testing
- **Playwright**: E2E testing framework

## ⏰ Scheduled Tasks & Cron Triggers

The application uses Cloudflare Workers cron triggers for automated maintenance and monitoring:

### Priority Cron Triggers (Top 5)

| Schedule | Purpose | Endpoint |
|----------|---------|----------|
| `*/5 * * * *` | **Metrics & Alerts** | `/api/monitoring/collect-metrics`<br/>`/api/alerts/jobs/evaluate`<br/>`/api/disaster-recovery/auto-recovery-check` |
| `*/1 * * * *` | **Security Monitoring** | `/api/monitoring/check-alerts` |
| `0 2 * * *` | **Daily Backup & Maintenance** | `/api/backup/daily`<br/>`/api/monitoring/generate-daily-report`<br/>`/api/alerts/jobs/cleanup` |
| `0 6 * * *` | **Storage & Data Cleanup** | `/api/data-export/scheduled-cleanup` |
| `0 */6 * * *` | **Cost Calculation** | `/api/monitoring/calculate-costs` |

### Deploy Cron Triggers

```bash
cd cloudflare/workers

# Deploy all priority cron triggers
wrangler triggers deploy --cron "*/5 * * * *"  # Metrics & alerts every 5 min
wrangler triggers deploy --cron "*/1 * * * *"  # Security monitoring every minute  
wrangler triggers deploy --cron "0 2 * * *"    # Daily backup at 2 AM
wrangler triggers deploy --cron "0 6 * * *"    # Storage cleanup at 6 AM
wrangler triggers deploy --cron "0 */6 * * *"  # Cost calculation every 6 hours

# Verify deployment
wrangler triggers list
```

### What Each Trigger Does

- **Every 5 minutes**: Rotates between metrics collection, alert evaluation, and auto-recovery checks for system health
- **Every minute**: Monitors security events, system thresholds, and triggers immediate response actions
- **Daily 2 AM**: Creates comprehensive backups, generates operational reports, cleans up old alert data
- **Daily 6 AM**: Removes expired exports from R2 storage, manages quotas, cleans temporary files
- **Every 6 hours**: Calculates R2 storage costs, updates billing metrics, tracks usage trends

### Additional Cron Triggers

| Schedule | Purpose | Description |
|----------|---------|-------------|
| `*/15 * * * *` | Notification Retry | Retries failed alert notifications |
| `*/10 * * * *` | Alert Health Check | Monitors alerting system health |
| `0 3 * * 0` | Weekly Backup | Comprehensive weekly backups |
| `0 4 1 * *` | Monthly Backup | Long-term archive backups |
| `0 5 * * 0` | Metrics Cleanup | Removes old metrics data |

## 📚 Documentation

- [Quick Start Guide](cloudflare/workers/QUICK-START.md)
- [Security Configuration](cloudflare/workers/SECURITY_CONFIGURATION.md)
- [Performance Optimization](cloudflare/workers/CACHING_PERFORMANCE_README.md)
- [Testing Documentation](cloudflare/workers/tests/README.md)
- [E2E Testing](cloudflare/workers/e2e/README.md)
- [Deployment Guide](cloudflare/workers/DEPLOYMENT.md)

## 🚀 Phase Progression

- ✅ **Phase 1**: Environment Setup
- ✅ **Phase 2**: Frontend Migration
- ✅ **Phase 3**: Backend Migration
- ✅ **Phase 4**: Database Migration
- ✅ **Phase 5**: R2 Storage Integration
- ✅ **Phase 5.5**: Production Infrastructure
- ✅ **Phase 6**: Authentication & Security
- 🚧 **Phase 7**: Testing & Optimization (Current)
- 📋 **Phase 8**: Deployment & Cutover
- 📋 **Phase 9**: Cleanup & Documentation

## 🤝 Contributing

This project follows a structured development approach with comprehensive testing and security requirements. All contributions should:

1. Include appropriate tests (unit, integration, security)
2. Meet the 90% coverage threshold
3. Pass all security checks
4. Follow the established code style
5. Include documentation updates

## 📄 License

This project is available under the [LICENSE](LICENSE) terms.

---

*This application represents a complete migration from traditional hosting to Cloudflare's edge computing platform, showcasing modern web application architecture with emphasis on performance, security, and maintainability.*
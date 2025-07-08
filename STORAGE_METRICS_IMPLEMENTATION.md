# Storage Metrics and Cost Tracking Implementation

## Overview

This implementation provides a comprehensive storage metrics table and aggregation system for R2 monitoring, designed to track storage usage, calculate costs accurately, and provide detailed analytics for the Cutty application.

## Implementation Summary

### ✅ Completed Components

1. **Database Schema** (`/migrations/0003_storage_metrics.sql`)
   - Storage metrics table with proper indexing
   - R2 pricing tiers configuration
   - Daily storage snapshots for billing
   - Monthly billing summaries
   - User storage quotas and limits
   - Comprehensive views for common queries

2. **Cost Calculation Engine** (`/src/services/monitoring/cost-calculator.ts`)
   - Accurate R2 cost calculation based on Cloudflare pricing
   - Free tier tracking and management
   - Tiered pricing support (Standard/Infrequent Access)
   - Daily cost snapshots and monthly billing

3. **Aggregation Services** (`/src/services/monitoring/aggregation-service.ts`)
   - Daily, weekly, and monthly metric rollups
   - Efficient batch processing for multiple users
   - Error categorization and tracking
   - Data retention and cleanup policies

4. **Query Optimization** (`/src/services/monitoring/query-service.ts`)
   - Cached dashboard endpoints (5-minute cache)
   - Optimized historical data retrieval
   - User storage overviews and cost breakdowns
   - System-wide analytics and error tracking

5. **Scheduled Jobs** (`/src/services/monitoring/scheduler.ts`)
   - Automated daily aggregation (2 AM UTC)
   - Daily storage snapshots (1 AM UTC)
   - Weekly/monthly rollups with proper scheduling
   - Health monitoring and cleanup jobs

6. **Enhanced API Integration** (`/src/services/monitoring/enhanced-metrics-service.ts`)
   - Unified interface for all monitoring components
   - Real-time operation recording with cost tracking
   - User and admin dashboard data
   - Quota management and violation detection

7. **REST API Endpoints** (`/src/routes/metrics.ts`)
   - User dashboard and analytics endpoints
   - Admin system overview and management
   - Cost estimation and quota management
   - Scheduled job execution handlers

## Key Features

### 📊 Comprehensive Metrics Tracking

- **Storage Usage**: Track bytes by storage class and user
- **Operation Counts**: Class A/B request tracking with costs
- **Data Transfer**: Ingress/egress bandwidth monitoring
- **Performance**: Response times, throughput, and error rates
- **Cost Accuracy**: Real-time cost calculation with free tier support

### 💰 Accurate Cost Calculation

- **Tiered Pricing**: Cloudflare R2 pricing model implementation
- **Free Tier Management**: 10GB storage, 1M Class A, 10M Class B requests
- **Daily Precision**: Daily snapshots for accurate monthly billing
- **Multiple Storage Classes**: Standard ($0.015/GB) and IA ($0.01/GB)
- **Transfer Costs**: $0.09/GB egress after 10GB free tier

### 🔄 Automated Aggregation

- **Daily Aggregation**: 2 AM UTC - Process previous day's metrics
- **Weekly Rollups**: Monday 3 AM UTC - Weekly summaries
- **Monthly Billing**: 1st of month 4 AM UTC - Generate billing data
- **Data Cleanup**: Sunday 5 AM UTC - Remove old raw metrics
- **Health Monitoring**: Every 5 minutes - System status checks

### 🚀 Performance Optimization

- **Efficient Indexing**: Multi-column indexes for fast queries
- **Query Caching**: 5-minute cache for dashboard endpoints
- **Batch Processing**: Parallel aggregation for scalability
- **Data Partitioning**: User and date-based optimization
- **Retention Policies**: 30-day raw, 365-day aggregated retention

## Database Schema Details

### Core Tables

1. **storage_metrics**: Primary metrics with aggregation levels
2. **r2_pricing_tiers**: Configurable pricing with effective dates
3. **daily_storage_snapshots**: Accurate daily usage for billing
4. **monthly_billing_summary**: Pre-calculated monthly costs
5. **user_storage_quotas**: Per-user limits and quota types

### Key Indexes

- `idx_storage_metrics_user_date`: Fast user-specific queries
- `idx_storage_metrics_type`: Efficient metric type filtering
- `idx_daily_snapshots_user_date`: Optimized snapshot retrieval
- `idx_monthly_billing_month`: Quick billing period access

## API Endpoints

### User Endpoints

```bash
GET /api/metrics/dashboard          # Complete user dashboard
GET /api/metrics/history           # Historical storage metrics  
GET /api/metrics/costs             # Cost breakdown and trends
POST /api/metrics/estimate         # Cost estimation for operations
GET /api/metrics/quota             # Current quota status
PUT /api/metrics/quota             # Update quota settings
```

### Admin Endpoints

```bash
GET /api/metrics/admin/dashboard    # System-wide overview
GET /api/metrics/admin/system-overview  # System statistics
POST /api/metrics/aggregation      # Manual aggregation trigger
DELETE /api/metrics/cache          # Cache management
```

### Scheduled Jobs

```bash
POST /api/metrics/jobs/daily-aggregation    # Daily metric rollups
POST /api/metrics/jobs/update-daily-snapshots  # Storage snapshots
POST /api/metrics/jobs/weekly-aggregation   # Weekly summaries
POST /api/metrics/jobs/monthly-aggregation  # Monthly billing
POST /api/metrics/jobs/cleanup-old-metrics  # Data cleanup
POST /api/metrics/jobs/health-check        # System monitoring
```

## Usage Examples

### Recording Storage Operations

```typescript
// Automatic recording via middleware
const middleware = createMetricsMiddleware(metricsService);
await middleware('upload_single', fileId, userId, fileName, fileSize, contentType)
  .execute(async () => {
    return await r2.put(key, data);
  });
```

### Cost Estimation

```typescript
const estimation = await metricsService.estimateOperationCost(
  userId,
  'upload_single',
  5242880,  // 5MB file
  'Standard'
);
console.log(`Cost: $${estimation.estimatedCost}`);
```

### Dashboard Data

```typescript
const dashboard = await metricsService.getUserDashboard(userId);
console.log('Storage:', dashboard.overview.storage);
console.log('Monthly cost:', dashboard.costs.currentMonthCost);
```

## Deployment Instructions

### 1. Database Migration

```bash
cd cloudflare/workers
npx wrangler d1 migrations apply --remote
```

### 2. Analytics Engine Setup

```bash
npx wrangler analytics-engine create cutty_metrics
```

Update `wrangler.toml`:
```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "cutty_metrics"
```

### 3. Deploy with Cron Triggers

```bash
npx wrangler deploy
```

The cron triggers are automatically configured in `wrangler.toml`.

### 4. Verify Setup

```bash
# Check tables
npx wrangler d1 execute DB --command "SELECT name FROM sqlite_master WHERE type='table';"

# Check pricing data
npx wrangler d1 execute DB --command "SELECT * FROM r2_pricing_tiers LIMIT 5;"
```

## Monitoring and Maintenance

### Health Checks

The system includes comprehensive health monitoring:
- Database connectivity
- Storage service availability  
- Metrics collection status
- Job execution success rates

### Quota Management

Automatic quota violation detection:
- Storage usage over 90%/100%
- Monthly cost limits exceeded
- High error rates (>5%)
- Performance degradation

### Data Retention

Automated cleanup policies:
- Raw metrics: 30 days
- Daily aggregations: 365 days
- Access logs: 90 days
- Pricing history: Permanent

## Cost Accuracy Features

### Free Tier Tracking

Accurate tracking of Cloudflare R2 free tier:
- 10 GB storage per month
- 1 million Class A operations
- 10 million Class B operations  
- 10 GB data transfer out

### Tiered Pricing

Support for multiple pricing tiers:
- Free tier allowances
- Standard paid tiers
- Regional pricing variations
- Time-based pricing changes

### Billing Precision

Daily snapshots ensure accurate billing:
- Point-in-time storage usage
- Accumulated operation counts
- Bandwidth utilization tracking
- Cost calculations with proper proration

## Security Considerations

- **User Isolation**: All queries filter by user ID
- **Admin Controls**: System-wide access restricted to admins
- **Input Validation**: All parameters validated and sanitized
- **Rate Limiting**: Expensive operations are rate limited
- **Audit Logging**: All quota changes are logged

## Performance Benchmarks

Expected query performance:
- User dashboard: <200ms
- Historical data (30 days): <500ms  
- Cost breakdown: <300ms
- System overview: <1000ms
- Aggregation jobs: <5 minutes per 1000 users

## Future Enhancements

Potential improvements:
- Real-time cost alerts via webhooks
- Custom pricing tiers for enterprise users
- Advanced analytics with machine learning
- Integration with billing systems
- Multi-region cost tracking
- Predictive cost modeling

## Support and Troubleshooting

### Common Issues

1. **Missing Metrics**: Check Analytics Engine configuration
2. **Incorrect Costs**: Verify pricing tier data is current
3. **Slow Queries**: Review index usage and query patterns
4. **Job Failures**: Check execution logs and retry mechanisms

### Debug Tools

```typescript
// Check job status
const stats = await scheduler.getJobStatistics(7);

// Verify cost calculation  
const cost = await costCalculator.calculateDailyStorageCost(userId);

// Test query performance
const start = Date.now();
const data = await queryService.getUserStorageOverview(userId);
console.log(`Query time: ${Date.now() - start}ms`);
```

This implementation provides a production-ready storage metrics and cost tracking system that scales with your user base while maintaining accuracy and performance.
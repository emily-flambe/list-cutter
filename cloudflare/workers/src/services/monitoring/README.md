# Storage Metrics and Cost Tracking System

This directory contains a comprehensive storage metrics and cost tracking system for R2 monitoring, designed to provide real-time insights into storage usage, costs, and performance.

## Architecture Overview

The system consists of several interconnected services:

- **MetricsService**: Core metrics collection with Analytics Engine integration
- **CostCalculator**: R2 cost calculation based on Cloudflare pricing tiers
- **AggregationService**: Daily, weekly, and monthly metric rollups
- **QueryService**: Optimized data retrieval with caching
- **Scheduler**: Automated job execution and monitoring
- **EnhancedMetricsService**: Unified interface for all monitoring components

## Database Schema

### Core Tables

1. **storage_metrics**: Primary metrics storage with aggregation support
2. **r2_pricing_tiers**: Cloudflare R2 pricing configuration
3. **daily_storage_snapshots**: Daily usage snapshots for accurate billing
4. **monthly_billing_summary**: Aggregated billing data
5. **user_storage_quotas**: Per-user limits and quotas

### Key Features

- **Tiered Pricing Support**: Accurate cost calculation with free tier allowances
- **Multiple Storage Classes**: Standard and Infrequent Access pricing
- **Efficient Indexing**: Optimized queries for dashboard performance
- **Data Retention**: Automated cleanup of old metrics
- **Quota Management**: User limits and violation tracking

## Cost Calculation

### Supported Metrics

- **Storage**: Per-GB monthly storage costs
- **Class A Operations**: PUT, COPY, POST, LIST requests
- **Class B Operations**: GET, HEAD, OPTIONS requests
- **Data Transfer Out**: Egress bandwidth costs
- **Data Transfer In**: Ingress (typically free)

### Free Tier Implementation

The system accurately tracks free tier usage:
- 10 GB storage per month
- 1 million Class A operations per month
- 10 million Class B operations per month
- 10 GB data transfer out per month

### Pricing Accuracy

Based on current Cloudflare R2 pricing (2024):
- Standard storage: $0.015/GB/month after 10GB free
- Infrequent Access: $0.01/GB/month
- Class A requests: $4.50/million after 1M free
- Class B requests: $0.36/million after 10M free
- Data transfer out: $0.09/GB after 10GB free

## Aggregation Jobs

### Scheduled Operations

1. **Daily Snapshots** (1 AM UTC): Current storage usage per user
2. **Daily Aggregation** (2 AM UTC): Metric rollups from access logs
3. **Weekly Aggregation** (Monday 3 AM UTC): Weekly summaries
4. **Monthly Aggregation** (1st 4 AM UTC): Billing calculations
5. **Cleanup** (Sunday 5 AM UTC): Remove old raw data
6. **Health Check** (Every 5 minutes): System monitoring

### Performance Optimization

- **Efficient Indexing**: Multi-column indexes for fast queries
- **Data Partitioning**: By user and date for optimal performance
- **Query Caching**: 5-minute cache for dashboard endpoints
- **Batch Processing**: Parallel aggregation for multiple users
- **Retention Policies**: Automatic cleanup of historical data

## API Endpoints

### User Endpoints

- `GET /api/metrics/dashboard` - Complete user dashboard
- `GET /api/metrics/history` - Historical storage metrics
- `GET /api/metrics/costs` - Cost breakdown and trends
- `POST /api/metrics/estimate` - Cost estimation for operations
- `GET /api/metrics/quota` - Current quota status
- `PUT /api/metrics/quota` - Update quota settings

### Admin Endpoints

- `GET /api/metrics/admin/dashboard` - System-wide overview
- `GET /api/metrics/admin/system-overview` - System statistics
- `GET /api/metrics/admin/job-statistics` - Job execution metrics
- `GET /api/metrics/admin/job-history` - Job execution history
- `POST /api/metrics/aggregation` - Manual aggregation trigger
- `DELETE /api/metrics/cache` - Cache management

### Scheduled Jobs

- `POST /api/metrics/jobs/daily-aggregation`
- `POST /api/metrics/jobs/weekly-aggregation`
- `POST /api/metrics/jobs/monthly-aggregation`
- `POST /api/metrics/jobs/update-daily-snapshots`
- `POST /api/metrics/jobs/cleanup-old-metrics`
- `POST /api/metrics/jobs/health-check`

## Usage Examples

### Recording Operations

```typescript
// Automatic recording via middleware
const middleware = createMetricsMiddleware(metricsService);
const operation = middleware.execute(async () => {
  // Your storage operation here
  return await r2.put(key, data);
});
```

### Manual Operation Recording

```typescript
await metricsService.recordOperation(
  'upload_single',      // operation type
  fileId,               // file identifier
  userId,               // user identifier
  'document.pdf',       // filename
  1048576,              // file size in bytes
  'application/pdf',    // content type
  true,                 // success status
  1500,                 // duration in ms
  undefined,            // error message
  { storageClass: 'Standard' }  // additional data
);
```

### Cost Estimation

```typescript
const estimation = await metricsService.estimateOperationCost(
  userId,
  'upload_single',
  5242880,  // 5MB file
  'Standard'
);

console.log(`Estimated cost: $${estimation.estimatedCost}`);
console.log(`Free tier used: ${estimation.freeTierUsed} bytes`);
```

### Dashboard Data

```typescript
const dashboard = await metricsService.getUserDashboard(userId);
console.log('Storage usage:', dashboard.overview.storage);
console.log('Monthly cost:', dashboard.costs.currentMonthCost);
```

## Configuration

### Environment Variables

```bash
# Metrics collection settings
ENABLE_METRICS=true
ENABLE_DETAILED_METRICS=false
SUCCESS_SAMPLING_RATE=0.1
ERROR_SAMPLING_RATE=1.0

# Retention settings
RAW_METRICS_RETENTION_DAYS=30
AGGREGATED_METRICS_RETENTION_DAYS=365

# Analytics Engine
ANALYTICS_DATASET=storage_metrics
BATCH_SIZE=50
FLUSH_INTERVAL=30000
```

### Pricing Configuration

Pricing tiers are stored in the database and can be updated:

```sql
INSERT INTO r2_pricing_tiers (
  tier_name, metric_type, storage_class,
  min_units, max_units, unit_cost_usd,
  effective_from, description
) VALUES (
  'Standard Tier', 'storage_bytes', 'Standard',
  10737418240, NULL, 0.015,
  '2024-01-01', 'Standard storage: $0.015/GB/month'
);
```

## Performance Considerations

### Query Optimization

- Use appropriate time ranges for historical queries
- Leverage aggregated data for longer time periods
- Cache frequently accessed dashboard data
- Use indexes for user-specific queries

### Cost Calculation Accuracy

- Daily snapshots ensure accurate monthly billing
- Free tier tracking prevents overcharging
- Tiered pricing calculation handles usage spikes
- Error handling for pricing tier updates

### Scalability

- Horizontal scaling via user-based partitioning
- Efficient aggregation algorithms
- Optimized database schemas
- Caching strategies for high-traffic endpoints

## Monitoring and Alerts

### System Health

The health check job monitors:
- Database connectivity
- Storage service availability
- Metrics collection status
- Job execution success rates

### Quota Violations

Automatic detection of:
- Storage quota exceeded
- Cost limits exceeded
- High error rates
- Performance degradation

### Error Tracking

Comprehensive error categorization:
- Network errors
- Permission issues
- Quota violations
- Storage limits
- Rate limiting
- Server errors

## Migration Guide

### Database Setup

1. Run the migration script:
```bash
npx wrangler d1 migrations apply --remote
```

2. Verify table creation:
```bash
npx wrangler d1 execute DB --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Analytics Engine Setup

1. Create the dataset:
```bash
npx wrangler analytics-engine create storage_metrics
```

2. Update wrangler.toml with the dataset binding

### Scheduled Jobs Setup

Cron triggers are automatically configured in wrangler.toml. Verify deployment:

```bash
npx wrangler deploy
```

## Troubleshooting

### Common Issues

1. **Missing Metrics**: Check Analytics Engine configuration
2. **Incorrect Costs**: Verify pricing tier data
3. **Slow Queries**: Review index usage and query patterns
4. **Job Failures**: Check job execution logs and retry mechanisms

### Debug Commands

```typescript
// Check aggregation status
const stats = await scheduler.getJobStatistics(7);

// Verify cost calculation
const cost = await costCalculator.calculateDailyStorageCost(userId);

// Test query performance
const start = Date.now();
const data = await queryService.getUserStorageOverview(userId);
console.log(`Query time: ${Date.now() - start}ms`);
```

## Contributing

When extending the metrics system:

1. Update database schema with proper indexes
2. Add corresponding TypeScript interfaces
3. Implement efficient aggregation logic
4. Add comprehensive error handling
5. Update API documentation
6. Add appropriate test coverage

## Security Considerations

- User data isolation in all queries
- Admin-only access to system-wide metrics
- Rate limiting on expensive operations
- Input validation for all parameters
- Secure handling of cost data
- Audit logging for quota changes
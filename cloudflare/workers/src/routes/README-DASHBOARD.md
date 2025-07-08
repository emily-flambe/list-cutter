# R2 Storage Dashboard API

This document provides comprehensive documentation for the R2 Storage Dashboard API, which offers real-time monitoring, cost tracking, and performance analytics for Cloudflare R2 storage operations.

## Overview

The Dashboard API provides specialized endpoints for both administrators and users to monitor R2 storage usage, track costs, analyze performance, and manage quotas. It's built on top of the existing metrics collection system with additional dashboard-specific functionality.

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Frontend UI       │────│ Dashboard API Routes │────│ Enhanced Metrics    │
│   (React/Vue/etc)   │    │ - Admin Endpoints    │    │ Service             │
│                     │    │ - User Endpoints     │    │                     │
└─────────────────────┘    │ - Realtime APIs      │    └─────────────────────┘
                           │ - Historical APIs    │              │
┌─────────────────────┐    │                      │    ┌─────────────────────┐
│ Authentication &    │────│                      │────│ Query Service &     │
│ Authorization       │    └──────────────────────┘    │ Aggregation Service │
└─────────────────────┘                               └─────────────────────┘
                                                                │
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│ Cache Layer &       │────│ Middleware Pipeline  │────│ D1 Database &       │
│ Rate Limiting       │    │ - Validation         │    │ Analytics Engine    │
└─────────────────────┘    │ - Caching            │    └─────────────────────┘
                           │ - Rate Limiting      │
                           └──────────────────────┘
```

## Endpoints Overview

### Admin Endpoints

All admin endpoints require admin authentication and provide system-wide metrics.

| Endpoint | Method | Description | Cache TTL |
|----------|--------|-------------|-----------|
| `/admin/metrics/storage` | GET | System-wide storage metrics and trends | 5 minutes |
| `/admin/metrics/performance` | GET | System performance analytics | 5 minutes |
| `/admin/metrics/costs` | GET | System-wide cost breakdown and trends | 5 minutes |
| `/admin/metrics/alerts` | GET | Active system alerts and notifications | 2 minutes |
| `/admin/metrics/system-health` | GET | System health indicators | 2 minutes |
| `/admin/metrics/users` | GET | User metrics overview | 5 minutes |

### User Endpoints

User endpoints provide user-specific data with proper access controls.

| Endpoint | Method | Description | Cache TTL |
|----------|--------|-------------|-----------|
| `/user/storage/usage` | GET | User storage usage dashboard | 2 minutes |
| `/user/storage/analytics` | GET | User storage analytics with insights | 2 minutes |
| `/user/storage/trends` | GET | User storage trends and projections | 5 minutes |
| `/user/storage/costs` | GET | User cost breakdown and forecasting | 2 minutes |
| `/user/storage/performance` | GET | User performance metrics | 2 minutes |
| `/user/storage/quota` | GET | User quota status and history | 2 minutes |

### Real-time Endpoints

Real-time endpoints provide live data with minimal caching for up-to-date information.

| Endpoint | Method | Description | Cache TTL |
|----------|--------|-------------|-----------|
| `/metrics/realtime/overview` | GET | Real-time system/user overview | 30 seconds |
| `/metrics/realtime/operations` | GET | Live operation metrics | 30 seconds |
| `/metrics/realtime/errors` | GET | Real-time error tracking | 30 seconds |

### Historical Data Endpoints

Historical endpoints provide time-series data with extended caching.

| Endpoint | Method | Description | Cache TTL |
|----------|--------|-------------|-----------|
| `/metrics/historical/storage` | GET | Historical storage usage data | 10 minutes |
| `/metrics/historical/costs` | GET | Historical cost data | 10 minutes |
| `/metrics/historical/performance` | GET | Historical performance data | 10 minutes |

### Management Endpoints

System management and health check endpoints.

| Endpoint | Method | Description | Cache TTL |
|----------|--------|-------------|-----------|
| `/dashboard/health` | GET | Dashboard API health check | None |
| `/dashboard/cache/clear` | POST | Clear dashboard cache (admin only) | None |
| `/dashboard/stats` | GET | Dashboard statistics | None |

## Authentication & Authorization

### Authentication
All endpoints require valid JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

### Authorization Levels
- **User**: Access to own data via `/user/*` endpoints
- **Admin**: Access to all endpoints including `/admin/*` and system-wide data

## Request Parameters

### Common Query Parameters

| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `timeRange` | string | `24hours`, `7days`, `30days`, `90days` | Time range for data |
| `granularity` | string | `hourly`, `daily`, `weekly`, `monthly` | Data aggregation level |
| `limit` | number | 1-1000 | Maximum number of results |
| `includeUsers` | boolean | `true`, `false` | Include user details (admin only) |
| `severity` | string | `low`, `medium`, `high`, `critical` | Alert severity filter |
| `sortBy` | string | `usage`, `cost`, `date` | Sort criteria |
| `userId` | string | UUID | Specific user ID (admin only) |

### Example Requests

```bash
# Get admin storage metrics for last 7 days
GET /admin/metrics/storage?timeRange=7days&includeUsers=true

# Get user cost analytics for last 30 days  
GET /user/storage/costs?timeRange=30days

# Get historical performance data with daily granularity
GET /metrics/historical/performance?timeRange=30days&granularity=daily

# Get high severity alerts only
GET /admin/metrics/alerts?severity=high&limit=20
```

## Response Format

All endpoints return JSON responses with a consistent structure:

```typescript
{
  "success": boolean,
  "data": any,           // Response data
  "error"?: string,      // Error message if success=false
  "details"?: string,    // Additional error details
  "meta": {
    "userId": string,           // Requesting user ID
    "timestamp": string,        // ISO timestamp
    "endpoint": string,         // Request endpoint
    "cached": boolean,          // Whether response was cached
    "processingTime": number    // Processing time in ms
  }
}
```

## Response Examples

### Admin Storage Metrics
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalBytes": 1073741824,
      "totalFiles": 1547,
      "totalUsers": 23,
      "totalCost": 45.67,
      "storageClasses": {
        "standard": {
          "bytes": 858993459,
          "files": 1234,
          "cost": 36.54
        },
        "infrequentAccess": {
          "bytes": 214748365,
          "files": 313,
          "cost": 9.13
        }
      },
      "growth": {
        "dailyGrowthBytes": 104857600,
        "weeklyGrowthBytes": 734003200,
        "monthlyGrowthBytes": 3145728000,
        "dailyGrowthPercentage": 10.8
      }
    },
    "storageBreakdown": [
      {
        "storage_class": "Standard",
        "total_bytes": 858993459,
        "users": 20,
        "operations": 1847
      }
    ],
    "growthTrends": [
      {
        "date": "2024-01-01",
        "total_bytes": 1073741824,
        "active_users": 23
      }
    ],
    "topUsers": [
      {
        "username": "user1",
        "email": "user1@example.com",
        "total_bytes": 214748365,
        "metrics_count": 145
      }
    ],
    "timeRange": "7days",
    "generatedAt": "2024-01-08T10:30:00Z"
  },
  "meta": {
    "userId": "admin-uuid",
    "timestamp": "2024-01-08T10:30:00Z",
    "endpoint": "/admin/metrics/storage",
    "cached": false,
    "processingTime": 245
  }
}
```

### User Storage Usage
```json
{
  "success": true,
  "data": {
    "overview": {
      "storage": {
        "totalBytes": 52428800,
        "totalFiles": 12,
        "usagePercentage": 45.2,
        "byStorageClass": {
          "standard": 41943040,
          "infrequentAccess": 10485760
        },
        "byFileType": {
          "csv": 31457280,
          "pdf": 15728640,
          "images": 5242880
        }
      },
      "quota": {
        "maxStorageBytes": 115964116,
        "maxObjects": 1000,
        "quotaType": "free",
        "billingEnabled": false
      },
      "costs": {
        "currentMonthCost": 2.35,
        "lastMonthCost": 1.89,
        "projectedMonthCost": 2.78,
        "costBreakdown": {
          "storage": 1.87,
          "requests": 0.32,
          "bandwidth": 0.16
        }
      },
      "activity": {
        "dailyOperations": 8,
        "weeklyOperations": 47,
        "monthlyOperations": 203,
        "lastActivity": "2024-01-08T09:15:00Z"
      }
    },
    "quotaStatus": {
      "status": "ok",
      "warnings": [],
      "violations": [],
      "quotaType": "free",
      "billingEnabled": false,
      "limits": {
        "storage": {
          "used": 52428800,
          "limit": 115964116,
          "percentage": 45.2
        },
        "cost": {
          "used": 2.35,
          "limit": 50.00,
          "percentage": 4.7
        },
        "operations": {
          "used": 203,
          "limit": 10000,
          "percentage": 2.0
        }
      }
    },
    "recentActivity": [
      {
        "date": "2024-01-08",
        "operation_type": "upload_single",
        "operations": 3,
        "bytes": 15728640
      }
    ],
    "generatedAt": "2024-01-08T10:30:00Z"
  },
  "meta": {
    "userId": "user-uuid",
    "timestamp": "2024-01-08T10:30:00Z", 
    "endpoint": "/user/storage/usage",
    "cached": true,
    "processingTime": 89
  }
}
```

### Real-time Overview
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_operations": 42,
      "total_bytes": 104857600,
      "total_errors": 2,
      "avg_throughput": 2621440,
      "timestamp": "2024-01-08T10:29:45Z"
    },
    "generatedAt": "2024-01-08T10:30:00Z"
  },
  "meta": {
    "userId": "user-uuid",
    "timestamp": "2024-01-08T10:30:00Z",
    "endpoint": "/metrics/realtime/overview", 
    "cached": false,
    "processingTime": 156
  }
}
```

## Error Responses

Error responses follow the same format with `success: false`:

```json
{
  "success": false,
  "error": "Unauthorized",
  "details": "Invalid or expired JWT token",
  "meta": {
    "timestamp": "2024-01-08T10:30:00Z",
    "userId": "unknown"
  }
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Unauthorized | Invalid or missing authentication |
| 403 | Admin access required | Admin privileges required |
| 400 | Invalid request parameters | Invalid query parameters |
| 429 | Rate limit exceeded | Too many requests |
| 404 | Endpoint not found | Invalid endpoint |
| 500 | Internal server error | Server error |

## Rate Limiting

The dashboard API implements rate limiting to prevent abuse:

- **Standard Users**: 100 requests per minute per endpoint
- **Admin Users**: 500 requests per minute per endpoint
- **Rate limit headers** are included in responses:
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 87
  X-RateLimit-Reset: 1641638400
  ```

## Caching Strategy

The API implements intelligent caching to balance performance and data freshness:

### Cache TTL by Endpoint Type
- **Real-time endpoints**: 30 seconds
- **User endpoints**: 2 minutes  
- **Admin overview**: 5 minutes
- **Historical data**: 10 minutes

### Cache Keys
Cache keys include user ID, endpoint, and query parameters:
```
dashboard:/admin/metrics/storage:admin-uuid:timeRange=7days&includeUsers=true
```

### Cache Headers
Cached responses include cache indicators:
```
Cache-Control: public, max-age=300
X-Cache: HIT
ETag: "a1b2c3d4e5f6"
```

## Performance Monitoring

The dashboard tracks its own performance metrics:

### Metrics Tracked
- Response times by endpoint
- Cache hit rates
- Error rates
- Request volume
- Memory usage

### Performance Headers
All responses include performance information:
```
X-Request-ID: req_abc123def456
X-Response-Time: 245ms
X-User-ID: user-uuid
```

## Integration Examples

### Frontend Integration (React)

```typescript
// Dashboard API client
class DashboardAPI {
  private baseURL: string;
  private token: string;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async getUserStorageUsage(timeRange = '30days') {
    const response = await fetch(
      `${this.baseURL}/user/storage/usage?timeRange=${timeRange}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.json();
  }

  async getAdminMetrics(type: 'storage' | 'performance' | 'costs', timeRange = '7days') {
    const response = await fetch(
      `${this.baseURL}/admin/metrics/${type}?timeRange=${timeRange}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.json();
  }

  async getRealtimeOverview() {
    const response = await fetch(
      `${this.baseURL}/metrics/realtime/overview`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.json();
  }
}

// Usage in React component
function StorageDashboard() {
  const [storageData, setStorageData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const api = new DashboardAPI('https://your-worker.your-domain.workers.dev', userToken);
    
    api.getUserStorageUsage('30days')
      .then(response => {
        if (response.success) {
          setStorageData(response.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Storage Usage</h1>
      <div>Total Files: {storageData?.overview.storage.totalFiles}</div>
      <div>Total Size: {formatBytes(storageData?.overview.storage.totalBytes)}</div>
      <div>Usage: {storageData?.overview.storage.usagePercentage}%</div>
    </div>
  );
}
```

### curl Examples

```bash
# Get user storage analytics
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-worker.your-domain.workers.dev/user/storage/analytics?timeRange=30days"

# Get admin system health (admin only)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-worker.your-domain.workers.dev/admin/metrics/system-health"

# Get real-time operations
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-worker.your-domain.workers.dev/metrics/realtime/operations"

# Clear dashboard cache (admin only)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-worker.your-domain.workers.dev/dashboard/cache/clear?pattern=user:*"
```

## Security Considerations

### Data Isolation
- User endpoints only return data for the authenticated user
- Admin endpoints require explicit admin privileges
- Query parameters are validated to prevent injection

### Rate Limiting
- Per-user rate limiting prevents abuse
- Different limits for admin users
- Progressive backoff for repeated violations

### Caching Security
- Cache keys include user ID to prevent data leakage
- Sensitive data is not cached
- Cache invalidation on user actions

### Input Validation
- All query parameters are validated
- Time ranges are restricted to valid values
- Numeric limits are enforced

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify JWT token is valid and not expired
   - Check Authorization header format
   - Ensure user has required permissions

2. **Rate Limiting**
   - Check X-RateLimit-* headers
   - Implement exponential backoff
   - Consider caching on client side

3. **Empty Data**
   - Verify user has data in the specified time range
   - Check if metrics collection is enabled
   - Ensure proper database setup

4. **Performance Issues**
   - Use appropriate time ranges
   - Leverage caching where possible
   - Monitor X-Response-Time headers

### Debug Endpoints

```bash
# Check dashboard health
curl "https://your-worker.your-domain.workers.dev/dashboard/health"

# Get dashboard statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-worker.your-domain.workers.dev/dashboard/stats"
```

## Migration & Deployment

### Database Requirements
- All metrics tables from migration `0003_storage_metrics.sql`
- Proper indexes for query performance
- Regular aggregation job execution

### Environment Variables
```bash
ANALYTICS_DATASET=storage_metrics
ENABLE_METRICS=true
ENABLE_DETAILED_METRICS=false
SUCCESS_SAMPLING_RATE=0.1
ERROR_SAMPLING_RATE=1.0
```

### Cloudflare Workers Configuration
```toml
# wrangler.toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "storage_metrics"

[env.production.vars]
ENABLE_METRICS = "true"
SUCCESS_SAMPLING_RATE = "0.1"
```

This dashboard API provides comprehensive monitoring capabilities for R2 storage with proper authentication, caching, and performance optimization. It's designed to scale with your storage needs while providing actionable insights for both users and administrators.
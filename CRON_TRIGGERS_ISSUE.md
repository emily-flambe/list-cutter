# Configure Cron Triggers for Cloudflare Worker

## Issue Summary
During worker deployment, cron triggers failed to deploy due to API parsing errors with the current wrangler configuration. This issue documents the required steps to properly configure all monitoring, alerting, and backup cron triggers.

## Current Status
- ✅ Worker deployed successfully to `cutty-api.emilycogsdill.com`
- ✅ All bindings configured (KV, D1, R2, Analytics)
- ❌ Cron triggers not configured due to wrangler parsing issues

## Required Cron Triggers

Based on the current `wrangler.toml` configuration, the following cron triggers need to be configured:

### Monitoring & Metrics
- `*/5 * * * *` - Collect metrics every 5 minutes
- `0 */6 * * *` - Calculate costs every 6 hours  
- `0 2 * * *` - Generate daily reports at 2 AM UTC
- `0 4 1 * *` - Generate monthly reports on 1st of month at 4 AM UTC
- `0 5 * * 0` - Cleanup old metrics every Sunday at 5 AM UTC

### Alerting System
- `*/1 * * * *` - Check alerts every minute
- `*/5 * * * *` - Alert evaluation every 5 minutes
- `*/15 * * * *` - Retry failed notifications every 15 minutes
- `0 3 * * *` - Alert cleanup daily at 3 AM UTC
- `*/10 * * * *` - Alert health check every 10 minutes

### Backup & Recovery
- `0 2 * * *` - Daily backup at 2 AM UTC
- `0 3 * * 0` - Weekly backup on Sunday at 3 AM UTC
- `0 4 1 * *` - Monthly backup on 1st at 4 AM UTC
- `*/5 * * * *` - Auto recovery check every 5 minutes

### Data Management
- `0 6 * * *` - Export cleanup daily at 6 AM UTC

## Solution Options

### Option 1: Fix wrangler.toml Configuration
According to Cloudflare documentation, the correct syntax should be:

```toml
[triggers]
crons = [
  "*/5 * * * *",    # Collect metrics
  "0 */6 * * *",    # Calculate costs
  "0 2 * * *",      # Daily reports
  "0 4 1 * *",      # Monthly reports
  "*/1 * * * *",    # Check alerts
  "0 5 * * 0",      # Cleanup metrics
  "*/15 * * * *",   # Retry notifications
  "0 3 * * *",      # Alert cleanup
  "*/10 * * * *",   # Alert health check
  "0 3 * * 0",      # Weekly backup
  "0 6 * * *"       # Export cleanup
]
```

**Issues with current approach:**
- The `[[triggers.crons]]` array syntax caused API parsing errors
- Wrangler v4.23.0 may have bugs with complex cron configurations
- The `endpoint` field is not valid in wrangler.toml cron configuration

### Option 2: Cloudflare Dashboard Configuration
Configure manually via Cloudflare Dashboard:
1. Go to Workers & Pages → cutty-api → Triggers
2. Add each cron trigger individually
3. Verify triggers are active

### Option 3: Cloudflare API Direct Configuration
Use the Cloudflare API to set up triggers programmatically:

```bash
# Example API call structure
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{script_name}/schedules" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"schedules":[{"cron":"*/5 * * * *"}]}'
```

### Option 4: Wrangler Version Update
Try upgrading wrangler and using the corrected syntax:

```bash
npm update wrangler
# Then try deployment with corrected triggers configuration
```

## Worker Handler Requirements

Ensure the worker has a proper `scheduled` event handler:

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Route based on the cron pattern or time
    const url = new URL(event.scheduledTime);
    // Handle different scheduled tasks based on timing
  },
  
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Regular HTTP handler
  }
}
```

## Testing Cron Triggers

Once configured, test using:

```bash
# Local testing
wrangler dev --test-scheduled

# Test endpoint
curl -X GET "http://localhost:8787/__scheduled"
```

## Next Steps

1. **Immediate**: Try Option 1 with corrected wrangler.toml syntax
2. **Fallback**: Use Option 2 (Dashboard) if wrangler issues persist
3. **Verification**: Test all cron endpoints are working
4. **Monitoring**: Verify triggers are executing and logging properly

## Error Details

Current error when deploying with cron triggers:
```
A request to the Cloudflare API (/accounts/.../workers/scripts/cutty-api/schedules) failed.
Could not parse request body. Please ensure the request is valid and try again. [code: 10026]
```

This suggests the wrangler configuration format may be incorrect or incompatible with the current API version.

## Related Files
- `cloudflare/workers/wrangler.toml` - Main configuration
- `cloudflare/workers/src/index.ts` - Worker entry point (needs scheduled handler)
- `cloudflare/workers/cron-triggers.toml` - Attempted separate config (failed)

## Documentation References
- [Cloudflare Cron Triggers Documentation](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Wrangler Configuration Reference](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers Scheduled Events](https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/)
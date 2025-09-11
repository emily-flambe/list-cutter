# Prerequisites for Platform Data Import

Before implementing the simple data consolidation feature, verify these prerequisites are met:

## Required Infrastructure (Already in Cutty)
- [ ] D1 database is operational
- [ ] File processing pipeline works for CSV imports
- [ ] JWT authentication is functioning
- [ ] Existing person_records table can store data

## Minimal New Requirements
- [ ] Cloudflare Workers Cron Triggers enabled on the account
- [ ] Web Crypto API available (standard in Workers)

## Quick Verification Steps
1. **Test CSV Import**: Upload any CSV through existing UI - should create person records
2. **Check Auth**: Current login/logout flow works
3. **Verify Cron**: Add to wrangler.toml:
   ```toml
   [triggers]
   crons = ["*/15 * * * *"]
   ```

## That's It
No new services, databases, or infrastructure needed. The design reuses everything that already exists in Cutty.
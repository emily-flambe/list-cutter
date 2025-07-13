# Email Optional Migration Guide

## Overview
This migration removes the NOT NULL constraint from the `email` field in the `users` table across all D1 databases, making email registration optional.

## Files Created
- `migrations/0007_make_email_optional.sql` - The migration script
- `test_email_optional.sql` - Test script to verify migration worked
- `run_migration.sh` - Automated script to run on all databases
- `MIGRATION_GUIDE.md` - This guide

## Quick Run (Automated)
```bash
cd cloudflare/workers
./run_migration.sh
```

## Manual Step-by-Step

### 1. Development Database
```bash
cd cloudflare/workers

# Run migration
wrangler d1 execute cutty-dev --file=./migrations/0007_make_email_optional.sql

# Test migration
wrangler d1 execute cutty-dev --file=./test_email_optional.sql
```

### 2. Staging Database
```bash
# Run migration
wrangler d1 execute cutty-staging --file=./migrations/0007_make_email_optional.sql

# Test migration  
wrangler d1 execute cutty-staging --file=./test_email_optional.sql
```

### 3. Production Database
```bash
# ⚠️ PRODUCTION - Be careful!
wrangler d1 execute cutty-prod --file=./migrations/0007_make_email_optional.sql

# Test migration
wrangler d1 execute cutty-prod --file=./test_email_optional.sql
```

## What the Migration Does

1. **Creates new table** `users_new` with optional email field
2. **Copies all data** from existing `users` table  
3. **Drops old table** and renames new one
4. **Recreates indexes**: `idx_users_email`, `idx_users_username`
5. **Recreates triggers**: `update_users_timestamp`
6. **Tests the change** with a rollback test

## Verification

After running the migration, you should be able to:

✅ Register users WITH email  
✅ Register users WITHOUT email  
✅ Email field still has UNIQUE constraint (no duplicates)  
✅ All existing data preserved  

## Rollback Plan

If needed, you can rollback by running:
```sql
-- Rollback: Make email required again (if absolutely necessary)
-- This would fail if any users exist without email!
ALTER TABLE users ADD CONSTRAINT email_required CHECK (email IS NOT NULL);
```

## Database IDs (from wrangler.toml)
- Development: `cutty-dev` (2f87e313-31ff-4298-ab18-552fa5a1ce0e)
- Staging: `cutty-staging` (e16924c6-be97-4012-88ac-79ff31fd5304)  
- Production: `cutty-prod` (0a6c6836-02e8-4f91-a37a-7eb82aa58e0f)

## Expected Results

**Before Migration:**
```sql
-- This would FAIL
INSERT INTO users (username, password_hash) VALUES ('test', 'hash');
-- Error: NOT NULL constraint failed: users.email
```

**After Migration:**
```sql  
-- This will SUCCEED
INSERT INTO users (username, password_hash) VALUES ('test', 'hash');
-- User created with email = NULL
```

Run the migration when ready! 🚀
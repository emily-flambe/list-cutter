# Synthetic Data Download 404 Error Fix

## Problem
After generating synthetic data files, subsequent download attempts result in 404 errors. This is caused by:
1. R2 eventual consistency - files may not be immediately available after upload
2. Missing `TEMP_FILE_KEYS` KV namespace - the system can't cache file locations for immediate retrieval

## Solution

### 1. Enable TEMP_FILE_KEYS KV Namespace

The `TEMP_FILE_KEYS` KV namespace is required but was commented out in `wrangler.toml`. To fix this:

1. **Create the KV namespace:**
   ```bash
   cd cloudflare/workers
   wrangler kv namespace create "TEMP_FILE_KEYS"
   ```

2. **Update wrangler.toml:**
   - The configuration has been updated to include the namespace binding
   - Replace `REPLACE_WITH_ACTUAL_ID` with the ID from the wrangler output
   - Replace `REPLACE_WITH_ACTUAL_PREVIEW_ID` with the same ID

3. **Use the setup script:**
   ```bash
   cd cloudflare/workers
   ./setup-temp-file-keys.sh
   ```

### 2. File Naming Fix

The download links now use the actual filename (with timestamp) instead of generic "Download Your Data" text. This was fixed in `cutty-agent/src/tools.ts`.

## How It Works

1. When a file is generated, its R2 key is stored in the `TEMP_FILE_KEYS` KV namespace
2. This allows immediate retrieval even if R2 hasn't propagated the file yet
3. The KV entry expires after 1 hour (by then R2 will be consistent)
4. Download attempts check KV first, then fall back to R2 listing

## Testing

After implementing the fix:
1. Generate synthetic data
2. Try downloading immediately - should work
3. Try downloading again in the same session - should also work
4. Files are named with UTC timestamps for uniqueness
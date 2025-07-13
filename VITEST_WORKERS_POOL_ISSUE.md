# vitest-pool-workers Compatibility Issue

## Summary
`@cloudflare/vitest-pool-workers` version 0.8.53 is incompatible with vitest 2.x, causing persistent `TypeError: this.snapshotClient.startCurrentRun is not a function` errors.

## Environment
- **vitest**: 2.0.5 (pinned)
- **@vitest/coverage-v8**: 2.0.5 (pinned)
- **@cloudflare/vitest-pool-workers**: ^0.8.53
- **Node.js**: 20.x
- **Platform**: GitHub Actions (ubuntu-latest)

## Error Details
```
TypeError: this.snapshotClient.startCurrentRun is not a function
 ❯ WorkersTestRunner.onBeforeRunSuite home/runner/work/list-cutter/list-cutter/cloudflare/workers/node_modules/vitest/dist/runners.js:220:33
 ❯ WorkersTestRunner.onBeforeRunSuite home/runner/work/list-cutter/list-cutter/cloudflare/workers/node_modules/@cloudflare/vitest-pool-workers/dist/worker/lib/cloudflare/test-runner.mjs:164:18
```

## Steps to Reproduce
1. Install `@cloudflare/vitest-pool-workers@^0.8.53`
2. Install `vitest@2.0.5` (or any 2.x version)
3. Configure vitest with Workers pool:
```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    pool: '@cloudflare/vitest-pool-workers',
    // ... other config
  }
});
```
4. Run `npm test`

## Attempted Solutions
- ✅ Downgraded vitest from 2.1.9 to 2.0.5
- ✅ Pinned exact versions (no caret ranges)
- ✅ Cleared npm cache in CI
- ✅ Disabled npm caching in GitHub Actions
- ✅ Force reinstall dependencies in CI
- ❌ Still fails with snapshotClient error

## Current Workaround
Using regular vitest config without Workers pool:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Regular Node.js pool works fine
  }
});
```

## Impact
- Cannot test Workers-specific APIs (D1, R2, KV)
- Cannot validate Workers runtime compatibility
- Reduced confidence in production deployments

## Expected Behavior
Workers pool should work with vitest 2.x without API compatibility errors.

## Suspected Cause
The vitest 2.x series introduced breaking changes to the snapshot/test runner APIs that `@cloudflare/vitest-pool-workers@0.8.53` hasn't been updated to support.

## Request
Please update `@cloudflare/vitest-pool-workers` to support vitest 2.x, or provide guidance on compatible version combinations.
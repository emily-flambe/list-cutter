// Temporarily disable Cloudflare Workers pool due to vitest compatibility issues
// import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

// export default defineWorkersConfig({
//   test: {
//     pool: '@cloudflare/vitest-pool-workers',

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use regular node pool instead of workers pool
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        'dist/**',
        'migrations/**',
        '**/*.config.*',
        'src/examples/**',
        'src/types.ts',
        'src/types/**'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      },
      all: true,
      clean: true
    },
    globals: true,
    testTimeout: 30000
  }
});
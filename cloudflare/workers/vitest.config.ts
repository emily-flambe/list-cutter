// Workers pool disabled due to persistent vitest compatibility issues
// See GitHub issue: [to be created]
// import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Using regular Node.js pool instead of Workers pool
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
        'src/types/**',
        '**/analytics-engine/**'
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
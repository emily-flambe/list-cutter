import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    globals: true,
    pool: '@cloudflare/vitest-pool-workers',
    poolOptions: {
      workers: {
        singleWorker: false, // Enable test isolation
        wrangler: {
          configPath: './wrangler.toml',
        },
        miniflare: {
          compatibilityDate: '2024-12-30',
          compatibilityFlags: ['nodejs_compat'],
          kvNamespaces: ['AUTH_TOKENS', 'CACHE'],
          d1Databases: ['DB'],
          r2Buckets: ['FILE_STORAGE'],
          bindings: {
            ENVIRONMENT: 'test',
            API_VERSION: 'v1',
            JWT_SECRET: 'test-secret-key-for-testing-only',
            JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing-only',
            JWT_ISSUER: 'list-cutter-test',
            JWT_AUDIENCE: 'list-cutter-api-test',
            CORS_ORIGIN: 'http://localhost:5173',
            MAX_FILE_SIZE: '10485760' // 10MB for testing
          },
          modules: true,
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.ts',
        '**/mockData.ts',
        'src/types/**',
        'scripts/',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/security/**/*.test.ts',
    ],
    exclude: [
      'tests/e2e/**',
      'tests/performance/**',
    ],
    setupFiles: ['./tests/setup/unified-worker.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    isolate: true,
    passWithNoTests: false,
    bail: 1, // Stop on first failure in CI
  },
  resolve: {
    alias: {
      '@': './src',
      '@tests': './tests',
    },
  },
});